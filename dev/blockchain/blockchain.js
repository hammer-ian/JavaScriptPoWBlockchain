//requried for logging
const logger = require('../utils/logger');

const sha256 = require('sha256');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

//Internal modules
const BlockChainExplorer = require('./blockchainExplorer');
const BlockChainIsValid = require('./blockchainIsValid');
const Account = require('./account');
const { object } = require('joi');

//Map the methods defined in refactored blockchain files to the Blockchain object prototype
Object.assign(Blockchain.prototype, BlockChainExplorer);
Object.assign(Blockchain.prototype, BlockChainIsValid);

function Blockchain(networkNodeURL) {

    this.pendingTransactions = []; //pending unvalidated blockchain transactions
    this.accounts = []; //list of accounts created on the blockchain
    this.chain = []; //complete validated transactions committed to chain

    //the url for this instance of the network node
    this.currentNodeUrl = networkNodeURL;
    //contains other nodes on the network. Note does not contain this instance's url
    this.networkNodes = [];

    this.maxBlockSize = process.env.MAX_BLOCK_SIZE;
    this.blockRewardAmount = Number(process.env.BLOCK_REWARD);

    //create Genesis block with arbitrary values
    this.chain.push({
        index: 1,
        timestamp: Date.now(),
        nonce: 100,
        prevBlockHash: 'NA',
        hash: 'genesisHash',
        transactions: [],
    });
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

Blockchain.prototype.getAccountNonce = function (debitAddress) {

    //Get current debit account nonce
    const debitAddressAcc = this.accounts.find(account => account.address === debitAddress);
    // Make sure debit account exists
    if (!debitAddressAcc) {
        throw new Error(`Account with address ${debitAddress} does not exist.`);
    }

    const debitAccNonce = debitAddressAcc.nonce;

    //initialize to the debit account nonce. if there are no pending transactions this will be returned
    let pendingTxnNonce = debitAccNonce;
    //Check if there are pending transactions from this account which we need to consider
    this.pendingTransactions.forEach(txn => {

        if (txn.debitAddress === debitAddress) {
            if (txn.nonce > pendingTxnNonce) pendingTxnNonce = txn.nonce;
        }
    });

    //increment nonce for next transaction
    return pendingTxnNonce;
}

Blockchain.prototype.createNewTransaction = function (debitAddress, creditAddress, amount, gas, nonce) {

    //only validate the debit address, debit funds, debit nonce
    //credit address will be created/credited when transaction is included in new block
    const resultObj = this.validateTransaction(debitAddress, amount, gas, nonce);

    if (resultObj.ValidTxn) {
        //if no checks fail create txn object, adding in txn id
        const newTxnObj = {
            txnID: uuidv4().split('-').join(''),
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

    const resultObj = {
        ValidTxn: false,  // Assume invalid until proven otherwise
        Error: null,
        Details: {}
    };

    //first check if txn is a system generated block reward
    if (debitAddress === 'system' && amount === this.blockRewardAmount) {
        resultObj.ValidTxn = true;
        return resultObj;
    }

    //check debitAcc address exist
    const debitAddressAcc = this.accounts.find(account => account.address === debitAddress);

    if (debitAddressAcc) {
        logger.info(`Debit address found: ${debitAddressAcc.address}`);
    } else {
        logger.info(`Debit Address(es) not found. Transaction aborted`);

        resultObj.Error = `address check failed`;
        resultObj.Details = {
            DebitAddress: !!debitAddressAcc
        }
        return resultObj;
    }

    //check the copy of the account nonce submitted with the transaction is valid
    //this helps to prevent double spend
    if (nonce !== debitAddressAcc.nonce) {

        logger.info(`Account nonce check failed. TransactionNonce: ${nonce} <> AccountNonce: ${debitAddressAcc.nonce}`);
        resultObj.Error = `account transaction count (nonce) check failed. Transaction nonce must equal Account nonce`;
        resultObj.Details = {
            TransactionNonce: `${nonce}`,
            AccountNonce: `${debitAddressAcc.nonce}`
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

Blockchain.prototype.mine = function (nodeAcc) {

    const result = {
        ValidBlock: false,  // Assume invalid until proven otherwise
        Error: null,
        Details: {}
    };

    logger.info('Starting to mine.. Need prevBlock hash, current block data, and nonce');
    const prevBlockHash = this.getLastBlock()['hash'];

    const txnList = this.selectTransactionsForBlock();

    const blockReward = this.createBlockReward(nodeAcc.address);
    logger.info('Adding block reward to transaction list');
    txnList.push(blockReward);

    //re-validate selected transactions, and execute the change of state contained within in the transactions
    //transactions failing their re-validation will be removed from the block
    const validatedTxnList = this.processSelectedTransactions(txnList, nodeAcc);

    //Sufficient valid transactions exist for new block, create new block
    if (validatedTxnList.length >= 2) {
        const nonce = this.proofOfWork(prevBlockHash, validatedTxnList);
        const currentBlockHash = this.hashBlockData(prevBlockHash, validatedTxnList, nonce);
        const newBlock = this.createNewBlock(nonce, prevBlockHash, currentBlockHash, validatedTxnList);

        result.ValidBlock = true;
        result.Details = newBlock;
    } else {
        logger.info('Block creation failed. Txn count below threshold. Insufficient valid txns identified')
        result.Error = "Issue with processing transactions selected for block, no valid transactions. New block aborted";
        result.Details = "";
    }

    return result;
}

Blockchain.prototype.selectTransactionsForBlock = function () {

    logger.info(`Selecting max ${this.maxBlockSize} transactions from pending pool prioritized by gas fee`);
    const transactionsToMine = this.pendingTransactions
        .sort((a, b) => b.gas - a.gas) // Sort by gas in descending order
        .slice(0, this.maxBlockSize); // Copy the txns with the highest gas into the a new array. Block size determines how many txn we want

    return transactionsToMine;
};

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
Blockchain.prototype.createNewBlock = function (nonce, prevBlockHash, currentBlockHash, txnList) {

    //create newBlock object
    const newBlock = {
        index: this.chain.length + 1,
        timestamp: Date.now(),
        transactions: txnList,
        nonce: nonce,
        hash: currentBlockHash,
        prevBlockHash: prevBlockHash
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

//Re-validate and process transactions in new block
Blockchain.prototype.processSelectedTransactions = function (txnList, nodeAcc) {

    logger.info('Starting re-validation of transactions selected from pending pool before creating block');

    // Re-validate transactions selected from pending pool
    validTxnList = txnList.filter(txn => {
        //re-validate txn. note the debit check evaluates the txn in isolation
        //debit check does not take into account other pending txns in this block that may get processed first
        const result = this.validateTransaction(txn.debitAddress, txn.amount, txn.gas, txn.nonce);
        //if still valid execute change of state contained in transaction
        if (result.ValidTxn) {

            const debitAddressAcc = this.accounts.find(account => account.address === txn.debitAddress);
            let creditAddressAcc = this.accounts.find(account => account.address === txn.creditAddress);

            if (txn.debitAddress !== 'system') {
                if (debitAddressAcc.debit(txn.amount + txn.gas)) {
                    // if debit account successfully debited, credit miner with txn gas fee
                    nodeAcc.credit(txn.gas);
                } else {
                    //debit failed remove transaction from list of valid transactions
                    logger.error(`Debit check failed for: ${debitAddressAcc.address}. Balance exhausted by other transactions in block.`);
                    return false;
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

            // Increment debit account nonce

            return true;  // Transaction valid
        } else {
            return false; // Transaction not valid
        }
    });

    logger.info(`Valid transactions are: ${validTxnList}`);
    return validTxnList;
}

module.exports = Blockchain;
