import { expect } from 'chai';
import sinon, { expectation } from 'sinon';

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

describe('Blockchain receive new block logic and helper methods', function () {

    //create a new instance of blockchain
    let blockchain;

    beforeEach(function () {
        blockchain = new Blockchain('http://localhost:3001'); //node hostname not used

    });

    describe('Testing receiveNewBlock logic all helper methods stubbed', () => {

        let processSelectedTxnStub, receivedBlock;
        let blockTxnList = [];
        beforeEach(() => {

            sinon.stub(blockchain, 'getLastBlock').returns({ hash: 'genesisHash', index: 1 });

            sinon.stub(blockchain, 'createClonedAccountList').returns(
                [{ account: 'account1' }, { account: 'account2' }]
            );

            processSelectedTxnStub = sinon.stub(blockchain, 'processSelectedTransactions').returns(
                { 'processedList': ['testTxnID1', 'testTxnID2'], errorList: null }
            );

            sinon.stub(blockchain, 'getStateRoot').returns('stateRootHash');
            sinon.stub(blockchain, 'getMerkleRoot').returns('merkleRootHash');

            blockTxnList.push(
                { txnID: 'testTxnID1' },
                { txnID: 'testTxnID2' },
            );

            //add block txn to pending pool so we can check if they are removed
            blockTxnList.forEach(txn => { blockchain.addNewTransactionToPendingPool(txn) });

            receivedBlock = {
                index: 2,
                timestamp: '1728871651818',
                transactions: blockTxnList,
                nonce: 104432,
                hash: 'blockHash',
                prevBlockHash: 'genesisHash',
                miner: 'minerAddress',
                stateRoot: 'stateRootHash',
                merkleRoot: 'merkleRootHash'
            }
        });

        afterEach(() => {
            // Reset all stubs
            sinon.restore();

            //reset received block
            receivedBlock = {
                index: 2,
                timestamp: '1728871651818',
                transactions: blockTxnList,
                nonce: 104432,
                hash: 'blockHash',
                prevBlockHash: 'genesisHash',
                miner: 'minerAddress',
                stateRoot: 'stateRootHash',
                merkleRoot: 'merkleRootHash'
            }
            //reset txn lists
            blockchain.pendingTransactions = [];
            blockTxnList = [];
        });

        it('should return success if the received block is successfully processed', () => {
            const result = blockchain.receiveNewBlock(receivedBlock);
            expect(result.status, 'received block status not success').to.equal('success');
            expect(result.note, 'received block status not wrong').to.include('Block processed and successfully added to chain');
            expect(blockchain.chain.length, 'received block not added to chain').to.equal(2);
            expect(blockchain.pendingTransactions.length, 'pending txns should be removed').to.equal(0);
        });

        it('should return failure if the received block prevBlockHash is wrong', () => {
            receivedBlock.prevBlockHash = 'wrongHash';
            const result = blockchain.receiveNewBlock(receivedBlock);
            expect(result.status, 'received block status should be failed').to.equal('failed');
            expect(result.correctHash, 'failure object hash property should be false').to.equal(false);
            expect(blockchain.chain.length, 'block should not be added to chain').to.equal(1); //received block not added
            expect(blockchain.pendingTransactions.length, 'pending txns should not be removed').to.equal(2); //pending txn not removed
        });

        it('should return failure if the received block index is wrong', () => {
            receivedBlock.index = 10;
            const result = blockchain.receiveNewBlock(receivedBlock);
            expect(result.status, 'received block status should be failed').to.equal('failed');
            expect(result.correctIndex, 'failure object index property should be false').to.equal(false);
            expect(blockchain.chain.length, 'block should not be added to chain').to.equal(1); //received block not added
            expect(blockchain.pendingTransactions.length, 'pending txns should not be removed').to.equal(2); //pending txn not removed
        });

        it('should return failure if any of the received block txns fail simulation', () => {
            processSelectedTxnStub.restore();
            sinon.stub(blockchain, 'processSelectedTransactions').returns(
                { 'errorList': ['testTxnID1', 'testTxnID2'] }
            );

            const result = blockchain.receiveNewBlock(receivedBlock);
            expect(result.status, 'received block status should be failed').to.equal('failed');
            expect(result.simulation, 'failure object simulation property should be failed').to.equal('failed');
            expect(blockchain.chain.length, 'block should not be added to chain').to.equal(1); //received block not added
            expect(blockchain.pendingTransactions.length, 'pending txns should not be removed').to.equal(2); //pending txn not removed
        });

        it('should return failure if the received block state root hash is wrong', () => {
            receivedBlock.stateRoot = 'wrongHash';
            const result = blockchain.receiveNewBlock(receivedBlock);
            expect(result.status, 'received block status should be failed').to.equal('failed');
            expect(result.correctStateRoot, 'failure object stateRoot property should be false').to.equal(false);
            expect(blockchain.chain.length, 'block should not be added to chain').to.equal(1); //received block not added
            expect(blockchain.pendingTransactions.length, 'pending txns should not be removed').to.equal(2); //pending txn not removed
        });

        it('should return failure if the received block merkle root hash is wrong', () => {
            receivedBlock.merkleRoot = 'wrongHash';
            const result = blockchain.receiveNewBlock(receivedBlock);
            expect(result.status, 'received block status should be failed').to.equal('failed');
            expect(result.correctMerkleRoot, 'failure object merkleRoot property should be false').to.equal(false);
            expect(blockchain.chain.length, 'block should not be added to chain').to.equal(1); //received block not added
            expect(blockchain.pendingTransactions.length, 'pending txns should not be removed').to.equal(2); //pending txn not removed
        });

        it('should return failure if any of the received block txns fail post simulation processing', () => {

            //processedSelectedTxn is called twice, we only want 2nd call to fail 
            //so override the default behaviour here to change the return value for 2nd call to this method
            processSelectedTxnStub.onCall(1).returns(
                { 'errorList': ['testTxnID1', 'testTxnID2'] }
            );
            const result = blockchain.receiveNewBlock(receivedBlock);
            expect(result.status, 'received block status should be failed').to.equal('failed');
            expect(result.postSimProcessing, 'failure object postSimProcessing property should be failed').to.equal('failed');
            expect(blockchain.chain.length, 'block should not be added to chain').to.equal(1); //received block not added
            expect(blockchain.pendingTransactions.length, 'pending txns should not be removed').to.equal(2); //pending txn not removed


        });

    });




});
