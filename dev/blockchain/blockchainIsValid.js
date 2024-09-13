
const logger = require('../utils/logger');

function chainIsValid(blockchain) {

    let chainValid = true;
    //check each block in chain, start at position 1 (skipping initial genesis block)
    for (var i = 1; i < blockchain.length; i++) {
        const currentBlock = blockchain[i];
        const prevBlock = blockchain[i - 1];

        //check chain "links" are correct - compare current block prevHash to previous block's hash
        if (currentBlock['prevBlockHash'] !== prevBlock['hash']) {
            logger.info(`FAIL: Issue with chain linking.current block prevHash is ${currentBlock['prevBlockHash']}, previous block hash is ${prevBlock['hash']} `);
            chainValid = false;
        }

        //check current block data has not changed by computing the hash again
        const blockHash = this.hashBlockData(
            prevBlock['hash'],
            currentBlock['transactions'],
            currentBlock['nonce']
        );
        //make sure hash starts with '0000'
        if (blockHash.substring(0, 4) !== '0000') {
            logger.info("FAIL: Issue with current block data, recomputed hash is wrong");
            logger.info(currentBlock['index'], prevBlock['hash'], currentBlock['transactions'], currentBlock['nonce']);
            chainValid = false;
        }
    }
    //now check genesis block
    const genesisBlock = blockchain[0];
    const correctGenesisNonce = genesisBlock['nonce'] === 100;
    const correctGenesisPrevBlockHash = genesisBlock['prevBlockHash'] === 'NA';
    const correctGenesisHash = genesisBlock['hash'] === 'genesisHash';
    const correctGenesisTransactions = genesisBlock['transactions'].length === 0;

    if (!correctGenesisNonce || !correctGenesisPrevBlockHash || !correctGenesisHash || !correctGenesisTransactions) {
        logger.info("FAIL: Issue with genesis block");
        chainValid = false;
    }

    return chainValid;

}

module.exports = {
    chainIsValid
}