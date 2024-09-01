/*********************************************************************
 *
 *  Javascript proof of work blockchain intended to run on
 *  multiple AWS EC2 instances, creating a network of blockchain nodes
 *
 *  Each network node will listen on the port specified in .env
 *  This script assumes all nodes in the network use the same port
 *  
 *  Script usage: networkNode.js 
 *
 * *******************************************************************/

//Import 3rd Party Imports
const rp = require('request-promise'); //manage internal HTTP requests
const axios = require('axios'); //manage internal HTTP requests
const { networkInterfaces } = require('os'); //access host network info
const AWS = require('aws-sdk'); //call AWS services
const { v4: uuidv4 } = require('uuid'); //generate unique identifiers
const nodeAddress = uuidv4().split('-').join('');

//Import environment config and internal modules
require('dotenv').config();
const logger = require('./logger');
const Blockchain = require('./blockchain');

//Set up express server
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))

// logger middleware to log access logs
app.use((req, res, next) => {
    req.time = new Date(Date.now()).toString();
    logger.info(`${req.time} ${req.method} ${req.hostname} ${req.path} ${JSON.stringify(req.body)}`);
    next();
});

let networkNodeIP, networkNodePort;
//create this nodes networkURL using host ip and port (note, port must be passed as the first param to the script)
function makeNetworkNodeURL(){

    const nets = networkInterfaces();
    const results = Object.create(null); // Or just '{}', an empty object

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
            if (net.family === familyV4Value && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }
    networkNodeIP = results['enX0'][0];
    //read PORT from .env configuration file 
    networkNodePort = process.env.PORT;

    const networkNodeURL = `http://${networkNodeIP}:${networkNodePort}`;
    logger.info(`Network node URL is ${networkNodeURL}`);

    return networkNodeURL;
}

//create this nodes blockchain instance
const blockchain = new Blockchain( makeNetworkNodeURL() );

/**********************************
  
    Endpoints definitions

**************************************/
app.get('/', function (req, res) {
    res.send("Homepage");
});

app.get('/blockchain', function (req, res) {
    res.send(blockchain);
});

//create new transaction Obj and broadcast new transaction to other network nodes
app.post('/transaction/broadcast', function (req, res) {
    logger.info('Received transaction to broadcast, creating new transaction object');
    const newTransaction = blockchain.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    logger.info(`newTransaction object created ${JSON.stringify(newTransaction)}`);
    //add new transaction object to the pending list on THIS instance
    blockchain.addNewTransactionToPendingTransactions(newTransaction);
    logger.info('Transaction added to list of pending transactions');
    //Array to hold the new transaction broadcast requests to be send to other nodes
    const requestTxnPromises = [];

    //build the "new transaction" broadcast request for each of the other nodes
    blockchain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/receive-new-transaction',
            method: 'POST',
            body: newTransaction,
            json: true
        };
        //add each new transaction request to array
        requestTxnPromises.push(rp(requestOptions));
    });

    Promise.all(requestTxnPromises)
        .then(data => {
            res.json({ note: "new transaction created and broadcast successfully" });
        });

});

//used to receive new transactions from other network nodes
app.post('/receive-new-transaction', function (req, res) {
    logger.info(`New transaction request received ${JSON.stringify(req.body)}`);
    const newTransaction = req.body;
    const blockIndex = blockchain.addNewTransactionToPendingTransactions(newTransaction);
    res.json({ note: `transaction will be added in block ${blockIndex}`, respondingNode: `${blockchain.currentNodeUrl}` });
});

app.get('/mine', function (req, res) {

    logger.info('Starting to mine.. Need prevBlock hash, current block data, and nonce');
    //Get prev block hash
    const prevBlockHash = blockchain.getLastBlock()['hash'];

    const nonce = blockchain.proofOfWork(prevBlockHash, blockchain.pendingTransactions);
    const currentBlockHash = blockchain.hashBlockData(prevBlockHash, blockchain.pendingTransactions, nonce);
    const newBlock = blockchain.createNewBlock(nonce, prevBlockHash, currentBlockHash);

    const registerNewBlockPromises = [];

    blockchain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/receive-new-block',
            method: 'POST',
            body: { newBlock: newBlock },
            json: true
        };
        //Add each register request to array
        //calling rp (request-promise) wraps the request in a Promise before adding it to the array
        registerNewBlockPromises.push(rp(requestOptions));
    });

    Promise.all(registerNewBlockPromises)
        .then(data => {
            //once new block has been broadcast, create a mining reward transaction (to be mined in the next block)
            //mining rewards being added to the following block is considered best practice and how bitcoin operates
            const requestOptions = {
                url: blockchain.currentNodeUrl + '/transaction/broadcast',
                method: 'POST',
                body: {
                    amount: 12.5,
                    sender: "00",
                    recipient: nodeAddress
                },
                json: true
            };
            return rp(requestOptions);
        })
        .then(data => {
            res.json({
                note: "new block mined and broadcast successfully",
                newBlock: newBlock
            });
        });
});

