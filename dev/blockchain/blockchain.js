//requried for logging
const logger = require('../utils/logger');

const sha256 = require('sha256');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

//Internal modules
const BlockChainExplorer = require('./blockchainExplorer');
const BlockChainIsValid = require('./blockchainIsValid');
const SelectTransactionsForBlock = require('./selectTransactionsForBlock');
const Account = require('./account');
const { object } = require('joi');
const { DataBrew } = require('aws-sdk');

//Map the methods defined in refactored blockchain files to the Blockchain object prototype
Object.assign(Blockchain.prototype, BlockChainExplorer);
Object.assign(Blockchain.prototype, BlockChainIsValid);
Object.assign(Blockchain.prototype, SelectTransactionsForBlock);

function Blockchain(networkNodeURL) {

    this.pendingTransactions = []; //pending unvalidated blockchain transactions
    this.accounts = []; //list of accounts created on the blockchain
    this.chain = []; //complete validated transactions committed to chain

    //the url for this instance of the network node
    this.currentNodeUrl = networkNodeURL;
    //contains other nodes on the network. Note does not contain this instance's url
    this.networkNodes = [];

    this.maxBlockSize = parseInt(process.env.MAX_BLOCK_SIZE);
    this.blockRewardAmount = parseFloat(process.env.BLOCK_REWARD);

    //pre-mine, need to seed network with initial funds in an account
    //after the pre-mine the only source of new funds on the network will be block rewards
    this.accounts.push(new Account('genesis-account', process.env.GENESIS_PRE_MINE_ACC));
    this.accounts[0].credit(1000);

    //finally create Genesis block
    this.chain.push({
        index: 1,
        timestamp: 304819200000, //23-Aug-1979 ;)
        nonce: 100,
        prevBlockHash: 'NA',
        hash: 'genesisHash',
        transactions: [],
        stateRoot: sha256(`${this.accounts[0].address}:${this.accounts[0].balance}-${this.accounts[0].nonce}`),
        merkleRoot: sha256('') //hash empty string i.e. zero nodes
    });

    logger.info(`Blockchain initialized and genesis block created: ${JSON.stringify(this.chain[0])}`);
}

Blockchain.prototype.createNewAccount = function (nickname, address) {

    const existingAddress = this.accounts.find(account => account.address === address)
    if (!existingAddress) {
        const newAccount = new Account(nickname, address);
        this.accounts.push(newAccount);
        return newAccount;
    }
    return null;
}

Blockchain.prototype.getLatestNonce = function (debitAddress) {

    logger.info(`Retrieving account nonce for debitAddress: ${debitAddress}`);
    //Get current debit account nonce
    const debitAddressAcc = this.accounts.find(account => account.address === debitAddress);
    // Make sure debit account exists
    if (!debitAddressAcc) {
        throw new Error(`Account with address ${debitAddress} does not exist`);
    }

    const debitAccNonce = debitAddressAcc.nonce;
    logger.info(`Debit account nonce is: ${debitAccNonce}`)
    let hasPendingTransactions = false;

    //initialize to the debit account nonce. if there are no pending transactions this will be returned
    let pendingTxnNonce = debitAccNonce;

    //Check if there are pending transactions from this account which we need to consider
    this.pendingTransactions.forEach(txn => {

        if (txn.debitAddress === debitAddress) {
            //if there are pending transactions we need to find the largest nonce
            logger.info('Pending transactions detected from debit account');
            hasPendingTransactions = true;
            if (txn.nonce > pendingTxnNonce) pendingTxnNonce = txn.nonce;
        }
    });
    logger.info(`PendingTxn:${hasPendingTransactions}, acc nonce ${debitAccNonce}, pending txn nonce: ${hasPendingTransactions ? pendingTxnNonce + 1 : pendingTxnNonce}`);
    //return nonce for next transaction
    return hasPendingTransactions ? pendingTxnNonce + 1 : pendingTxnNonce;
}

