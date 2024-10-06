import { expect } from 'chai';
import sinon, { expectation } from 'sinon';
import { v4 as uuidv4 } from 'uuid';

// Import the default export of networkNode.js as an object
import Blockchain from '../../blockchain/blockchain.js';
import Account from '../../blockchain/account.js';

/**
 * Test cases for the blockchain mine() logic. Mine() itself doesn't contain much logic
 * 
 * So first test all helper functions independently
 * 
 * Then do an integration test for mine() + helper logic
 * 
 */

describe('Blockchain Mine New Block Logic', function () {

    //create a new instance of blockchain
    let blockchain, minerAddress, creditAddress, debitAddress1, debitAddress2, debitAddress3
    before(function () {
        blockchain = new Blockchain('http://localhost:3001'); //node hostname not used
        //for these tests override max block size to be 2 txns
        blockchain.maxBlockSize = 2;

        //create random addresses for test transactions, to avoid clashing with other unit tests
        minerAddress = uuidv4().split('-').join('');
        creditAddress = uuidv4().split('-').join('');
        debitAddress1 = uuidv4().split('-').join('');
        debitAddress2 = uuidv4().split('-').join('');
        debitAddress3 = uuidv4().split('-').join('');
    })

    describe('Get the hash of the previous block', () => {
        it('should retrieve hash of previous block', () => {
            const lastBlockHash = blockchain.getLastBlock()['hash'];
            const tmplastBlockHash = blockchain.chain[blockchain.chain.length - 1]['hash'];
            expect(tmplastBlockHash, 'last blocks hash not correct').to.equal(lastBlockHash);
        });
    });

    describe('Select transactions for block', () => {

        beforeEach(() => {
            /*
            * Add 6 test transactions to pending pool, a mix of single txn accounts, and multi txn accounts
            * 3 txns in one account to test nonce sorting (lowest nonce first)
            * 3 single txn accounts to test gas sorting (highest gas first)
            * Single txn accounts should be selected first so miner makes more money from gas fees
            * 
            * Helper sorting methods are tested via integration tests (i.e. called indirectly)
            */
            blockchain.addNewTransactionToPendingPool({
                txnID: 'testTxnID1',
                debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                creditAddress: creditAddress,
                amount: 100,
                gas: 10,
                nonce: 0
            });
            blockchain.addNewTransactionToPendingPool({
                txnID: 'testTxnID2',
                debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                creditAddress: creditAddress,
                amount: 100,
                gas: 10,
                nonce: 1
            });
            blockchain.addNewTransactionToPendingPool({
                txnID: 'testTxnID3',
                debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                creditAddress: creditAddress,
                amount: 100,
                gas: 10,
                nonce: 2
            });
            blockchain.addNewTransactionToPendingPool({
                txnID: 'testTxnID4',
                debitAddress: debitAddress1,
                creditAddress: creditAddress,
                amount: 100,
                gas: 100,
                nonce: 0
            });
            blockchain.addNewTransactionToPendingPool({
                txnID: 'testTxnID5',
                debitAddress: debitAddress2,
                creditAddress: creditAddress,
                amount: 100,
                gas: 10,
                nonce: 0
            });
            blockchain.addNewTransactionToPendingPool({
                txnID: 'testTxnID6',
                debitAddress: debitAddress3,
                creditAddress: creditAddress,
                amount: 100,
                gas: 1,
                nonce: 0
            });
        });

        afterEach(() => {
            // Reset the pending transactions
            blockchain.pendingTransactions = [];
        });

        //single txn accounts with the highest gas should be selected first
        it('should return an array of 2 txns, both single txn accounts with highest gas', () => {
            const txnList = blockchain.selectTransactionsForBlock();
            expect(txnList.length, 'wrong number of transactions selected').to.equal(blockchain.maxBlockSize);
            expect(txnList[0].gas, 'highest gas not selected first').to.equal(100);
            expect(txnList[1].gas, 'second highest gas not selected second').to.equal(10);
        });

        it('should return an array of 2 txns, both multi txn accounts with lowest nonces', () => {

            //Remove single txn accounts so we can test multi txn accounts
            const txnsToRemove = [
                { txnID: 'testTxnID4' }, { txnID: 'testTxnID5' }, { txnID: 'testTxnID6' }
            ];
            //remove single txn accounts from pending pool so we can test multi txn accounts
            txnsToRemove.forEach(txn => {
                const index = blockchain.pendingTransactions.findIndex(t => t.txnID === txn.txnID);
                if (index !== -1) {
                    blockchain.pendingTransactions.splice(index, 1);
                }
            });

            const results = blockchain.selectTransactionsForBlock();
            expect(results.length, 'wrong number of transactions selected').to.equal(blockchain.maxBlockSize);
            expect(results[0].nonce, 'lowest nonce not selected first').to.equal(0);
            expect(results[1].nonce, 'second lowest nonce not selected second').to.equal(1);
        });

        it('should return an array of 2 txns, 1 single txn account, 1 multi txn account', () => {

            const txnsToRemove = [
                { txnID: 'testTxnID5' }, { txnID: 'testTxnID6' }
            ];
            txnsToRemove.forEach(txn => {
                const index = blockchain.pendingTransactions.findIndex(t => t.txnID === txn.txnID);
                if (index !== -1) {
                    blockchain.pendingTransactions.splice(index, 1);
                }
            });
            const results = blockchain.selectTransactionsForBlock();
            expect(results.length, 'wrong number of transactions selected').to.equal(blockchain.maxBlockSize);
            expect(results[0].txnID, 'lowest nonce not selected first').to.equal('testTxnID4'); //single txn acc, highest gas
            expect(results[1].nonce, 'second lowest nonce not selected second').to.equal(0); //multi txn acc, lowest nonce
        });

        it('should return no transactions if the pending pool is empty', () => {

            blockchain.pendingTransactions = [];
            const results = blockchain.selectTransactionsForBlock();
            expect(results.length, 'should be no txns selected').to.equal(0);
        });
    });

    describe('Create block reward transaction', () => {

        it('should return a valid block reward txn ', () => {

            const blockRewardTxn = blockchain.createBlockReward(minerAddress);
            expect(blockRewardTxn.txnID, 'txn id format is wrong').to.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
            expect(blockRewardTxn.debitAddress, 'debitAddress should be system').to.equal('system');
            expect(blockRewardTxn.creditAddress, 'creditAddress should be minerAddress').to.equal(minerAddress);
            expect(blockRewardTxn.amount, 'block reward amount is wrong').to.equal(blockchain.blockRewardAmount);
        });
    });

    describe('Process transactions selected for block to update blockchain state', () => {

        let txnList = [];
        let validateTxnStub;
        beforeEach(() => {
            validateTxnStub = sinon.stub(blockchain, 'validateTransaction').returns({
                ValidTxn: true,
                Error: null,
                Details: {}
            });
            txnList.push(
                {
                    txnID: 'testTxnID1',
                    debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                    creditAddress: creditAddress,
                    amount: 100,
                    gas: 10,
                    nonce: 0
                },
                {
                    txnID: 'testTxnID2',
                    debitAddress: process.env.GENESIS_PRE_MINE_ACC,
                    creditAddress: creditAddress,
                    amount: 100,
                    gas: 10,
                    nonce: 1
                },
                {
                    txnID: 'testBlockReward',
                    debitAddress: 'system',
                    creditAddress: minerAddress,
                    amount: blockchain.blockRewardAmount
                }
            );
        });
        afterEach(() => {
            // Reset txnList
            txnList = [];
            validateTxnStub.restore();
            //reset debit account nonce
            const debitAddressAcc = blockchain.accounts.find(account => account.address === process.env.GENESIS_PRE_MINE_ACC);
            debitAddressAcc.nonce = 0;

        });

        it('should update account state and return 3 successfully processed transactions', () => {

            //remove stub as we want to test full happy path
            validateTxnStub.restore();

            const processedListObj = blockchain.processSelectedTransactions(txnList, minerAddress);
            //retrieve account objects for debit, credit, and miner addresses
            const debitAddressAcc = blockchain.accounts.find(account => account.address === process.env.GENESIS_PRE_MINE_ACC);
            const creditAddressAcc = blockchain.accounts.find(account => account.address === creditAddress);
            const minerAddrAcc = blockchain.accounts.find(account => account.address === minerAddress);

            //make sure new accounts created successfully
            const accountsCreated = creditAddressAcc && minerAddrAcc ? true : false;
            expect(accountsCreated, 'accounts not created for new credit addresses').to.equal(true);

            //make sure debit/credits successful
            expect(debitAddressAcc.balance, 'GENESIS_PRE_MINE_ACC balance incorrectly debited').to.equal(780); //debited amount + gas x2
            expect(creditAddressAcc.balance, 'creditAddressAcc balance incorrectly credited').to.equal(200); //credited amount x2
            expect(minerAddrAcc.balance, 'creditAddressAcc balance incorrectly credited').to.equal(32.5); //credited gas x2 + block reward

            //make sure debit account nonce incremented correctly
            expect(debitAddressAcc.nonce, 'GENESIS_PRE_MINE_ACC nonce incorrectly incremented').to.equal(2);

            //make sure we return the processed txn list
            expect(processedListObj.processedList.length, 'less txns processed than expected').to.equal(3);
        });

        it('for end user txn, fail txn if txn nonce out of sequence', () => {
            //by changing the nonce of the 1st txn (txn nonce = 0) for the pre-mine account (account nonce = 0)
            //we should invalidate both end user txns pending for the account (2nd txn nonce now also out of sequence)
            //block reward should also not be processed
            txnList[0].nonce = 5;
            const processedListObj = blockchain.processSelectedTransactions(txnList, minerAddress);
            expect(processedListObj.processedList.length, 'no txn should be successful').to.equal(0);
            expect(processedListObj.errorList.length, 'only 2 txn should fail').to.equal(2);
            expect(processedListObj.errorList[0].failureReason, 'failure reason not nonce failure').to.include('Issue with sequencing. Txn nonce');
            expect(processedListObj.errorList[1].failureReason, 'failure reason not nonce failure').to.include('Issue with sequencing. Txn nonce');
        });

        it('for end user txn, fail txn if debit check fails', () => {

            const debitStub = sinon.stub(Account.prototype, 'debit').returns(false);

            const processedListObj = blockchain.processSelectedTransactions(txnList, minerAddress);
            expect(processedListObj.processedList.length, 'no txn should be successful').to.equal(0);
            //1st failure due to failed debit check, 2nd failure due to incorrect nonce sequencing after 1st txn failed
            expect(processedListObj.errorList.length, 'only 2 txn should fail').to.equal(2);
            expect(processedListObj.errorList[0].failureReason, 'failure reason not debit failure').to.include('Debit check failed');
            expect(processedListObj.errorList[1].failureReason, 'failure reason not nonce failure').to.include('Issue with sequencing');

            // Restore the original method after the test
            debitStub.restore();
        });
    });
});