app.post('/receive-new-block', function (req, res) {

    const newBlock = req.body.newBlock;
    const lastBlock = blockchain.getLastBlock();
    //make sure new block hash has the correct previous block hash so we don't break the chain
    const correctHash = lastBlock.hash === newBlock.prevBlockHash;
    //make sure the new block has the correct index, equal to last block + 1
    const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

    if (correctHash && correctIndex) {
        blockchain.chain.push(newBlock);
        //reset pending transactions as they are in the new block
        blockchain.pendingTransactions = [];
        res.json({
            note: "new Block received and successfully added to chain",
            newBlock: newBlock
        })
    } else {
        res.json({
            note: "new Block rejected",
            correctHash: correctHash,
            correctIndex: correctIndex,
            newBlock: newBlock
        })
    }
});

/* Each new node (e.g. :3009) registers itself with ONE existing node (e.g. 3001), and asks that
node to broadcast the new node url to the other nodes on the network */
app.post('/register-and-broadcast-node', function (req, res) {

    logger.info(`register-and-bcast-node: Request received to register ${req.body.newNodeURL}`);
    const newNodeURL = req.body.newNodeURL;
    const notCurrentNode = blockchain.currentNodeUrl !== newNodeURL;

    //If newNodeURL is not already registered, and not currentNode, add url to list of network nodes registered with this instance
    if (blockchain.networkNodes.indexOf(newNodeURL) == -1 && notCurrentNode) {
        blockchain.networkNodes.push(newNodeURL);
    }
    /* create broadcasting request array: each request to register the new node with other network nodes 
    will be stored here. All requests will be asynchronous so we will use Promises */
    const registerNodePromises = [];

    logger.info(`Creating requests to register new node`);
    //Loop through all registered network nodes creating a request to register the new node
    blockchain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/register-node',
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
                uri: newNodeURL + '/register-nodes-bulk',
                method: 'POST',
                body: { allNetworkNodes: [...blockchain.networkNodes, blockchain.currentNodeUrl] },
                json: true
            };

            return rp(bulkRegisterOptions);
        })
	.catch(err => logger.info(err))
        .then(data => {
            res.json({ note: 'New node registered with network successfully' });
        });

});