Blockchain.prototype.createNewTransaction = function (debitAddress, creditAddress, amount, gas) {

    //get the latest account nonce, taking into account pending transactions
    const nonce = this.getLatestNonce(debitAddress);

    //validate the debit address, debit funds
    //credit address will be created/credited when transaction is included in new block
    const resultObj = this.validateTransaction(debitAddress, amount, gas);

    if (resultObj.ValidTxn) {
        //if no checks fail create txn object, adding in txn id
        const newTxnObj = {
            txnID: uuidv4(),
            debitAddress: debitAddress,
            creditAddress: creditAddress,
            amount: amount,
            gas: gas,
            nonce: nonce
        };

        //add new transaction object to the pending list on THIS instance of the blockchain
        this.addNewTransactionToPendingPool(newTxnObj);
        logger.info(`Transaction added to list of pending transactions ${JSON.stringify(newTxnObj)}`);
        return newTxnObj;
    } else {
        logger.error(`Transaction validation failed: ${resultObj.Error}`);
        return resultObj;
    }
}

Blockchain.prototype.validateTransaction = function (debitAddress, amount, gas, nonce) {

    logger.info('Starting transaction validation');
    const resultObj = {
        ValidTxn: false,  // Assume invalid until proven otherwise
        Error: null,
        Details: {}
    };

    //first check if txn is a system generated block reward
    if (debitAddress === 'system' && amount === this.blockRewardAmount) {
        logger.info('Transaction is block reward. Block reward is correct');
        resultObj.ValidTxn = true;
        return resultObj;
    } else if (debitAddress === 'system' && amount !== this.blockRewardAmount) {
        logger.info('Transaction is block reward. Block reward NOT correct');
        resultObj.Error = `block reward is not correct`;
        resultObj.Details = {
            TxnBlockReward: amount,
            CorrectBlockReward: this.blockRewardAmount
        }
        return resultObj;
    }

    //check debitAcc address exist
    const debitAddressAcc = this.accounts.find(account => account.address === debitAddress);

    if (debitAddressAcc) {
        logger.info(`Debit address exists: ${debitAddressAcc.address}`);
    } else {
        logger.info(`Debit Address(es) does not exist. Transaction aborted`);

        resultObj.Error = `address check failed`;
        resultObj.Details = {
            DebitAddress: !!debitAddressAcc
        }
        return resultObj;
    }

    //check sufficient funds available in debit account to process transaction
    if (!debitAddressAcc.debitCheck(amount + gas)) {

        logger.info(`DebitCheck failed: insufficient funds in ${debitAddressAcc.address} `);
        resultObj.Error = `debitCheck failed: insufficient funds in ${debitAddressAcc.address}`;
        resultObj.Details = {
            DebitAmount: amount,
            Gas: gas,
            TotalDebit: amount + gas,
            DebitAccBalance: debitAddressAcc.balance
        }
        return resultObj;
    }

    /* 
        validateTransaction is called both by createTransaction(), and processSelectedTransactions()
        if called by createTransaction we do NOT need to validate nonce, this has been done already in createTransaction
        if called by processSelectedTransactions we DO need to validate nonce
        therefore, if a nonce is passed to validateTransaction we assume we've been called by processSelectedTransactions and validate nonce
        else if no nonce is passed we will assume createTransaction called us, and not validate nonce
    */
    if (nonce && nonce !== debitAddressAcc.nonce) {
        logger.info(`nonce check failed during Txn validation. Txn nonce ${nonce} does not equal account nonce ${debitAddressAcc.nonce}`);
        resultObj.Error = `nonce check failed during Txn validation. Txn nonce does not equal account nonce`;
        resultObj.Details = {
            txnNonce: nonce,
            debitAccNonce: debitAddressAcc.nonce
        }
        return resultObj;
    }

    resultObj.ValidTxn = true;
    return resultObj;
}

Blockchain.prototype.addNewTransactionToPendingPool = function (transactionObj) {

    //add new transaction to list of pending txns, as it's not yet been validated
    this.pendingTransactions.push(transactionObj);
    //return the index of the block this transaction will get mined in i.e. the next block
}

Blockchain.prototype.getLastBlock = function () {

    return this.chain[this.chain.length - 1];
}

