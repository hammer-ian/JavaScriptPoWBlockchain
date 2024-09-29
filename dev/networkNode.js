/*********************************************************************
 *
 *  Javascript proof of work blockchain intended to run on
 *  multiple AWS EC2 instances, creating a network of blockchain nodes
 *
 *  Each network node will listen on the port specified in .env
 *    
 *  Script usage: networkNode.js 
 *
 * *******************************************************************/

//Import 3rd Party Imports
const rp = require('request-promise'); //manage internal HTTP requests
const { v4: uuidv4 } = require('uuid'); //generate unique identifiers

//Import environment config and internal modules
require('dotenv').config();
const logger = require('./utils/logger');
const { getNetworkNodeDetails, getNodeCreditAddress } = require('./node/getNetworkNodeDetails');
const { registerThisNode } = require('./node/registerThisNode');
const { deRegisterUnhealthyNodes } = require('./node/deregisterUnhealthyNodes');
const Blockchain = require('./blockchain/blockchain');

//Set up express server
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))

//Import Route files
const explorerRoutes = require('./routes/explorerRoutes');
const accountRoutes = require('./routes/accountRoutes');
const consensusRoutes = require('./routes/consensusRoute');

//Import JSON schemas
const { validateTransactionJSON } = require('./node/schema');

// logger middleware to log access logs
app.use((req, res, next) => {

    //Temp fix to filter out AWS TargetGroup health checks and reduce log noise 
    if (req.path === '/healthcheck') {
        return next();
    } else {
        logger.info(`${req.method} ${req.hostname} ${req.path} ${JSON.stringify(req.body)}`);
        next();
    }
});

//initialize this node and it's blockchain instance
const networkNodeDetails = getNetworkNodeDetails();
const blockchain = new Blockchain(networkNodeDetails.networkNodeURL);
const nodeId = `node-${uuidv4().split('-').join('')}`; //generate unique node id

/**********************************
  
    Endpoints definitions

**************************************/
// Set up application Routes
app.use('/explorer', explorerRoutes(blockchain));
app.use('/account', accountRoutes(blockchain));
app.use('/consensus', consensusRoutes(blockchain));

app.get('/', function (req, res) {
    res.send("Homepage");
});

app.get('/blockchain', function (req, res) {
    res.send(blockchain);
});

//Endpoint which validates the end to end route from ALB -> Apache(port 80) -> /app/ ProxyPass -> localhost(3001)
//If endpoint does not respond with 200 we can assume there is an issue with the route
//If issue: ALB will stop routing requests to that EC2 instance and the other nodes need to deregister the unhealthy node
app.get('/healthcheck', async (req, res) => {
    res.status(200).send('OK');
});

//create new transaction Obj and broadcast new transaction to other network nodes
app.post('/transaction/broadcast', validateTransactionJSON, function (req, res) {
    logger.info('Received transaction to broadcast, creating new transaction object');

    try {
        const nonce = blockchain.getLatestNonce(req.body.debitAddress);

        const resultObj = blockchain.createNewTransaction(
            req.body.debitAddress,
            req.body.creditAddress,
            req.body.amount,
            req.body.gas,
            nonce
        );

        //if returning object has a transaction ID property, transaction created successfully
        if (resultObj.txnID) {
            logger.info(`newTransaction object created ${JSON.stringify(resultObj)}`);

            //Array to hold the new transaction broadcast requests to be send to other nodes
            const requestTxnPromises = [];

            //build the "new transaction" broadcast request for each of the other nodes
            blockchain.networkNodes.forEach(networkNodeUrl => {
                const requestOptions = {
                    uri: networkNodeUrl + '/internal/receive-new-transaction',
                    method: 'POST',
                    body: resultObj,
                    json: true
                };
                //add each new transaction request to array
                requestTxnPromises.push(rp(requestOptions));
            });
            logger.info(`Sending broadcast requests to: ${JSON.stringify(requestTxnPromises)}`);

            Promise.all(requestTxnPromises)
                .then(data => {
                    logger.info(`new transaction created and broadcast successfully`);
                    res.json({ note: "new transaction created and broadcast successfully" });
                })
                .catch(error => {
                    logger.error(`Error in Promise.all: ${error}`);  // Log the error
                    if (error.response) {
                        logger.error(`Response error: ${error.response.headers.location}`);
                    }
                    res.status(500).json({ note: 'Transaction broadcast failed', error: error.message });
                });
        } else {
            logger.info(`Transaction creation failed ${JSON.stringify(resultObj)}`);
            res.status(400).json({
                note: "transaction creation failed",
                result: resultObj
            });
        }
    } catch (error) {
        // Log the error for debugging purposes
        logger.error(`Error occurred during transaction creation and validation: ${error.message}`, { error });

        // Return a 500 status to indicate a server error
        res.status(400).json({
            note: 'Error occurred during transaction creation and validation',
            error: error.message
        });
    }
});

