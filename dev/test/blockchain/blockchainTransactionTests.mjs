import { expect } from 'chai';

// Import the default export of networkNode.js as an object
import Blockchain from '../../blockchain/blockchain.js';

/**
 * Test cases validating the blockchain create transaction logic 
 * 
 * Blockchain consensus, explorer, mining will be seperated into other test modules
 */

describe('Blockchain Create Transaction Business Logic', function () {

    //create a new instance of blockchain
    let blockchain;
    before(function () {
        blockchain = new Blockchain('http://localhost:3001'); //not required
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



});