import { expect } from 'chai';
import sinon, { expectation } from 'sinon';

// Import the default export of networkNode.js as an object
import Blockchain from '../../blockchain/blockchain.js';
//test data
import { getTestTransactionData, getTestBlockData } from '../testData.mjs';

/**
 * Test cases for blockchainExplorer. Used for searching the chain by blockhash, txn id, address
 * 
 */

describe('Blockchain Explorer logic', function () {

    //create a new instance of blockchain
    let blockchain;
    let blockTxnList1 = [];
    let blockTxnList2 = [];

    before(async function () {
        blockchain = new Blockchain('http://localhost:3001'); //node hostname not used

        blockTxnList1.push(getTestTransactionData()[0]);
        blockTxnList1.push(getTestTransactionData()[1]);

        blockTxnList2.push(getTestTransactionData()[2]);
        blockTxnList2.push(getTestTransactionData()[3]);

        //add blocks to chain
        blockchain.chain.push(
            {
                index: 2,
                timestamp: '1728871651818',
                transactions: blockTxnList1,
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
                transactions: blockTxnList2,
                nonce: 104432,
                hash: '0000anotherblockHash',
                prevBlockHash: '0000blockHash',
                miner: 'minerAddress',
                stateRoot: 'stateRootHash',
                merkleRoot: 'merkleRootHash'
            })
    });

    describe('Testing blockchain Explorer logic', function () {

        it('should return the correct Block when a hash is passed', function () {

            const result = blockchain.getBlock('0000anotherblockHash');
            expect(result, 'should return the correct block').to.equal(blockchain.chain[2]);
        });

        it('should return the correct Block & Txn when a txn id is passed', function () {

            const result = blockchain.getTransaction('testTxnID3');
            expect(result.block, 'should return the correct block').to.equal(blockchain.chain[2]);
            expect(result.transaction.txnID, 'should return the correct txn').to.equal(blockchain.chain[2].transactions[0].txnID);
        });

        it('should return the correct address balance & associated txns when a debitAddress is passed', function () {

            const debitAddress = blockchain.chain[1].transactions[0].debitAddress;
            const result = blockchain.getAddress(debitAddress);

            expect(result.addressBalance, 'should return the correct debit address balance').to.equal(-300); //three debits
            expect(result.addressTransactions.length, 'should return all matching txn').to.equal(3);
        });

        it('should return the correct address balance & associated txns when a creditAddress is passed', function () {

            const creditAddress = blockchain.chain[1].transactions[0].creditAddress;
            const result = blockchain.getAddress(creditAddress);

            expect(result.addressBalance, 'should return the correct credit address balance').to.equal(400); //two debits
            expect(result.addressTransactions.length, 'should return all matching txn').to.equal(4);
        });
    });

});