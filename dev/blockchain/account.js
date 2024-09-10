//Import 3rd Party Modules
const { v4: uuidv4 } = require('uuid');

//Import internal modules
const logger = require('../utils/logger');

class Account {

    constructor(nickname) {
        this.nickname = nickname;
        this.balance = 0; //initial amount
        this.address = uuidv4().split('-').join(''); //create account id  
    }

    //private methods "#"
    #setBalance(amount) {
        const prevBalance = this.balance;
        this.balance += amount;
        logger.info(`Act: ${this.accountid} : Balance updated from:${prevBalance} to:${this.balance}`);
    }

    getBalance() {
        return this.balance;
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

module.exports = Account;