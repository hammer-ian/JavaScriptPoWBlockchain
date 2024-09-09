const express = require('express');

module.exports = (blockchain) => {
    const router = express.Router();

    //find transaction associated with a specific hash
    router.get('/block/:blockHash', function (req, res) {
        const searchResults = blockchain.getBlock(req.params.blockHash);
        res.json({
            note: "Search finished",
            block: searchResults
        })

    });
    //find a transaction by transaction id
    router.get('/transaction/:transactionId', function (req, res) {

        const searchResults = blockchain.getTransaction(req.params.transactionId);

        res.json({
            note: "Search finished",
            blockIndex: searchResults.block,
            transaction: searchResults.transaction
        })
    });

    //get all transactions associated with an address
    router.get('/address/:address', function (req, res) {

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