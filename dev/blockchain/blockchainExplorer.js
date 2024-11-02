//Blockchain methods specific to the Blockchain Explorer

const logger = require('../utils/logger');

function getBlock(blockHashToFind) {
    logger.info(`Searching for block: ${blockHashToFind}`);
    let correctBlock = null;
    this.chain.forEach(block => {
        if (block.hash === blockHashToFind) correctBlock = block;
    });
    return correctBlock;
}

function getTransaction(transactionId) {
    logger.info(`Searching for transaction: ${transactionId}`);
    let correctBlock = null;
    let correctTransaction = null;

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

function getAddress(addressToFind) {
    logger.info(`Searching for transactions associated with address: ${addressToFind}`);
    const matchingTransactions = [];
    let addressBalance = 0;
    this.chain.forEach(block => {
        block.transactions.forEach(transaction => {
            logger.info(transaction.debitAddress, " ", transaction.creditAddress, " ", addressToFind)
            if ((transaction.creditAddress === addressToFind) || (transaction.debitAddress === addressToFind)) {
                matchingTransactions.push(transaction);

                //now calculate address balance
                if (transaction.creditAddress === addressToFind) addressBalance += transaction.amount;
                if (transaction.debitAddress == addressToFind) addressBalance -= transaction.amount;
            };
        });
    });
    return {
        addressBalance: addressBalance,
        addressTransactions: matchingTransactions
    };
}

module.exports = {
    getBlock,
    getTransaction,
    getAddress
}
