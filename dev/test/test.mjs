import { expect } from 'chai';
import Blockchain from '../blockchain/blockchain.js';

describe('Blockchain', () => {
    it('should create a new instance of a blockchain', () => {

        //create new instance of Blockchain

        const blockchain = new Blockchain();
        expect(blockchain.chain.length).to.equal(1);
    });

});