import { expect } from 'chai';
import sinon, { expectation } from 'sinon';

// Import the default export of networkNode.js as an object
import Blockchain from '../../blockchain/blockchain.js';
import Account from '../../blockchain/account.js';

//test data
import { getTestPendingTransactionData } from '../testData.mjs';
import { minerAddress, creditAddress, debitAddressPreMine } from '../testData.mjs';

/**
 * Test cases for the blockchain mine() logic. Mine() itself doesn't contain much logic
 * 
 * So first test all helper functions independently
 * 
 * Then do an integration test for mine() + helper logic
 * 
 */

describe('Blockchain mine new block logic and helper methods', function () {

    //create a new instance of blockchain
    let blockchain, lastBlockHash
    beforeEach(function () {
        blockchain = new Blockchain('http://localhost:3001'); //node hostname not used
        //for these tests override max block size to be 2 txns
        blockchain.maxBlockSize = 2;

        //retrieve here so we can use in multiple tests
        lastBlockHash = blockchain.getLastBlock()['hash'];
    })

    describe('Testing Mine logic all helper methods stubbed', () => {

        let selectTxnStub, processedListStub;
        beforeEach(() => {
            selectTxnStub = sinon.stub(blockchain, 'selectTransactionsForBlock').returns(
                [{ txnID: 'testTxnID1' }, { txnID: 'testTxnID2' }]
            );
            sinon.stub(blockchain, 'createBlockReward').returns({ blockreward: 'blockreward' });
            processedListStub = sinon.stub(blockchain, 'processSelectedTransactions').returns(
                { 'processedList': ['txn1', 'txn2'] }
            );
            sinon.stub(blockchain, 'getMerkleRoot').returns('merkleRootHash');
            sinon.stub(blockchain, 'getStateRoot').returns('stateRootHash');
            sinon.stub(blockchain, 'proofOfWork').returns(12345); //random nonce
            sinon.stub(blockchain, 'hashBlockData').returns('blockhash');
            sinon.stub(blockchain, 'createNewBlock').returns({ newBlockObj: 'newblock' });
        });

        afterEach(() => {
            // Reset all stubs
            sinon.restore();
        });

        it('should return true if a new block is successfully mined', () => {
            const result = blockchain.mine(minerAddress);
            expect(result.ValidBlock, 'valid block not set to true').to.equal(true);
            expect(result.Error, 'Error property not set to null').to.equal(null);
        });

        it('should return an error if no eligible transactions are selected', () => {
            selectTxnStub.restore();
            const result = blockchain.mine(minerAddress);
            expect(result.Error, 'valid block not set to true').to.equal('No eligible transactions identified for new block');
            expect(result.ValidBlock, 'valid block not set to false').to.equal(false);
        });

        it('should return an error if insufficient txns are processed successfully', () => {
            processedListStub.restore();
            sinon.stub(blockchain, 'processSelectedTransactions').returns(
                { 'processedList': [] }
            );
            const result = blockchain.mine(minerAddress);
            expect(result.Error, 'valid block not set to true').to.include('Issue with processing transactions selected for block');
            expect(result.ValidBlock, 'valid block not set to false').to.equal(false);
        });

    });
    describe('Get the hash of the previous block', () => {
        it('should retrieve hash of previous block', () => {
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
            * */

            blockchain.pendingTransactions = getTestPendingTransactionData();
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
        let debitAddressAcc;
        beforeEach(() => {
            debitAddressAcc = blockchain.accounts.find(account => account.address === debitAddressPreMine);
            validateTxnStub = sinon.stub(blockchain, 'validateTransaction').returns({
                ValidTxn: true,
                Error: null,
                Details: {}
            });
            txnList.push(getTestPendingTransactionData()[0]);
            txnList.push(getTestPendingTransactionData()[1]);
            txnList.push({
                txnID: 'testBlockReward',
                debitAddress: 'system',
                creditAddress: minerAddress,
                amount: blockchain.blockRewardAmount
            });
        });
        afterEach(() => {
            // Reset txnList
            txnList = [];
            sinon.restore();
            //reset debit account nonce
            debitAddressAcc.nonce = 0;

        });

        it('should update account state and return 3 successfully processed transactions', () => {

            //remove stub as we want to test full happy path
            validateTxnStub.restore();

            const processedListObj = blockchain.processSelectedTransactions(txnList, minerAddress);
            //retrieve account objects for debit, credit
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
            expect(processedListObj.processedList[0].txnID, 'txnID returned is wrong').to.equal('testTxnID1');
            expect(processedListObj.processedList[1].txnID, 'txnID returned is wrong').to.equal('testTxnID2');
            expect(processedListObj.processedList[2].txnID, 'txnID returned is wrong').to.equal('testBlockReward');
        });

        it('should only update state for cloned Account list (if one is passed)', () => {

            //clone account list
            let cloneAccountList = [];
            cloneAccountList = blockchain.createClonedAccountList(txnList);

            //process txns of CLONED account list, so the global state should not change
            const processedListObj = blockchain.processSelectedTransactions(txnList, minerAddress, cloneAccountList);

            //check state of cloned accounts updated correctly. Note account state was cloned from state after previous test
            const creditAddressAccClone = cloneAccountList.find(account => account.address === creditAddress);
            const minerAddrAccClone = cloneAccountList.find(account => account.address === minerAddress);
            const debitAddressAccClone = cloneAccountList.find(account => account.address === debitAddressPreMine);
            expect(debitAddressAccClone.balance, 'cloned GENESIS_PRE_MINE_ACC balance incorrectly debited').to.equal(780); //debited amount + gas x2
            expect(creditAddressAccClone.balance, 'cloned creditAddressAcc balance incorrectly credited').to.equal(200); //credited amount x2
            expect(minerAddrAccClone.balance, 'cloned creditAddressAcc balance incorrectly credited').to.equal(32.5); //credited gas x2 + block reward

            //check real account state not updated from previous test
            const creditAddressAcc = blockchain.accounts.find(account => account.address === creditAddress);
            const minerAddrAcc = blockchain.accounts.find(account => account.address === minerAddress);
            expect(debitAddressAcc.balance, 'GENESIS_PRE_MINE_ACC balance incorrectly debited').to.equal(1000); //no change
            expect(creditAddressAcc, 'creditAddressAcc should not have been created').to.be.undefined;  //no change
            expect(minerAddrAcc, 'minderAddrAcc should not have been created').to.be.undefined;  //no change

        });

        it('for end user txn, fail txn if txn nonce out of sequence', () => {
            //by changing the nonce of the 1st txn (txn nonce = 0) for the pre-mine account (account nonce = 0)
            //we should invalidate both end user txns pending for the account (2nd txn nonce now also out of sequence)
            //block reward should also not be processed
            txnList[0].nonce = 5;
            const minerAddrAcc = blockchain.accounts.find(account => account.address === minerAddress);

            const processedListObj = blockchain.processSelectedTransactions(txnList, minerAddress);
            expect(processedListObj.processedList.length, 'no txn should be successful').to.equal(0);
            expect(processedListObj.errorList.length, 'only 2 txn should fail').to.equal(2);
            expect(processedListObj.errorList[0].failureReason, 'failure reason not nonce failure').to.include('Issue with sequencing. Txn nonce');
            expect(processedListObj.errorList[1].failureReason, 'failure reason not nonce failure').to.include('Issue with sequencing. Txn nonce');
            expect(minerAddrAcc, 'minderAddrAcc should not have been created').to.be.undefined;  //no change
        });

        it('for end user txn, fail txn if debit check fails', () => {

            const debitStub = sinon.stub(Account.prototype, 'debit').returns(false);
            const minerAddrAcc = blockchain.accounts.find(account => account.address === minerAddress);

            const processedListObj = blockchain.processSelectedTransactions(txnList, minerAddress);
            expect(processedListObj.processedList.length, 'no txn should be successful').to.equal(0);
            //1st failure due to failed debit check, 2nd failure due to incorrect nonce sequencing after 1st txn failed
            expect(processedListObj.errorList.length, 'only 2 txn should fail').to.equal(2);
            expect(processedListObj.errorList[0].failureReason, 'failure reason not debit failure').to.include('Debit check failed');
            expect(minerAddrAcc, 'minderAddrAcc should not have been created').to.be.undefined;  //no change

            // Restore the original method after the test
            debitStub.restore();
        });

        it('for end user txn, fail txn if re-validation check fails', () => {

            validateTxnStub.restore();
            sinon.stub(blockchain, 'validateTransaction').returns({ ValidTxn: false });
            const minerAddrAcc = blockchain.accounts.find(account => account.address === minerAddress);

            const processedListObj = blockchain.processSelectedTransactions(txnList, minerAddress);
            expect(processedListObj.errorList.length, 'only 2 txn should fail').to.equal(2);
            expect(processedListObj.errorList[0].failureReason, 'failure reason not re-validation error').to.include('Re-validation failed');
            expect(processedListObj.errorList[1].failureReason, 'failure reason not re-validation error').to.include('Re-validation failed');
            expect(minerAddrAcc, 'minderAddrAcc should not have been created').to.be.undefined;  //no change
        });

    });

    describe('Create correct hashes and new block', () => {

        let processedTxnList = [];
        let blockHash, blockNonce, merkleRootHash, stateRootHash;
        before(() => {

            //pre-set hash value based on processed txn list data. if txn list modified, need to also update hash
            merkleRootHash = '7c630a02c0d56db43c7d7ad14ac4e1ed4c63bdc7bb5f15edb0f93d067180e9de';
            //pre-set hash value based on processed account list data. if account list modified, need to also update hash
            stateRootHash = '485e46e462cdad94da43c4c5c8d7031fc36fec59d214c5bbf789cbdf6669bbb6';
            //pre computed using lastBlockHash and processedTxnList and nonce = 0
            blockNonce = 104432;
            //pre computed using lastBlockHash, processedTxnList and nonce
            blockHash = '0000b8ee21ef41cc8df1be0dbffd65fd84155a06715a5410ee377c4c9179bc70';

        });

        beforeEach(() => {

            processedTxnList.push(getTestPendingTransactionData()[0]);
            processedTxnList.push(getTestPendingTransactionData()[1]);
            processedTxnList.push({
                txnID: 'testBlockReward',
                debitAddress: 'system',
                creditAddress: minerAddress,
                amount: blockchain.blockRewardAmount
            });
        });
        afterEach(() => {
            // Reset txnList
            processedTxnList = [];

        });

        it('create Merkle tree root hash using processed txn list', () => {

            const returnedHash = blockchain.getMerkleRoot(processedTxnList);
            expect(returnedHash, 'txn hash is wrong').to.equal(merkleRootHash);
        });

        it('create State tree root hash using account list', () => {

            const returnedHash = blockchain.getStateRoot(blockchain.accounts);
            expect(returnedHash, 'account hash is wrong').to.equal(stateRootHash);
        });

        it('do proof of work using prevBlockHash and processed txn list', () => {

            //call blockchain to compare result
            const returnedNonce = blockchain.proofOfWork(lastBlockHash, processedTxnList, 0)
            expect(returnedNonce, 'nonce is wrong').to.equal(blockNonce);
        });

        it('hash block data using prevBlockHash, processed txn list, and proof of work nonce', () => {

            //call blockchain to compare result
            const returnedHash = blockchain.hashBlockData(lastBlockHash, processedTxnList, 104432)
            expect(returnedHash, 'block hash is wrong').to.equal(blockHash);
        });

        it('finally create new block using the hashes we have created, and processed txn list', () => {

            //add processed txns to pending pool so we can check they are removed when block is created
            //this sequence is wrong (txns would normally have to be in the pending pool first)
            blockchain.pendingTransactions = getTestPendingTransactionData();

            const returnedBlock = blockchain.createNewBlock(
                blockNonce,
                lastBlockHash,
                blockHash,
                processedTxnList,
                merkleRootHash,
                stateRootHash,
                minerAddress
            );

            expect(returnedBlock.index, 'block index is wrong').to.equal(2); //next block after Genesis block
            expect(returnedBlock.transactions.length, 'number of txns in block is wrong').to.equal(processedTxnList.length);
            expect(returnedBlock.nonce, 'block nonce is wrong').to.equal(blockNonce);
            expect(returnedBlock.hash, 'block hash is wrong').to.equal(blockHash);
            expect(returnedBlock.stateRoot, 'block state root is wrong').to.equal(stateRootHash);
            expect(returnedBlock.merkleRoot, 'block merkle root is wrong').to.equal(merkleRootHash);
            expect(returnedBlock.miner, 'block miner is wrong').to.equal(minerAddress);
            expect(blockchain.pendingTransactions.length, 'pending txns not removed').to.equal(4); //2 user txns removed
            expect(blockchain.chain.length, 'new block not added to chain').to.equal(2); //new block + genesis block

        });

    });

});