//used to receive new transactions from other network nodes
app.post('/internal/receive-new-transaction', function (req, res) {
    logger.info(`New transaction received, validating ${JSON.stringify(req.body)}`);
    const newTxnObj = req.body;
    const resultObj = blockchain.validateTransaction(
        newTxnObj.debitAddress,
        newTxnObj.creditAddress,
        newTxnObj.amount,
        newTxnObj.gas,
        newTxnObj.nonce
    );
    if (resultObj.ValidTxn) {
        blockchain.addNewTransactionToPendingPool(newTxnObj);
        res.json({ note: `transaction added to pending pool, respondingNode: ${blockchain.currentNodeUrl}` });
    } else {
        res.status(400).json({ note: `transaction validation failed, txn not added to pending pool: ${resultObj}` });
    }
});

app.get('/mine', async function (req, res) {

    try {
        logger.info('Request received to mine..');
        //retrieve default node address
        const nodeAccAddress = getNodeCreditAddress();
        let nodeAcc = blockchain.accounts.find(account => account.address === nodeAccAddress);
        //if account has not been created
        if (!nodeAcc) {
            //create Account for node using default address
            nodeAcc = blockchain.createNewAccount(nodeId, nodeAccAddress);
        }
        //Start mining
        const result = blockchain.mine(nodeAcc.address);

        if (result.ValidBlock) {
            const registerNewBlockPromises = [];
            logger.info(`Mine successful locally, now starting to broadcast new block`);
            blockchain.networkNodes.forEach(networkNodeUrl => {
                const requestOptions = {
                    uri: networkNodeUrl + '/internal/receive-new-block',
                    method: 'POST',
                    body: { newBlock: result.Details },
                    json: true
                };
                //Add each register request to array
                //calling rp (request-promise) wraps the request in a Promise before adding it to the array
                registerNewBlockPromises.push(
                    rp(requestOptions)
                        .then(response => {
                            if (response.status === 'success') {
                                logger.info(`Block processed successfully by ${networkNodeUrl}`);
                            } else {
                                logger.error(`Block delivered but failed to process on ${networkNodeUrl}: Check response object for more detail: ${JSON.stringify(response)}`);
                                return { networkNodeUrl, status: response.status, fullResponse: response };
                            }
                        })
                        .catch(err => {
                            logger.error(`Error sending block to ${networkNodeUrl}: ${err.message}`);
                            return { networkNodeUrl, error: err.message, status: 'failed' };
                        })
                );
            });
            const deliveryResults = await Promise.all(registerNewBlockPromises);
            logger.info(`Broadcast of new block deliveryResults: ${JSON.stringify(deliveryResults)}`);
            const failedNodes = deliveryResults.filter(result => result && result.status === 'failed');

            if (failedNodes.length > 0) {
                logger.error(`Issues encountered: ${JSON.stringify([...failedNodes])}`);
                res.status(207).json({
                    note: "New block mined and broadcast, but some nodes had issues",
                    failedNodes: failedNodes,
                    newBlock: result.Details
                });
            } else {
                logger.info(`New block broadcasted successfully to all nodes`);
                res.status(200).json({
                    note: "New block mined and broadcast successfully",
                    newBlock: result.Details
                });
            }
        } else {
            logger.error(`ValidBlock: ${result.ValidBlock}, Error: ${result.Error}, ErrorList: ${JSON.stringify(result.ErrorList)}`);
            res.status(400).json({
                note: result.Error,
                details: result.ErrorList
            })
        }
    } catch (error) {
        // Log the error for debugging purposes
        logger.error(`Error occurred during mining: ${error.message}`, { error });

        // Return a 500 status to indicate a server error
        res.status(500).json({
            note: 'An error occurred during mining or broadcasting the new block.',
            error: error.message
        });
    }
});

app.post('/internal/receive-new-block', function (req, res) {

    logger.info(`Received new block from network..${JSON.stringify(req.body.newBlock)}`);
    const newBlock = req.body.newBlock;

    const result = blockchain.receiveNewBlock(newBlock);

    if (result.status === 'success') {
        logger.info(`New block processed successfully ${JSON.stringify(result)}`);
        res.status(200).json(result);
        return;
    }
    //use 202, new block received, but processing failed
    logger.error(`Processing of new block failed ${JSON.stringify(result)}`);
    res.status(202).json(result);
});