/* This endpoint is called by the node which has received the broadcast request, to register the new node with 
other nodes on the network */
app.post('/register-node', function (req, res) {
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
app.post('/register-nodes-bulk', function (req, res) {
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

//Maintain consensus (same data) on each of the blockchain nodes in the network 
//Uses longest chain algorithm used on PoW networks e.g. Bitcoin
app.get('/consensus', function (req, res) {

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
            //initial variables for comparing blockchains from other nodes
            let maxChainLength = currentChainLength;
            let newLongestChain = null;
            let newPendingTransactions = null;

            //for each blockchain on other nodes, compare the length
            //if we find a longer blockchain, update the max chain length, and copy the blockchain and pending txns
            blockchainsFromOtherNodesArr.forEach(blockchain => {
                if (blockchain.chain.length > maxChainLength) {
                    maxChainLength = blockchain.chain.length;
                    newLongestChain = blockchain.chain;
                    newPendingTransactions = blockchain.pendingTransactions;
                }
            });
            //if there is no new longer chain, or the longer chain is not valid
            if (!newLongestChain || (newLongestChain && !blockchain.chainIsValid(newLongestChain))) {
                res.json({
                    note: "Current chain has NOT been replaced",
                    chain: blockchain.chain
                });
            } else if (newLongestChain && blockchain.chainIsValid(newLongestChain)) {
                //Valid longer chain found, update the blockchain on this node
                blockchain.chain = newLongestChain;
                blockchain.pendingTransactions = newPendingTransactions;

                res.json({
                    note: "Current chain HAS been replaced",
                    chain: blockchain.chain
                });
            }
        });
});

//find transaction associated with a specific hash
app.get('/block/:blockHash', function (req, res) {
    const searchResults = blockchain.getBlock(req.params.blockHash);
    res.json({
        note: "Search finished",
        block: searchResults
    })

});
//find a transaction by transaction id
app.get('/transaction/:transactionId', function (req, res) {

    const searchResults = blockchain.getTransaction(req.params.transactionId);

    res.json({
        note: "Search finished",
        blockIndex: searchResults.block,
        transaction: searchResults.transaction
    })
});

//get all transactions associated with an address
app.get('/address/:address', function (req, res) {

    const searchResults = blockchain.getAddress(req.params.address);

    res.json({
        note: "Search finished",
        addressData: searchResults
    })

});

app.get('/block-explorer', function (req, res) {
    res.sendFile('./block-explorer/index.html', { root: __dirname });
});

const registerThisNode = () => {
    
    logger.info(`registerThisNode: registering ${blockchain.currentNodeUrl}`);

    //Specify AWS Region and ALB Target Group ARN
    AWS.config.update({ region: process.env.AWS_REGION });
    const targetGroupArn = process.env.AWS_ALB_TG_ARN; 

    //Create an ELBv2 client (for ALB and NLB) and EC2 client to get private IP of EC2 instances
    const elbv2 = new AWS.ELBv2();
    const ec2 = new AWS.EC2();

    async function getPrivateIp(instanceId) {
    
	const params = { InstanceIds: [instanceId] };
        try {
            logger.info(`Retrieving private IP for instance ${instanceId}`); 
	    const data = await ec2.describeInstances(params).promise();
            const instance = data.Reservations[0].Instances[0];
            return instance.PrivateIpAddress;
        } catch (err) {
            logger.info(`Error retrieving IP for instance ${instanceId}:`, err);
            return 'N/A';
        }
    }

    async function findHealthyInstance(targetGroupArn, interval = 10000) {
    
	const params = { TargetGroupArn: targetGroupArn };

        try {
            let healthyInstances = [];

            while (healthyInstances.length === 0) {
	        logger.info('Looking for healthy EC2 instance to register with');
	        const data = await elbv2.describeTargetHealth(params).promise();
                healthyInstances = data.TargetHealthDescriptions.filter(
                    target => target.TargetHealth.State === 'healthy'
                );

                if(healthyInstances.length === 0) {

                    logger.info(`No healthy instances found, Retrying in ${interval} milliseconds`);
                    await new Promise(resolve => setTimeout(resolve, interval));
		}
            }

            logger.info('Healthy Instances found:');
            const privateIPAddresses = [];
            for (const target of healthyInstances) {
                const instanceId = target.Target.Id;
                const privateIp = await getPrivateIp(instanceId);
                
		privateIPAddresses.push(privateIp);
                logger.info(`Instance ID: ${instanceId}, Private IP: ${privateIp} is healthy`);
            }
            //return internal (private) IP address of a healthy instance so we can register our node 
	    return privateIPAddresses;

        } catch (err) {
            logger.info('Error describing target health:', err);
        }
    } 

    async function sendPostRequest() {
    
        const postData = { newNodeURL: blockchain.currentNodeUrl };

        let privateIP; 
	const privateIPAddresses = await findHealthyInstance(targetGroupArn);
        for (const ip of privateIPAddresses){
            //this node does not want to register with itself, so check healthy IP is different from this nodes IP 
	    if(ip !== networkNodeIP){
                privateIP = ip;
	    }
	}

        //Ensure we've found a healthy EC2 instance IP address
        if(privateIP) {
 
	    const registrationURL = `http://${privateIP}:${networkNodePort}/register-and-broadcast-node`;
    
            //Make POST request using axios
            try {
                logger.info(`Initiating POST registration request using URL: ${registrationURL}`); 
	        const response = await axios.post(registrationURL, postData);
                logger.info('Response:', response.data);
            }
            catch(error) {
                logger.info('Error making POST request:', error);
            }
	} else {
                logger.info('Failed to find healthy EC2 instance, registration aborted');
	}
    }

    sendPostRequest();
};

//Start listening for new requests on all IP addresses
app.listen(networkNodePort, '0.0.0.0', function () {

    registerThisNode();
    logger.info(`Listening on port ${networkNodePort}..`);

});
