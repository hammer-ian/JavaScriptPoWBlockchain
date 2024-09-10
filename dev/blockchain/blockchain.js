//requried for logging
const logger = require('../utils/logger');
const sha256 = require('sha256');
const { v4: uuidv4 } = require('uuid');

//Internal modules
const BlockChainExplorer = require('./blockchainExplorer');
const Account = require('./account');

function Blockchain(networkNodeURL) {

    this.pendingTransactions = []; //pending unvalidated blockchain transactions
    this.accounts = []; //list of accounts created on the blockchain
    this.chain = []; //complete validated transactions committed to chain

    //the url for this instance of the network node
    this.currentNodeUrl = networkNodeURL;
    //contains other nodes on the network. Note does not contain this instance's url
    this.networkNodes = [];

    //create Genesis block with arbitrary values
    this.createNewBlock(100, 'NA', 'genesisHash');
}

Blockchain.prototype.createNewAccount = function (nickname) {

    const newAccount = new Account(nickname);
    this.accounts.push(newAccount);
    return newAccount;
}

Blockchain.prototype.createNewTransaction = function (debitAddress, creditAddress, amount) {

    //check debitAcc and creditAcc addresses exist
    const debitAddressObj = this.accounts.find(account => account.address === debitAddress);
    const creditAddressObj = this.accounts.find(account => account.address === creditAddress);

    if (debitAddressObj && creditAddressObj) {
        logger.info(`Addresses found: Debit: ${debitAddressObj.address}, Credit: ${creditAddressObj.address}`);
    } else {
        logger.info(`Address(es) not found. 
            Debit address Exists: ${!!debitAddressObj}, Credit address Exists: ${!!creditAddressObj}
            Transaction aborted`);

        const errorObj = {
            Error: `address check failed`,
            DebitAddress: `${!!debitAddressObj} `,
            CreditAddress: `${!!creditAddressObj} `
        }
        return errorObj;
    }

    //check debit address has sufficient funds
    if (debitAddressObj.debitCheck(amount)) {

        //if no checks fail create txn object
        const newTxn = {
            txnID: uuidv4().split('-').join(''),
            debitAddress: debitAddress,
            creditAddress: creditAddress,
            amount: amount
        }
        return newTxn;
    } else {
        logger.info(`debitCheck failed: insufficient funds in ${debitAddressObj.address} `)
        const errorObj = {
            Error: `debitCheck failed: insufficient funds in ${debitAddressObj.address} `
        }
        return errorObj;
    }
}

Blockchain.prototype.addNewTransactionToPendingTransactions = function (transactionObj) {

    //add new transaction to list of pending txns, as it's not yet been validated
    this.pendingTransactions.push(transactionObj);
    //return the index of the block this transaction will get mined in i.e. the next block
    return result;
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
            logger.info(`FAIL: Issue with chain linking.current block prevHash is ${currentBlock['prevBlockHash']}, previous block hash is ${prevBlock['hash']} `);
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

//Methods specific to Blockchain Explorer
Blockchain.prototype.getBlock = BlockChainExplorer.getBlock;
Blockchain.prototype.getTransaction = BlockChainExplorer.getTransaction;
Blockchain.prototype.getAddress = BlockChainExplorer.getAddress;

module.exports = Blockchain;
