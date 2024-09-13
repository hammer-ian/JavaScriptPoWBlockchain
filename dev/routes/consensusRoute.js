//Maintain consensus (same data) on each of the blockchain nodes in the network 
//Uses longest chain algorithm used on PoW networks e.g. Bitcoin

const express = require('express');
const logger = require('../utils/logger');
const rp = require('request-promise'); //manage internal HTTP requests

module.exports = (blockchain) => {
    const router = express.Router();

    //Retrieve list of all blockchain accounts
    router.get('/', function (req, res) {
        const requestPromisesArray = [];

        //Build request to retreive blockchain data from the other nodes
        blockchain.networkNodes.forEach(networkNodeUrl => {
            const requestOptions = {
                uri: networkNodeUrl + '/blockchain',
                method: 'GET',
                json: true
            };
            //Make each requests a Promise, and add to an array
            requestPromisesArray.push(rp(requestOptions));
        });

        Promise.all(requestPromisesArray)
            //Execute all the /blockchain GET requests
            //Data returned will be an array of blockchain data from the other nodes
            .then(blockchainsFromOtherNodesArr => {
                //set currentChainLength to the length of the blockchain on the current node
                const currentChainLength = blockchain.chain.length;
                //initialize variables for comparing this copy of the blockchain vs. other nodes
                let maxChainLength = currentChainLength;
                let newLongestChain = null;
                let newPendingTransactions = null;

                //for each blockchain on other nodes, compare the length
                //if we find a longer blockchain, update the max chain length, and copy the blockchain and pending txns
                blockchainsFromOtherNodesArr.forEach(blockchain => {
                    //if we find another node has a longer chain
                    if (blockchain.chain.length > maxChainLength) {
                        maxChainLength = blockchain.chain.length;
                        newLongestChain = blockchain.chain;
                        newPendingTransactions = blockchain.pendingTransactions;
                    }
                });
                //if there is no new longer chain, or the longer chain is not valid
                if (!newLongestChain || (newLongestChain && !blockchain.chainIsValid(newLongestChain))) {
                    logger.info('Consensus check finished. Local chain NOT replaced');
                    res.json({
                        note: "Local chain has NOT been replaced",
                        chain: blockchain.chain
                    });
                } else if (newLongestChain && blockchain.chainIsValid(newLongestChain)) {
                    //Valid longer chain found, update the blockchain on this node
                    blockchain.chain = newLongestChain;
                    blockchain.pendingTransactions = newPendingTransactions;
                    logger.info('Consensus check finished. Local chain HAS been replaced');
                    res.json({
                        note: "Local chain HAS been replaced",
                        chain: blockchain.chain
                    });
                }
            });
    });

    return router;
};