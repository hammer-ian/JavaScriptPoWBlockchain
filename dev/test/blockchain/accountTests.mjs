import { expect } from 'chai';

// Import the default export of networkNode.js as an object
import Blockchain from '../../blockchain/blockchain.js';

/**
 * Test cases validating the account logic 
 * 
 */

describe('Blockchain Account Logic', function () {

    //create a new instance of blockchain
    let blockchain;
    before(function () {
        blockchain = new Blockchain('http://localhost:3001'); //not required
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

    });

    describe('Get correct account nonce', () => {

        it('should throw an error if the debit address does not exist', () => {
            const madeUpAddress = 'senderNoExist';
            expect(() => blockchain.getLatestNonce(madeUpAddress), 'did not detect incorrect debitAddress')
                .to.throw(Error, `Account with address ${madeUpAddress} does not exist`);
        });

        it('if debit address exists it should get the latest account nonce', () => {
            expect(blockchain.getLatestNonce(process.env.GENESIS_PRE_MINE_ACC), 'pre-mine account nonce not zero').to.equal(0); //check pre-mine nonce
        });

        it('should get the latest account nonce when there is a pending transaction', () => {

            //add test transaction to pending pool
            blockchain.addNewTransactionToPendingPool({
                txnID: 'testTxnID',
                debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                creditAddress: 'xyz789',
                amount: 100,
                gas: 10,
                nonce: 0
            });
            expect(blockchain.getLatestNonce(process.env.GENESIS_PRE_MINE_ACC), 'account nonce did not take into account pending transactions').to.equal(1); //check pre-mine nonce
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
        it('account nonce incremented correctly', () => {
            const prevNonce = blockchain.getLatestNonce(blockchain.accounts[1].address);
            blockchain.accounts[1].incrementTransactionCount();
            expect(blockchain.accounts[1].nonce, 'Nonce not incremented correctly').to.equal(prevNonce + 1);
        });
        it('account cloned correctly', () => {
            const clonedAccount = blockchain.accounts[1].clone();
            expect(clonedAccount.address, 'Cloned account address is wrong').to.equal(blockchain.accounts[1].address);
            expect(clonedAccount.balance, 'Cloned account balance is wrong').to.equal(blockchain.accounts[1].balance);
            expect(clonedAccount.nonce, 'Cloned account nonce is wrong').to.equal(blockchain.accounts[1].nonce);
        });
    });

});