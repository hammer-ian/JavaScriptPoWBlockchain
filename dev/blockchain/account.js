//Import 3rd Party Modules
const { v4: uuidv4 } = require('uuid');

//Import internal modules
const logger = require('../utils/logger');

class Account {

    //These variables represent the account state and must not be updated by methods outside of Account.js
    constructor(nickname) {
        this.nickname = nickname;
        this.balance = 0; //initial amount for testing
        this.address = uuidv4().split('-').join(''); //create account id  
        this.nonce = 1 //sequential transaction counter to help prevent double spend
    }

    //All changes to account state must be made via an Account method

    setBalance(amount) {
        const prevBalance = this.balance;
        this.balance += amount;
        logger.info(`Act: ${this.accountid} balance has changed. Prev a/c balance: ${prevBalance} New a/c balance: ${this.balance}`);
    }

    debit(amount) {
        if (this.debitCheck(amount)) {
            this.setBalance(-amount);
            logger.info(`Act: ${this.accountid}: Debit success`);
            return true;
        } else {
            logger.info(`Act: ${this.accountid}: Debit failed`);
            return false;
        }
    }

    debitCheck(amount) {
        if (this.balance - amount < 0) {
            logger.info(`Act: ${this.accountid}: Debit Check Failed: Insuff.Funds, cannot debit ${amount} from ${this.balance}`);
            return false
        } else {
            logger.info(`Act: ${this.accountid}: Debit Check Passed`);
            return true;
        }
    }

    credit(amount) {
        this.setBalance(amount);
        logger.info(`Act: ${this.accountid}: Credit success`);
    }

    incrementTransactionCount() {
        this.nonce++;
    }

}

module.exports = Account;