Blockchain.prototype.mine = function (minerAccAddr) {

    const result = {
        ValidBlock: false,  // Assume invalid until proven otherwise
        Details: null,
        Error: null,
        ErrorList: null

    };

    logger.info('Starting to mine.. Need prevBlock hash, current block data, and nonce');
    const prevBlockHash = this.getLastBlock()['hash'];

    //Select transactions for block
    const txnList = this.selectTransactionsForBlock();
    if (txnList.length === 0) {
        logger.error('No eligible transactions identified for new block');
        result.Error = "No eligible transactions identified for new block";
        return result;
    }

    //Create block reward for miner
    const blockReward = this.createBlockReward(minerAccAddr);
    txnList.push(blockReward);

    //Re-validate selected transactions
    //Execute the change of state contained within in the transactions
    //Transactions failing their re-validation or processing will be removed from the block
    const processedListObj = this.processSelectedTransactions(txnList, minerAccAddr);
    const processedList = processedListObj.processedList;

    //If sufficient valid transactions remain create new block (2 = block reward + 1)
    if (processedList.length >= 2) {
        const merkleRoot = this.getMerkleRoot(processedList);
        const stateRoot = this.getStateRoot(this.accounts);
        const nonce = this.proofOfWork(prevBlockHash, processedList);
        const currentBlockHash = this.hashBlockData(prevBlockHash, processedList, nonce);
        const newBlock = this.createNewBlock(nonce, prevBlockHash, currentBlockHash, processedList, merkleRoot, stateRoot, minerAccAddr);

        result.ValidBlock = true;
        result.Details = newBlock;
    } else {
        logger.info('Block creation failed. Txn count below threshold. Insufficient valid txns identified')
        result.Error = "Issue with processing transactions selected for block, no valid transactions. New block aborted";
        result.ErrorList = processedListObj.errorList;
    }

    return result;
}

Blockchain.prototype.getMerkleRoot = function (txnList) {

    logger.info('Creating merkle root of new block transactions');
    const txnHashes = txnList.map(txn =>
        hashTxnState(txn.txnID, txn.amount, txn.debitAddress, txn.creditAddress, txn.nonce)
    );

    logger.info(`Txn states hashed: ${txnHashes}, length: ${txnHashes.length}`);
    const merkleRoot = this.createMerkleTreeRoot(txnHashes);

    logger.info(`Txn merkle root finished: ${merkleRoot}`);
    return merkleRoot;

    function hashTxnState(id, amount, debitAddress, creditAddress, nonce) {
        return sha256(`${id}:${amount}:${debitAddress}:${creditAddress}:${nonce}`);
    }
}

Blockchain.prototype.getStateRoot = function (accountList) {

    logger.info('Creating new state root of blockchain account state');
    // Hash the state of each account
    const accountHashes = accountList.map(account =>
        hashAccountState(account.address, account.balance, account.nonce)
    );

    // Sort the array of account hashes lexicographically before creating the Merkle root
    const sortedAccountHashes = accountHashes.sort((a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    });

    logger.info(`Account states hashed: ${sortedAccountHashes}, length: ${sortedAccountHashes.length}`);
    const stateRoot = this.createMerkleTreeRoot(sortedAccountHashes);

    logger.info(`Account state root finished: ${stateRoot}`);
    return stateRoot;

    function hashAccountState(accountAddress, balance, nonce) {
        return sha256(`${accountAddress}:${balance}-${nonce}`);
    }
}

Blockchain.prototype.checkStateRoot = function (txnList, minerAddr) {

    logger.info('Checking state root for received block');
    let stateRoot = null;
    //when processing an incoming new block (mined by another node) to validate the new blocks state root we only want to to SIMULATE updating the account state
    //no updates should be made to the real this.accounts[] state, in case we need to reject the new block
    //so we clone the account state, and update the cloned accounts
    logger.info('Cloning blockchain accounts to simulate processing new blocks txns');
    const tempAccounts = this.accounts.map(account =>
        account.clone()
    );

    //Because this is a simulation make sure accounts exist, if not create them in cloned account list
    txnList.forEach(txn => {
        let debitAcc = tempAccounts.find(account => account.address === txn.debitAddress);
        if (!debitAcc && txn.debitAddress !== 'system') {
            logger.info(`Creating temp debit address clone: ${txn.debitAddress}`);
            tempAccounts.push(new Account('', txn.debitAddress));
        }
        let creditAcc = tempAccounts.find(account => account.address === txn.creditAddress);
        if (!creditAcc) {
            logger.info(`Creating temp credit address clone: ${txn.creditAddress}`);
            tempAccounts.push(new Account('', txn.creditAddress));
        }
    });

    logger.info('Simulating processing new blocks txns');
    const processingResult = this.processSelectedTransactions(txnList, minerAddr, tempAccounts);
    if (processingResult.processedList.length >= 2) {
        logger.info('Simulation success, creating state root for simulation');
        stateRoot = this.getStateRoot(tempAccounts);
        logger.info('Returning simulated state root to new block validation');
        return stateRoot;
    }
    //issue simulating new block's txn processing
    logger.error('Issue with new block simulation, could not create state root');
    return stateRoot;
}

