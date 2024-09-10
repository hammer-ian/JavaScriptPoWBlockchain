//Blockchain methods specific to the Blockchain Explorer

const logger = require('../utils/logger');

function getBlock(blockHashToFind) {

    let correctBlock = null;
    this.chain.forEach(block => {
        if (block.hash === blockHashToFind) correctBlock = block;
    });
    return correctBlock;
}

function getTransaction(transactionId) {
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

function getAddress(addressToFind) {
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

module.exports = {
    getBlock,
    getTransaction,
    getAddress
}
