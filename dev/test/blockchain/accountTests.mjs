import { expect } from 'chai';
import { v4 as uuidv4 } from 'uuid';

// Import the default export of networkNode.js as an object
import Blockchain from '../../blockchain/blockchain.js';
import Account from '../../blockchain/account.js';

/**
 * Test cases validating the account logic 
 * 
 */

describe('Blockchain Account Logic', function () {

    //create a new instance of blockchain
    let blockchain, address;
    before(function () {
        blockchain = new Blockchain('http://localhost:3001'); //node hostname not used
        address = uuidv4().split('-').join('');
    })

    beforeEach(function () {
        //not doing anything at the moment
    });

    describe('Create New Account', () => {

        it('should create a new account with the default values', () => {
            blockchain.createNewAccount();
            expect(blockchain.accounts.length, 'New account not created').to.equal(2); //pre-mine account + new account
            expect(blockchain.accounts[1].nickname, 'Default nickname has changed').to.equal('');
            expect(blockchain.accounts[1].balance, 'Default balance is not zero').to.equal(0);
            expect(blockchain.accounts[1].address, 'Default address format is wrong').to.match(/^[a-f0-9]{32}$/);
            expect(blockchain.accounts[1].nonce, 'Default nonce is not zero').to.equal(0);
        });

        it('should create a new account with non default values if values are passed', () => {
            blockchain.accounts.push(new Account('hammer', address, 500, 1));
            expect(blockchain.accounts[2].nickname, 'Nickname is wrong').to.equal('hammer');
            expect(blockchain.accounts[2].address, 'Address is wrong').to.equal(address);
            expect(blockchain.accounts[2].balance, 'Balance is wrong').to.equal(500);
            expect(blockchain.accounts[2].nonce, 'Nonce is wrong').to.equal(1);
        });

        it('should not create a duplicate account', () => {
            const result = blockchain.createNewAccount('DuplicateAccount', address);
            expect(result, 'Duplicate account created').to.equal(null);
        });

    });

    describe('Check Account State', () => {

        it('account balance should be credited correctly', () => {
            blockchain.accounts[1].credit(200);
            expect(blockchain.accounts[1].balance, 'Balance not credited correctly').to.equal(200);
        });

        it('account balance should be debited correctly', () => {
            blockchain.accounts[1].debit(200);
            expect(blockchain.accounts[1].balance, 'Balance not debited correctly').to.equal(0);
        });

        it('account balance cannot go overdrawn', () => {
            expect(blockchain.accounts[1].debit(200), 'Balance has gone overdrawn!').to.equal(false);
        });

        it('account cloned correctly', () => {
            const clonedAccount = blockchain.accounts[1].clone();
            expect(clonedAccount.address, 'Cloned account address is wrong').to.equal(blockchain.accounts[1].address);
            expect(clonedAccount.balance, 'Cloned account balance is wrong').to.equal(blockchain.accounts[1].balance);
            expect(clonedAccount.nonce, 'Cloned account nonce is wrong').to.equal(blockchain.accounts[1].nonce);
        });

        it('account nonce gets incremented correctly', () => {
            const prevNonce = blockchain.getLatestNonce(blockchain.accounts[1].address);
            blockchain.accounts[1].incrementTransactionCount();
            expect(blockchain.accounts[1].nonce, 'Nonce not incremented correctly').to.equal(prevNonce + 1);
        });
    });
});