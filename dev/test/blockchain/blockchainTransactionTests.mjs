import { expect } from 'chai';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';

// Import the default export of networkNode.js as an object
import Blockchain from '../../blockchain/blockchain.js';

/**
 * Test cases validating the blockchain create transaction logic 
 * 
 * Blockchain consensus, explorer, mining will be seperated into other test modules
 */

describe('Blockchain Create Transaction Business Logic', function () {

    //create a new instance of blockchain
    let blockchain, debitAddress, creditAddress;
    before(function () {
        blockchain = new Blockchain('http://localhost:3001'); //node hostname not used
        //create random addresses for test transactions, to avoid clashing with other unit tests
        debitAddress = uuidv4().split('-').join('');
        creditAddress = uuidv4().split('-').join('');
    })

    describe('Create instance of Blockchain', () => {

        it('should create a new instance of a blockchain', () => {

            //create new instance of Blockchain
            expect(blockchain.chain.length, 'Genesis block not created').to.equal(1); //check genesis block created
            expect(blockchain.chain[0].hash, 'Genesis hash incorrect').to.equal('genesisHash'); //check genesis block hash
            expect(blockchain.accounts.length, 'Pre-mine account not created').to.equal(1) //pre-mine account
            expect(blockchain.networkNodes.length, 'networkNodes[] should be empty').to.equal(0) //check no pre-registered nodes
            expect(blockchain.maxBlockSize, 'block size is different from .env setting').to.equal(parseInt(process.env.MAX_BLOCK_SIZE)) //pre-mine account balance
            expect(blockchain.blockRewardAmount, 'block reward is different from .env setting').to.equal(parseFloat(process.env.BLOCK_REWARD)) //pre-mine account balance
        });

    });

    describe('Get correct account nonce', () => {

        it('should throw an error if the debit address does not exist', () => {
            expect(() => blockchain.getLatestNonce(debitAddress), 'did not detect incorrect debitAddress')
                .to.throw(Error, `Account with address ${debitAddress} does not exist`);
        });

        it('if debit address exists it should get the latest account nonce', () => {
            expect(blockchain.getLatestNonce(process.env.GENESIS_PRE_MINE_ACC), 'pre-mine account nonce not zero').to.equal(0); //check pre-mine nonce
        });

        it('should get the latest account nonce when there are pending transactions', () => {
            const pendingTxnNonce = 5;
            //add 2 test transactions to pending pool with difference nonce's
            blockchain.addNewTransactionToPendingPool({
                txnID: 'testTxnID1',
                debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                creditAddress: creditAddress,
                amount: 100,
                gas: 10,
                nonce: pendingTxnNonce
            });
            blockchain.addNewTransactionToPendingPool({
                txnID: 'testTxnID2',
                debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                creditAddress: creditAddress,
                amount: 100,
                gas: 10,
                nonce: pendingTxnNonce - 1
            });
            expect(blockchain.getLatestNonce(process.env.GENESIS_PRE_MINE_ACC), 'account nonce did not take into account pending transactions')
                .to.equal(pendingTxnNonce + 1); //latest nonce should always be +1 on the max nonce in pending pool
        });
    });

    describe('Create new transaction', () => {
        let getLatestNonceStub, validateTxnStub;
        beforeEach(() => {
            // Stub call to get nonce
            getLatestNonceStub = sinon.stub(blockchain, 'getLatestNonce').returns(1);
            // Stub call to get validate transactions
            validateTxnStub = sinon.stub(blockchain, 'validateTransaction').returns({
                ValidTxn: true,
                Error: null,
                Details: {}
            });
        });

        afterEach(() => {
            // Restore the stub after each test
            getLatestNonceStub.restore();
            validateTxnStub.restore();
        });

        it('should return a valid new txn object and add txn to pending pool', () => {

            const pendingTxns = blockchain.pendingTransactions.length;
            //check txn object returned has valid properties
            const txnObj = blockchain.createNewTransaction(
                debitAddress,
                creditAddress,
                100, //txn amount
                10 //gas
            );
            expect(txnObj.txnID, 'debit address is incorrect').to.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
            expect(txnObj.debitAddress, 'debit address is incorrect').to.equal(debitAddress);
            expect(txnObj.creditAddress, 'credit address is incorrect').to.equal(creditAddress);
            expect(txnObj.amount, 'amount is incorrect').to.equal(100);
            expect(txnObj.gas, 'gas is incorrect').to.equal(10);
            expect(txnObj.nonce, 'nonce is incorrect').to.equal(1);
            expect(blockchain.pendingTransactions.length, 'issue adding txn to pending transaction pool').to.equal(pendingTxns + 1);
        });

        it('should gracefully return validation errors and NOT add txn to pending pool', () => {
            const pendingTxns = blockchain.pendingTransactions.length;
            //remove validation stub so txn validation fails
            validateTxnStub.restore();
            const resultObj = blockchain.createNewTransaction(
                debitAddress, //address should not exist, validation will fail
                creditAddress,
                9999, //txn amount
                10 //gas
            );
            expect(resultObj.ValidTxn, 'txn should not be flagged as valid').to.equal(false);
            expect(blockchain.pendingTransactions.length, 'txn should not be added to pending transaction pool').to.equal(pendingTxns);
        });
    });

    describe('Validate transaction', () => {

        it('should validate a transaction object', () => {

        });
    });

});