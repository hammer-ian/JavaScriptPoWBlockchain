import { expect } from 'chai';
import sinon, { expectation } from 'sinon';

// Import the default export of networkNode.js as an object
import Blockchain from '../../blockchain/blockchain.js';

/**
 * Test cases for chainIsValid() logic. Used in evaluting blockchain consensus
 * 
 */

describe('Blockchain chainIsValid logic', function () {

    //create a new instance of blockchain
    let blockchain, hashBlockData;
    let blockTxnList = [];

    beforeEach(async function () {
        blockchain = new Blockchain('http://localhost:3001'); //node hostname not used

        blockTxnList.push(
            { txnID: 'testTxnID1' },
            { txnID: 'testTxnID2' },
        );

        //add blocks to chain
        blockchain.chain.push(
            {
                index: 2,
                timestamp: '1728871651818',
                transactions: blockTxnList,
                nonce: 104432,
                hash: '0000blockHash',
                prevBlockHash: 'genesisHash',
                miner: 'minerAddress',
                stateRoot: 'stateRootHash',
                merkleRoot: 'merkleRootHash'
            },
            {
                index: 3,
                timestamp: '1728871651818',
                transactions: blockTxnList,
                nonce: 104432,
                hash: '0000anotherblockHash',
                prevBlockHash: '0000blockHash',
                miner: 'minerAddress',
                stateRoot: 'stateRootHash',
                merkleRoot: 'merkleRootHash'
            })

        hashBlockData = sinon.stub(blockchain, 'hashBlockData');
        hashBlockData.onCall(0).returns('0000blockHash');
        hashBlockData.onCall(1).returns('0000anotherblockHash');
    });



    describe('Testing chainIsValid logic', function () {

        it('should return true if the blockchain passed is valid', function () {

            const result = blockchain.chainIsValid(blockchain.chain);
            expect(result, 'chain is valid should return true').to.equal(true);
        });

        it('should return false if hash chain invalid', function () {
            //override stub to return invalid value without '0000'
            hashBlockData.onCall(1).returns('anotherblockHash');

            const result = blockchain.chainIsValid(blockchain.chain);
            expect(result, 'hash chain is invalid should return false').to.equal(false);
        });

        it('should return false if genesis block nonce is invalid', function () {

            blockchain.chain[0].nonce = 0;
            const result = blockchain.chainIsValid(blockchain.chain);
            expect(result, 'genesis block nonce is invalid should return false').to.equal(false);
        });

        it('should return false if genesis block prevBlockHash is invalid', function () {

            blockchain.chain[0].prevBlockHash = 'invalid';
            const result = blockchain.chainIsValid(blockchain.chain);
            expect(result, 'genesis block prevBlockHash is invalid should return false').to.equal(false);
        });

        it('should return false if genesis block hash is invalid', function () {

            blockchain.chain[0].hash = 'invalid';
            const result = blockchain.chainIsValid(blockchain.chain);
            expect(result, 'genesis block hash is invalid should return false').to.equal(false);
        });

        it('should return false if genesis block txnList is invalid', function () {

            blockchain.chain[0].transactions = blockTxnList;
            const result = blockchain.chainIsValid(blockchain.chain);
            expect(result, 'genesis block txn list is invalid should return false').to.equal(false);
        });
    });

});