/* Each new node (e.g. :3009) registers itself with ONE existing node (e.g. 3001), and asks that
node to broadcast the new node url to the other nodes on the network */
app.post('/register-and-broadcast-node', function (req, res) {

    logger.info(`register-and-bcast-node: Request received to register ${req.body.newNodeURL}`);
    const newNodeURL = req.body.newNodeURL;
    logger.info(`currentNodeURL: ${blockchain.currentNodeUrl}, newNodeURL: ${newNodeURL}`);
    const notCurrentNode = blockchain.currentNodeUrl !== newNodeURL;

    //If newNodeURL is not already registered, and not currentNode, add url to list of network nodes registered with this instance
    if (blockchain.networkNodes.indexOf(newNodeURL) == -1 && notCurrentNode) {
        logger.info(`Adding new node URL to this node's list of network hosts`);
        blockchain.networkNodes.push(newNodeURL);
    }
    /* create broadcasting request array: each request to register the new node with other network nodes 
    will be stored here. All requests will be asynchronous so we will use Promises */
    const registerNodePromises = [];

    logger.info(`Creating requests to register new node`);
    //Loop through all registered network nodes creating a request to register the new node
    blockchain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/internal/register-node',
            method: 'POST',
            body: { newNodeURL: newNodeURL },
            json: true
        };
        //Add each register request to array
        //calling rp (request-promise) wraps the request in a Promise before adding it to the array
        registerNodePromises.push(rp(requestOptions));
    });

    logger.info(`Registration requests created successfully ${JSON.stringify(registerNodePromises)}`);
    logger.info(`Executing broadcast requests`);
    /* Promise.all takes an iterable (e.g. array) of Promises and returns a single allPromise
    The returned allPromise fulfills when all of the input promises fulfill successfully
    If any of the input Promises reject/fail, the allPromise rejects immediately */
    Promise.all(registerNodePromises) //register requests executed here
        .then(data => {
            logger.info('Finished broadcasting request of new node to other nodes, creating bulk registration back to new node');

            /*Now the new node is registered, we need to tell the NEW node about ALL the other nodes
                this endpoint is only hit on the NEW node instance */
            const bulkRegisterOptions = {
                uri: newNodeURL + '/internal/register-nodes-bulk',
                method: 'POST',
                body: { allNetworkNodes: [...blockchain.networkNodes, blockchain.currentNodeUrl] },
                json: true
            };

            return rp(bulkRegisterOptions);
        })
        .catch(err => {
            logger.info(err);
            res.status(400).json({
                note: 'Node registration or broadcast failed',
                error: `${JSON.stringify(err)}`
            });
        })
        .then(data => {
            res.json({ note: 'New node registered with network successfully' });
        });

});

/* This endpoint is called by the node which has received the broadcast request, to register the new node with 
other nodes on the network */
app.post('/internal/register-node', function (req, res) {
    logger.info(`register-node: request received`);
    const newNodeURL = req.body.newNodeURL;
    //check if new node is already registered, and new node is not current node
    const nodeNotAlreadyPresent = blockchain.networkNodes.indexOf(newNodeURL) == -1;
    const notCurrentNode = blockchain.currentNodeUrl !== newNodeURL;

    /*if new node is not already registered, and new node is not current node
    add new node to list of registered nodes */
    if (nodeNotAlreadyPresent && notCurrentNode) {
        blockchain.networkNodes.push(newNodeURL);
        res.json({ note: `New node ${newNodeURL} registered successfully with node ${blockchain.currentNodeUrl}` })
    } else {
        res.json({ note: `New node ${newNodeURL} is already registered with node ${blockchain.currentNodeUrl}` })
    }
});

/* Register all nodes at once. 
 Called by a new node once it's URL has been successfully broadcast to all existing nodes */
app.post('/internal/register-nodes-bulk', function (req, res) {
    logger.info(`register-node-bulk: request received`);
    logger.info(req.body.allNetworkNodes);
    const allNetworkNodes = req.body.allNetworkNodes;
    allNetworkNodes.forEach(networkNodeUrl => {
        //check if new node is already registered, and new node is not current node
        const nodeNotAlreadyPresent = blockchain.networkNodes.indexOf(networkNodeUrl) == -1;
        const notCurrentNode = blockchain.currentNodeUrl !== networkNodeUrl;
        if (nodeNotAlreadyPresent && notCurrentNode) {
            blockchain.networkNodes.push(networkNodeUrl);
        }
    });
    res.json({ note: "Bulk registration successful" });
});

app.get('/find-unhealthy-node', function (req, res) {

    logger.warn('Request received to find unhealthy node');
    deRegisterUnhealthyNodes(blockchain.networkNodes);

    res.json({
        note: `Request received to find unhealthy node. Working on it`,
        receivingNode: `${blockchain.currentNodeUrl}`
    });
});

app.post('/internal/deregister-unhealthy-node', function (req, res) {

    //remove the unhealthy node(s) from the list of network nodes
    logger.info(`Request received to deregister ${req.body.unhealthyNodes}`);

    const unhealthyNodes = req.body.unhealthyNodes;

    for (const unhealthyNode of unhealthyNodes) {
        const index = blockchain.networkNodes.indexOf(unhealthyNode);
        if (index !== -1) blockchain.networkNodes.splice(index, 1);
    }

    res.json({
        note: "Unhealthy nodes removed from my networkNode list",
        updatedNetworkNodeList: blockchain.networkNodes
    });
});

//Start listening for new requests on all IP addresses
app.listen(networkNodeDetails.networkNodePort, '0.0.0.0', function () {

    registerThisNode(networkNodeDetails);

    logger.info(`Listening on port ${networkNodeDetails.networkNodePort}..`);

});
//export app module and blockchain instance to support testing
module.exports = {
    app,
    blockchain
}
