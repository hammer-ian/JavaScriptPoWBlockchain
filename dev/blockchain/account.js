//Import 3rd Party Modules
const { v4: uuidv4 } = require('uuid');

//Import internal modules
const logger = require('../utils/logger');

class Account {

    //These variables represent the account state and must not be updated by methods outside of Account.js
    constructor(nickname, address, balance, nonce) {
        this.nickname = nickname || ''; //default 
        this.balance = balance || 0; //initial amount for testing
        this.address = address || uuidv4().split('-').join('');
        this.nonce = nonce || 0 //sequential transaction counter to help prevent double spend
    }

    //All changes to account state must be made via an Account method

    setBalance(amount) {
        const prevBalance = this.balance;
        this.balance += amount;
        logger.info(`Act: ${this.address} balance has changed. Prev a/c balance: ${prevBalance} New a/c balance: ${this.balance}`);
    }

    setNickname(nickname) {
        this.nickname = nickname;
    }

    debit(amount) {
        if (this.debitCheck(amount)) {
            this.setBalance(-amount);
            logger.info(`Act: ${this.address}: Debit success`);
            return true;
        } else {
            logger.info(`Act: ${this.address}: Debit failed`);
            return false;
        }
    }

    debitCheck(amount) {
        if (this.balance - amount < 0) {
            logger.info(`Act: ${this.address}: Debit Check Failed: Insuff.Funds, cannot debit ${amount} from ${this.balance}`);
            return false
        } else {
            logger.info(`Act: ${this.address}: Debit Check Passed`);
            return true;
        }
    }

    credit(amount) {
        this.setBalance(amount);
        logger.info(`Act: ${this.address}: Credit success`);
        return true;
    }

    incrementTransactionCount() {
        this.nonce++;
        logger.info(`Act: ${this.address}: Account nonce incremented to ${this.nonce}`);
    }

    //needed for validating the state root when simulating processing a new block
    clone() {
        return new Account(this.nickname, this.address, this.balance, this.nonce);
    }
}

module.exports = Account;