//Take array of hashed data, create merkleTrie and return root hash
Blockchain.prototype.createMerkleTreeRoot = function (hashArr) {

    while (hashArr.length > 1) {
        if (hashArr.length % 2 !== 0) {
            hashArr.push(hashArr[hashArr.length - 1]);  // Duplicate last hash if odd number
        }

        const newLevel = [];
        for (let i = 0; i < hashArr.length; i += 2) {
            const combinedHash = sha256(hashArr[i] + hashArr[i + 1]);
            newLevel.push(combinedHash);
        }

        hashArr = newLevel;  // Move to next level
    }

    return hashArr[0];  // Return the final root hash
}

//Find the nonce, that when hashed with the previous block's hash, and the current blocks data,  
//matches the blockchain's proof of work criteria e.g. a hash that starts with '0000'
Blockchain.prototype.proofOfWork = function (prevBlockHash, currentBlockData) {
    //initialize nonce
    let nonce = 0;
    let hash = this.hashBlockData(prevBlockHash, currentBlockData, nonce);

    while (hash.substring(0, 4) !== '0000') {
        //increment nonce by 1
        nonce++;
        //and rerun hashing method again until 1st 4 characters of hash match '0000'
        hash = this.hashBlockData(prevBlockHash, currentBlockData, nonce);
    }
    //return nonce value that gives us a valid hash starting with '0000'
    return nonce;
}

//Produce a SHA-256 hash given the prev block's hash, the current block data, and a nonce
Blockchain.prototype.hashBlockData = function (prevBlockHash, currentBlockData, nonce) {

    //convert all block data into a single string
    const dataAsString = prevBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
    const hash = sha256(dataAsString);
    return hash;
}

//Create new block, create blockReward, add new block to chain, return new block
Blockchain.prototype.createNewBlock = function (nonce, prevBlockHash, currentBlockHash, txnList, merkleRoot, stateRoot, nodeAccAddress) {

    //create newBlock object
    const newBlock = {
        index: this.chain.length + 1,
        timestamp: Date.now(),
        transactions: txnList,
        nonce: nonce,
        hash: currentBlockHash,
        prevBlockHash: prevBlockHash,
        miner: nodeAccAddress,
        stateRoot: stateRoot,
        merkleRoot: merkleRoot
    };

    //Remove transactions selected for this block from pending pool
    logger.info('Removing transactions included in block from the pending pool');
    txnList.forEach(txn => {
        const index = this.pendingTransactions.findIndex(t => t.txnID === txn.txnID);
        if (index !== -1) {
            this.pendingTransactions.splice(index, 1); // Remove the transaction from the original array
        }
    });

    //add new block to chain
    this.chain.push(newBlock);

    return newBlock;
}

Blockchain.prototype.createBlockReward = function (nodeAccAddress) {

    logger.info(`Creating miners block reward for ${nodeAccAddress}`);
    const newBlockReward = {
        txnID: uuidv4().split('-').join(''),
        debitAddress: 'system',
        creditAddress: nodeAccAddress,
        amount: this.blockRewardAmount
    };
    return newBlockReward;
}

Blockchain.prototype.receiveNewBlock = function (newBlock) {

    const lastBlock = this.getLastBlock();
    //make sure new block hash has the correct previous block hash so we don't break the chain
    const correctHash = lastBlock.hash === newBlock.prevBlockHash;
    //make sure the new block has the correct index, equal to last block + 1
    const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

    let processingResult, correctStateRoot, correctMerkleRoot;
    //if new block has correct hash, i.e. chained hashes are in tact
    if (correctHash && correctIndex) {
        //process transactions in new block
        const txnList = newBlock.transactions;

        //before we start processing the transactions check the new block's state/txn roots
        const stateRoot = this.checkStateRoot(txnList, newBlock.miner);
        correctStateRoot = stateRoot === newBlock.stateRoot;
        const merkleRoot = this.getMerkleRoot(txnList);
        correctMerkleRoot = merkleRoot === newBlock.merkleRoot;

        logger.info(`stateRoot: ${correctStateRoot}, merleRoot: ${correctMerkleRoot}`);

        //if state/merkle roots appear correct we can process the txns
        if (correctStateRoot && correctMerkleRoot) {

            processingResult = this.processSelectedTransactions(txnList, newBlock.miner);

            if (processingResult.errorList === null || processingResult.errorList.length === 0) {

                this.chain.push(newBlock);

                //Remove transactions received in this block from pending pool
                txnList.forEach(txn => {
                    const index = this.pendingTransactions.findIndex(t => t.txnID === txn.txnID);
                    if (index !== -1) {
                        this.pendingTransactions.splice(index, 1); // Remove the transaction from pending pool
                    }
                });

                const success = {
                    status: 'success',
                    note: "new Block processed and successfully added to chain",
                    newBlock: newBlock
                };
                logger.info(`New block accepted ${JSON.stringify(success)}`);
                return success;
            }
        }
    }
    const failure = {
        status: "failed",
        note: 'new block failed validation, not added to chain',
        correctHash: correctHash,
        correctIndex: correctIndex,
        correctStateRoot: correctStateRoot,
        correctMerkleRoot: correctMerkleRoot,
        failedBlock: newBlock,
        errorList: processingResult ? processingResult.errorList : null
    };
    logger.error(`New block rejected ${JSON.stringify(failure)}`);

    return failure;
}

