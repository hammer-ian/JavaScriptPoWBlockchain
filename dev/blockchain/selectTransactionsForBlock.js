const logger = require('../utils/logger');

/* 
 Objective is to select the txn with the highest gas fee, 
 Whilst still processing txn's in the correct sequence if there are multiple pending txn for an account
 Prioritize accounts with only a single txn pending so we don't need to worry about the sequence
*/
function selectTransactionsForBlock() {

    logger.info(`Selecting max ${this.maxBlockSize} transactions from pending pool prioritized by gas fee`);

    let blockTransactions = [];

    // Step 1: Group pending transactions by account
    let transactionsByAccount = groupByAccount(this.pendingTransactions);
    logger.info(`Pending transactions grouped by account ${JSON.stringify(transactionsByAccount)}`);

    // Step 2: Identify accounts with 1 transaction
    let singleTxAccounts = filterSingleTransactionAccounts(transactionsByAccount);
    logger.info(`Pending transactions from accounts with only 1 txn pending: ${JSON.stringify(singleTxAccounts)}`);

    //Step 3: single account txns with highest gas
    blockTransactions = singleTxAccounts
        .sort((a, b) => b.gas - a.gas) // Sort by gas in descending order
        .slice(0, this.maxBlockSize); // Copy the txns with the highest gas into the a new array. Block size determines how many txn we want

    //Step 4: if block has space for more txns process multi-txn accounts
    if (blockTransactions.length < this.maxBlockSize) {

        const spaceInBlock = this.maxBlockSize - blockTransactions.length;
        logger.info(`No more single txn accounts, ${spaceInBlock} spots left for multi txn accounts`);

        let multiTxAccounts = filterMultiTransactionAccounts(transactionsByAccount);
        let transactionsToAdd = [];

        for (let address in multiTxAccounts) {
            //sort the txns by nonce in the each multi txn account
            let accountTxns = multiTxAccounts[address].sort((a, b) => a.nonce - b.nonce);

            for (let txn of accountTxns) {
                //break TXN loop. if there are no more spots we do not need to process more TXNs
                if (transactionsToAdd.length >= spaceInBlock) {
                    break;
                }
                transactionsToAdd.push(txn);
            }
            //break ACCOUNT loop. if there are no more spots we do not need to process more ACCOUNTS
            if (transactionsToAdd.length >= spaceInBlock) {
                break;
            }
        }
        logger.info(`Adding to block: ${JSON.stringify(transactionsToAdd)}`);
        blockTransactions.push(...transactionsToAdd);
    }
    logger.info(`Transactions selected for block: ${JSON.stringify(blockTransactions)}`);
    return blockTransactions;

    function groupByAccount(pendingTransactions) {
        // Create an object to hold the grouped transactions
        let transactionsByAccount = {};

        // Iterate through all pending transactions
        for (let tx of pendingTransactions) {
            // Get the account debit address from the transaction
            let debitAddress = tx.debitAddress;

            // If this is the first time we've seen this account, create an empty array for it
            if (!transactionsByAccount[debitAddress]) {
                transactionsByAccount[debitAddress] = [];
            }
            // Push the transaction into the array for this account
            transactionsByAccount[debitAddress].push(tx);
        }
        return transactionsByAccount;
    }
    function filterSingleTransactionAccounts(transactionsByAccount) {
        let singleTxAccounts = [];

        // Iterate over each debit address in the transactionsByAccount object
        for (let debitAddress in transactionsByAccount) {
            // Check if this account has exactly one pending transaction
            if (transactionsByAccount[debitAddress].length === 1) {
                // Push the single transaction into the result array
                singleTxAccounts.push(transactionsByAccount[debitAddress][0]);
            }
        }
        return singleTxAccounts;
    }
    function filterMultiTransactionAccounts(transactionsByAccount) {
        let multiTxAccounts = {};

        // Iterate over each account in the transactionsByAccount object
        for (let account in transactionsByAccount) {
            // Check if this account has more than one pending transaction
            if (transactionsByAccount[account].length > 1) {
                // Add the account and its transactions to the result object
                multiTxAccounts[account] = transactionsByAccount[account];
            }
        }
        return multiTxAccounts;
    }

}

module.exports = {
    selectTransactionsForBlock
}