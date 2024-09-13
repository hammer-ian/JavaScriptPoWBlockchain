//requried for logging
const logger = require('../utils/logger');

const sha256 = require('sha256');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

//Internal modules
const BlockChainExplorer = require('./blockchainExplorer');
const BlockChainIsValid = require('./blockchainIsValid');
const Account = require('./account');

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

Blockchain.prototype.createNewAccount = function (nickname) {

    const newAccount = new Account(nickname);
    this.accounts.push(newAccount);
    return newAccount;
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

    //check debitAcc and creditAcc addresses exist
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

Blockchain.prototype.mine = function (nodeAccAddress) {

    logger.info('Starting to mine.. Need prevBlock hash, current block data, and nonce');
    const prevBlockHash = this.getLastBlock()['hash'];

    const txnList = this.selectTransactions();
    const blockReward = this.createBlockReward(nodeAccAddress);
    txnList.push(blockReward);

    const nonce = this.proofOfWork(prevBlockHash, txnList);
    const currentBlockHash = this.hashBlockData(prevBlockHash, txnList, nonce);
    const newBlock = this.createNewBlock(nonce, prevBlockHash, currentBlockHash, txnList);

    return newBlock;
}

Blockchain.prototype.selectTransactions = function () {

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

    const newBlockReward = {
        txnID: uuidv4().split('-').join(''),
        debitAddress: 'system',
        creditAddress: nodeAccAddress,
        amount: 12.5,
    };

    return newBlockReward;

}



module.exports = Blockchain;