//Re-validate and process transactions in new block
//While we could find the miner address from the block reward in txnList, we would have to search for the block reward txn
//And given we have the miner addr handy from creating the block it's easier to also pass the address here
Blockchain.prototype.processSelectedTransactions = function (txnList, minerAddr, accountList) {

    logger.info('Starting re-validation of selected transactions before processing block');

    const processingResult = {
        processedList: null,
        errorList: null
    };
    //if no accountList is passed, default to updating the global account state
    if (!accountList) {
        logger.info(`We are NOT in simulation mode, we are updating global account state`);
        accountList = this.accounts;
    }

    // Re-validate transactions selected from pending pool
    let processedList = txnList.filter(txn => {
        //re-validate txn. note the debit check evaluates the txn in isolation
        //debit check does not take into account other pending txns in this block that may get processed first
        const validationResult = this.validateTransaction(txn.debitAddress, txn.amount, txn.gas, txn.nonce);
        //if still valid execute change of state contained in transaction
        if (validationResult.ValidTxn) {

            const debitAddressAcc = accountList.find(account => account.address === txn.debitAddress);
            let creditAddressAcc = accountList.find(account => account.address === txn.creditAddress);
            let minerAddrAcc = accountList.find(account => account.address === minerAddr);

            if (txn.debitAddress !== 'system') {
                //check transaction is being processed in the correct sequence as per debit account nonce
                if (txn.nonce !== debitAddressAcc.nonce) {
                    logger.error(`Issue with sequencing. Txn nonce ${txn.nonce} !== ${debitAddressAcc.nonce}`);
                    return false;
                }

                if (!debitAddressAcc.debit(txn.amount + txn.gas)) {
                    //debit failed remove transaction from list of valid transactions
                    logger.error(`Debit check failed for: ${debitAddressAcc.address}. Balance exhausted by other transactions in block.`);
                    return false;
                }

                // debit successful, increment nonce and credit miner with txn gas fee
                debitAddressAcc.incrementTransactionCount();

                if (minerAddrAcc) {
                    minerAddrAcc.credit(txn.gas);
                } else {
                    minerAddrAcc = this.createNewAccount("", minerAddr);
                    minerAddrAcc.credit(txn.gas);
                }
            }
            //now credit beneficiary, first checking to make sure account exists
            if (creditAddressAcc) {
                creditAddressAcc.credit(txn.amount);
            } else {
                //create a new account using the credit address
                creditAddressAcc = this.createNewAccount("", txn.creditAddress);
                creditAddressAcc.credit(txn.amount);
            }
            return true;  // Transaction valid AND processed successfully
        } else {
            return false; // Transaction validation failed
        }
    });
    //if the # of txns selected for block !==  # of txns successfully processed
    if (txnList.length !== processedList.length) {
        //filter() iterates through array evaluating elements, where condition is true element is added to a new array
        //some() method returns true if txnID is found, but we want to keep missing txns (false not found) so we flip the boolean with !processedList
        //that means some() passes true to filter() when txn not found
        const errorList = txnList.filter(selectedTxn => !processedList.some(txn => txn.txnID === selectedTxn.txnID));
        logger.error(`Following txns were not processed successfully: ${JSON.stringify(errorList)}`);

        processingResult.errorList = errorList;
    }
    processingResult.processedList = processedList;
    return processingResult;
}

module.exports = Blockchain;
