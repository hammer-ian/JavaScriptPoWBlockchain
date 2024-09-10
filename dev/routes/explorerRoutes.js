//Routes specific to the Blockchain Explorer

const express = require('express');
const logger = require('../utils/logger');

module.exports = (blockchain) => {
    const router = express.Router();

    //find transaction associated with a specific hash
    router.get('/block/:blockHash', function (req, res) {
        logger.info(`Request received to find block ${req.params.blockHash}`);
        const searchResults = blockchain.getBlock(req.params.blockHash);
        res.json({
            note: "Search finished",
            block: searchResults
        })

    });
    //find a transaction by transaction id
    router.get('/transaction/:transactionId', function (req, res) {
        logger.info(`Request received to find transaction ${req.params.transactionId}`);
        const searchResults = blockchain.getTransaction(req.params.transactionId);

        res.json({
            note: "Search finished",
            blockIndex: searchResults.block,
            transaction: searchResults.transaction
        })
    });

    //get all transactions associated with an address
    router.get('/address/:address', function (req, res) {
        logger.info(`Request received to find address ${req.params.address}`);
        const searchResults = blockchain.getAddress(req.params.address);

        res.json({
            note: "Search finished",
            addressData: searchResults
        })

    });

    router.get('/block-explorer', function (req, res) {
        res.sendFile('../block-explorer/index.html', { root: __dirname });
    });

    return router;
};