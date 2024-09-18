/*********************************************************************
 *
 *  Registration and de-registration of blockchain nodes on network
 *
 *
 * *******************************************************************/

//import 3rd party libraries
const axios = require('axios'); //manage internal HTTP requests

//Import environment config and internal modules
require('dotenv').config();
const logger = require('../utils/logger');
const { findHealthyEC2Instances } = require('../utils/awsUtils');

const registerThisNode = async (networkNodeDetails) => {

    logger.info(`Starting registration of ${networkNodeDetails.networkNodeURL}`);

    async function sendPostRequest() {

        const postData = { newNodeURL: networkNodeDetails.networkNodeURL };

        let ipWithPortList, ipWithPort, result = false;

        if (process.env.ENVIRONMENT === 'PROD' || !process.env.ENVIRONMENT) {
            ipWithPortList = await getSeedNodesAWS();
        } else if (process.env.ENVIRONMENT === 'DEV') {
            ipWithPortList = await getSeedNodesDESKTOP();
        }
        //check number of seed nodes available for registration
        if (ipWithPortList.length === 0) {
            logger.error(`No seed nodes found, unable to register. Registration aborted`);
            return result;
        }

        for (let i = 0; i < ipWithPortList.length; i++) {
            ipWithPort = ipWithPortList[i];

            const seedNode = `http://${ipWithPort}`;
            //check a seed blockchain node is running on the host
            const nodeListening = await checkNodeIsListening(seedNode);
            if (nodeListening) {

                const registrationURL = `${seedNode}/register-and-broadcast-node`;

                //POST request
                try {
                    logger.info(`Initiating POST registration request using URL: ${registrationURL}`);
                    const response = await axios.post(registrationURL, postData);
                    logger.info(`Reply from ${seedNode}: ${JSON.stringify(response.data)}`);
                    //we have successfully registered so we can exit the loop
                    result = true;
                    break;
                }
                catch (error) {
                    logger.error(`Error making POST request to register node on ${seedNode}: ${error}`);
                }
            } else {
                logger.error(`Did not detect blockchain node listening on ${seedNode}`);
            }
        }
        return result;
    }

    async function checkNodeIsListening(urlToCheck) {

        try {
            logger.info(`Checking if blockchain node is listening on ${urlToCheck}. Node has 3 seconds to respond`);
            const response = await axios.get(urlToCheck, { timeout: 3000 });
            logger.info(`${urlToCheck} is listening!`);
            return true;
        } catch (err) {
            logger.error(`Error: a blockchain node does not appear to be listening on ${urlToCheck}. Error: ${err}`);
            return false;
        }
    }

    async function runConsensusCheck() {

        try {
            logger.info('Starting consensus check..');
            const response = await axios.get(`${networkNodeDetails.networkNodeURL}/consensus`, { timeout: 3000 });
            logger.info(`Response: ${JSON.stringify(response.data)}`);

        } catch (err) {
            logger.error(`Consensus check failed. Error: ${err}`);
        }

    }

    //Initiate the node registration
    const registrationSuccess = await sendPostRequest();
    logger.info(`Registration status: ${registrationSuccess}`);

    //if node registration is a success then run consensus check to ensure this node has latest copy of the blockchain
    if (registrationSuccess) {

        await runConsensusCheck();
    }
}

const getSeedNodesAWS = async (networkNodeDetails) => {

    logger.info(`Retrieving seed nodes for Production AWS`);

    const healthyIPAddresses = await findHealthyEC2Instances(process.env.AWS_REGION, process.env.AWS_ALB_TG_ARN);
    logger.info(`Healthy AWS IP addresses: ${healthyIPAddresses}`);

    //Before beginning registration remove this nodes IP from the list of healthy IPs. A node should not attempt to register with itself
    logger.info('Removing this hosts IP address from list of healthy EC2. A node cannot register with itself');
    const index = healthyIPAddresses.indexOf(networkNodeDetails.networkNodeIP);
    if (index !== -1) healthyIPAddresses.splice(index, 1);

    //Check number of healthy instances after we've removed this node's IP
    if (healthyIPAddresses.length === 0) {
        logger.error('No healthy EC2 seed node instances available. Registration will be aborted');
    }
    //append the default production port to the list of ip's
    const ipWithPortList = healthyIPAddresses.map(ip => `${ip}:${process.env.PORT}`);

    return ipWithPortList;
}

const getSeedNodesDESKTOP = async (networkNodeDetails) => {

    logger.info(`Retrieving seed nodes for Desktop environment`);

    const seedNodes = process.env.LOCAL_DOCKER_SEED_NODES;
    const seedNodeArray = seedNodes.split(',');
    logger.info(`Development seed nodes are: ${seedNodeArray}`);


    const serviceName = process.env.SERVICE_NAME;
    logger.info(`Node service name is: ${serviceName}`);
    //remove this node from the list of seed nodes, a node cannot register with itself
    if (serviceName === 'node1') {
        const index = seedNodeArray.indexOf('host.docker.internal:3001');
        seedNodeArray.splice(index, 1);
    } else if (serviceName === 'node2') {
        const index = seedNodeArray.indexOf('host.docker.internal:3002');
        seedNodeArray.splice(index, 1);
    } else if (serviceName === 'node2') {
        const index = seedNodeArray.indexOf('host.docker.internal:3003');
        seedNodeArray.splice(index, 1);
    }
    logger.info(`Development seed nodes minus this node are: ${seedNodeArray}`);

    //Re-check number of healthy instances after we've removed this node's IP
    if (seedNodeArray.length === 0) {
        logger.error('No healthy seed nodes found to register new node. Registration will be aborted');
    }
    return seedNodeArray;
}

module.exports = {

    registerThisNode
};

