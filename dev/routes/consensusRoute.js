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

        try {
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

            logger.info(`Sending consensus requests to get blockchain data to: ${JSON.stringify(requestPromisesArray)}`);

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

                    const isValidLongestChain = newLongestChain && blockchain.chainIsValid(newLongestChain);

                    //if there is no new longer chain, or the longer chain is not valid
                    if (!newLongestChain || !isValidLongestChain) {
                        logger.info('Consensus check finished. Local chain NOT replaced');
                        return res.status(200).json({
                            note: "Local chain has NOT been replaced",
                            chain: blockchain.chain
                        });

                    }

                    //back up the local copy of blockchain account state in case we need to rollback
                    const oldAccounts = blockchain.accounts;

                    //process the transactions in each block to get the account state as per longest chain
                    for (const block of newLongestChain) {

                        const result = blockchain.processSelectedTransactions(block.transactions, block.miner);
                        //if there are any errors rollback the processing and abort consensus
                        if (result.errorList && result.errorList.length > 0) {
                            //rollback any changes to account state
                            blockchain.accounts = oldAccounts;
                            logger.error(`Error processing longest chain blocks, consensus aborted ${JSON.stringify(result.errorList)}`);
                            //stop consensus
                            return res.status(500).json({
                                note: "Consensus failed, error processing block",
                                block: block,
                                failedTxns: result.errorList
                            });
                        }
                    }
                    //Valid longer chain found and no errors, each block processed successfully, update the blockchain on this node
                    logger.info('Longer chain identified and blocks processed successfully');
                    blockchain.chain = newLongestChain;
                    blockchain.pendingTransactions = newPendingTransactions;

                    logger.info('Consensus check finished. Local chain HAS been replaced');
                    return res.status(200).json({
                        note: "Local chain HAS been replaced",
                        chain: blockchain.chain
                    });

                })
                .catch(error => {
                    logger.error('Consensus check failed, issue with request-promise:', error);
                    res.status(500).json({
                        note: "Consensus check failed due to an error in request-promise",
                        error: error.message
                    });
                });
        } catch (error) {
            // Log the error for debugging purposes
            logger.error(`Error occurred during the consensus check: ${error.message}`, { error });

            // Return a 500 status to indicate a server error
            res.status(400).json({
                note: 'Error occurred during consensus check',
                error: error.message
            });
        }
    });

    return router;
};