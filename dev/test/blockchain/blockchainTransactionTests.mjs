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

        const gas = 10;
        const amount = 100;
        const nonce = 0;
        const systemDebitAddress = 'system'

        //start with happy path as if called from createTransaction (no nonce)
        it('should return true if there are no validation errors when called WITHOUT a nonce', () => {
            const resultObj = blockchain.validateTransaction(process.env.GENESIS_PRE_MINE_ACC, amount, gas);
            expect(resultObj.ValidTxn, 'valid txn but returned !true').to.equal(true);
            expect(resultObj.Error, 'valid txn but Error returned !null').to.equal(null);
        });

        //start with happy path as if called from processSelectedTransactions (nonce)
        it('should return true if there are no validation errors when called WITH a nonce', () => {
            const resultObj = blockchain.validateTransaction(process.env.GENESIS_PRE_MINE_ACC, amount, gas, nonce);
            expect(resultObj.ValidTxn, 'valid txn but returned !true').to.equal(true);
            expect(resultObj.Error, 'valid txn but Error returned !null').to.equal(null);
        });

        //check block reward is correct
        it('should return true for block rewards if system debit address and amount is correct', () => {
            const resultObj = blockchain.validateTransaction(systemDebitAddress, blockchain.blockRewardAmount);
            expect(resultObj.ValidTxn, 'valid block reward but returned !true').to.equal(true);
            expect(resultObj.Error, 'valid block reward but Error returned !null').to.equal(null);
        });

        //fail if block reward is incorrect
        it('should fail if block reward and amount is INCORRECT', () => {
            const resultObj = blockchain.validateTransaction(systemDebitAddress, blockchain.blockRewardAmount - 10);
            expect(resultObj.ValidTxn, 'incorrect block reward but returned !false').to.equal(false);
            expect(resultObj.Error, 'incorrect block reward but Error incorrect').to.include('block reward is not correct');
            expect(resultObj.Details, 'error details returned incorrect: TxnBlockReward').to.have.property('TxnBlockReward').that.equals(blockchain.blockRewardAmount - 10);
            expect(resultObj.Details, 'error details returned incorrect: CorrectBlockReward').to.have.property('CorrectBlockReward').that.equals(blockchain.blockRewardAmount);
        });

        //fail if debit account address does not exist
        it('should fail if debit account address does not exist', () => {
            const resultObj = blockchain.validateTransaction(debitAddress, amount, gas);
            expect(resultObj.ValidTxn, 'debit address does not exist but returned !false').to.equal(false);
            expect(resultObj.Error, 'debit address does not exist but Error incorrect').to.include('address check failed');
            expect(resultObj.Details, 'error details returned incorrect: DebitAddress').to.have.property('DebitAddress').that.equals(false);
        });

        //fail if debit account address does not have sufficient funds
        it('should fail if debit account has insufficient funds', () => {
            //make sure amount is greater than account balance
            const resultObj = blockchain.validateTransaction(process.env.GENESIS_PRE_MINE_ACC, amount + 1000, gas);
            //get account object using address so we can access account balance
            const genesisAddressAcc = blockchain.accounts.find(account => account.address === process.env.GENESIS_PRE_MINE_ACC);

            expect(resultObj.ValidTxn, 'insufficient funds but returned !false').to.equal(false);
            expect(resultObj.Error, 'insufficient funds but Error incorrect').to.include('debitCheck failed: insufficient funds');
            expect(resultObj.Details, 'error details returned incorrect: DebitAmount').to.have.property('DebitAmount').that.equals(amount + 1000);
            expect(resultObj.Details, 'error details returned incorrect: Gas').to.have.property('Gas').that.equals(gas);
            expect(resultObj.Details, 'error details returned incorrect: TotalDebit').to.have.property('TotalDebit').that.equals(amount + 1000 + gas);
            expect(resultObj.Details, 'error details returned incorrect: DebitAccBalance').to.have.property('DebitAccBalance').that.equals(genesisAddressAcc.balance);
        });

        //should fail if called from processSelectedTransactions and nonce is wrong
        it('should fail if nonce is wrong', () => {
            const nonce = 5; //wrong
            const resultObj = blockchain.validateTransaction(process.env.GENESIS_PRE_MINE_ACC, amount, gas, nonce);
            //get account object using address so we can access account nonce
            const genesisAddressAcc = blockchain.accounts.find(account => account.address === process.env.GENESIS_PRE_MINE_ACC);

            expect(resultObj.ValidTxn, 'nonce incorrect but returned !false').to.equal(false);
            expect(resultObj.Error, 'nonce incorrect but Error incorrect').to.include('nonce check failed during Txn validation');
            expect(resultObj.Details, 'error details returned incorrect: txnNonce').to.have.property('txnNonce').that.equals(nonce);
            expect(resultObj.Details, 'error details returned incorrect: debitAccNonce').to.have.property('debitAccNonce').that.equals(genesisAddressAcc.nonce);

        });
    });

});