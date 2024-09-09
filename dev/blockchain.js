//requried for logging
const logger = require('./utils/logger');
const sha256 = require('sha256');
const { v4: uuidv4 } = require('uuid');
const Account = require('./account');

function Blockchain(networkNodeURL) {

    this.pendingTransactions = []; //pending unvalidated blockchain transactions
    this.chain = []; //complete validated transactions committed to chain

    //the url for this instance of the network node
    this.currentNodeUrl = networkNodeURL;
    //contains other nodes on the network. Note does not contain this instance's url
    this.networkNodes = [];

    //create Genesis block with arbitrary values
    this.createNewBlock(100, 'NA', 'genesisHash');
}

Blockchain.prototype.createNewTransaction = function (amount, sender, recipient) {

    const newTxn = {
        txnID: uuidv4().split('-').join(''),
        amount: amount,
        sender: sender,
        recipient: recipient
    }
    return newTxn;
}

Blockchain.prototype.addNewTransactionToPendingTransactions = function (transactionObj) {

    //add new transaction to list of pending txns, as it's not yet been validated
    this.pendingTransactions.push(transactionObj);
    //return the index of the block this transaction will get mined in i.e. the next block
    return this.getLastBlock()['index'] + 1;
}

Blockchain.prototype.getLastBlock = function () {

    return this.chain[this.chain.length - 1];
}

//Create new block, add new block to chain, return new block
Blockchain.prototype.createNewBlock = function (nonce, prevBlockHash, currentBlockHash) {

    //create newBlock object
    const newBlock = {
        index: this.chain.length + 1,
        timestamp: Date.now(),
        transactions: this.pendingTransactions,
        nonce: nonce,
        hash: currentBlockHash,
        prevBlockHash: prevBlockHash
    };

    //reset pending Transactions array ready for next new block
    this.pendingTransactions = [];

    //add new block to chain
    this.chain.push(newBlock);

    return newBlock;
}

//Produce a SHA-256 hash given the prev block's hash, the current block data, and a nonce
Blockchain.prototype.hashBlockData = function (prevBlockHash, currentBlockData, nonce) {

    //convert all block data into a single string
    const dataAsString = prevBlockHash + nonce.toString() + JSON.stringify(currentBlockData);
    const hash = sha256(dataAsString);
    return hash;
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

//Compare hashes in each block to ensure valid
Blockchain.prototype.chainIsValid = function (blockchain) {

    let chainValid = true;
    //check each block in chain, start at position 1 (skipping initial genesis block)
    for (var i = 1; i < blockchain.length; i++) {
        const currentBlock = blockchain[i];
        const prevBlock = blockchain[i - 1];

        //check chain "links" are correct - compare current block prevHash to previous block's hash
        if (currentBlock['prevBlockHash'] !== prevBlock['hash']) {
            logger.info(`FAIL: Issue with chain linking. current block prevHash is ${currentBlock['prevBlockHash']}, previous block hash is ${prevBlock['hash']}`);
            chainValid = false;
        }

        //check current block data has not changed by computing the hash again
        const blockHash = this.hashBlockData(
            prevBlock['hash'],
            currentBlock['transactions'],
            currentBlock['nonce']
        );
        //make sure hash starts with '0000'
        if (blockHash.substring(0, 4) !== '0000') {
            logger.info("FAIL: Issue with current block data, recomputed hash is wrong");
            logger.info(currentBlock['index'], prevBlock['hash'], currentBlock['transactions'], currentBlock['nonce']);
            chainValid = false;
        }
    }
    //now check genesis block
    const genesisBlock = blockchain[0];
    const correctGenesisNonce = genesisBlock['nonce'] === 100;
    const correctGenesisPrevBlockHash = genesisBlock['prevBlockHash'] === 'NA';
    const correctGenesisHash = genesisBlock['hash'] === 'genesisHash';
    const correctGenesisTransactions = genesisBlock['transactions'].length === 0;

    if (!correctGenesisNonce || !correctGenesisPrevBlockHash || !correctGenesisHash || !correctGenesisTransactions) {
        logger.info("FAIL: Issue with genesis block");
        chainValid = false;
    }

    return chainValid;
}

Blockchain.prototype.getBlock = function (blockHashToFind) {

    let correctBlock = null;
    this.chain.forEach(block => {
        if (block.hash === blockHashToFind) correctBlock = block;
    });
    return correctBlock;
}

Blockchain.prototype.getTransaction = function (transactionId) {
    logger.info("Searching for transaction: ", transactionId);
    let correctBlock, correctTransaction = null;
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            if (transaction.txnID === transactionId) {
                correctTransaction = transaction;
                correctBlock = block;
            };
        });
    });
    return {
        block: correctBlock,
        transaction: correctTransaction
    };
}

Blockchain.prototype.getAddress = function (addressToFind) {
    logger.info("Searching for transactions associated with: ", addressToFind);
    const matchingTransactions = [];
    let addressBalance = 0;
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            logger.info(transaction.sender, " ", transaction.recipient, " ", addressToFind)
            if ((transaction.sender === addressToFind) || (transaction.recipient === addressToFind)) {
                matchingTransactions.push(transaction);

                //now calculate address balance
                if (transaction.recipient === addressToFind) addressBalance += transaction.amount;
                if (transaction.sender == addressToFind) addressBalance -= transaction.amount;
            };
        });
    });
    return {
        addressBalance: addressBalance,
        addressTransactions: matchingTransactions
    };
}

module.exports = Blockchain;
