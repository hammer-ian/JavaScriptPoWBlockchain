const express = require('express');
const logger = require('../utils/logger');

module.exports = (blockchain) => {
    const router = express.Router();

    //Retrieve list of all blockchain accounts
    router.get('/', function (req, res) {
        res.send(blockchain.accounts);
    });

    //Create a new account
    router.post('/', function (req, res) {
        logger.info(`Request received to create new account ${req.body.nickname}`);

        if (!req.body.nickname) {
            return res.status(400).json({ note: "Nickname is required to create an account" });
        }
        const account = blockchain.createNewAccount(`${req.body.nickname}`);

        res.json({
            note: "New Account Created",
            account: account
        });
    });

    return router;
};