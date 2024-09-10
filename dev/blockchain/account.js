//Import 3rd Party Modules
const { v4: uuidv4 } = require('uuid');

//Import internal modules
const logger = require('../utils/logger');
const Blockchain = require('./blockchain');

class Account {

    constructor(blockchain) {
        this.balance = 0; //initial amount
        this.accountid = uuidv4().split('-').join(''); //create account id  
    }

    //private methods "#"
    #setBalance(amount) {
        const prevBalance = this.balance;
        this.balance += amount;
        logger.info(`Act: ${this.accountid} : Balance updated from:${prevBalance} to:${this.balance}`);
    }

    debit(amount) {
        if (this.debitCheck(amount)) {
            this.#setBalance(-amount);
            logger.info(`Act: ${this.accountid}: Debit success`);
            return true;
        } else {
            logger.info(`Act: ${this.accountid}: Debit failed`);
            return false;
        }
    }

    getBalance() {
        return this.balance;
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
        this.#setBalance(amount);
        logger.info(`Act: ${this.accountid}: Credit success`);
    }

}