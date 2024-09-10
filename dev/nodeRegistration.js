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
const logger = require('./utils/logger');
const { findHealthyEC2Instances } = require('./utils/awsUtils');

const registerThisNode = async (networkNodeDetails) => {

    logger.info(`Registering ${networkNodeDetails.networkNodeURL}`);

    async function sendPostRequest() {

        const postData = { newNodeURL: networkNodeDetails.networkNodeURL };

        let privateIP, registrationSuccess = false;
        const healthyIPAddresses = await findHealthyEC2Instances(process.env.AWS_REGION, process.env.AWS_ALB_TG_ARN);
        logger.info(`HealthyIPAddresses: ${healthyIPAddresses}`);

        //Check number of healthy instances
        if (healthyIPAddresses.length === 0) {
            logger.error('No healthy EC2 instances available to register new node. Registration aborted');
            return registrationSuccess;
        }

        //Before beginning registration remove this nodes IP from the list of healthy IPs. A node should not attempt to register with itself
        logger.info('Removing this hosts IP address from list of healthy EC2. A node cannot register with itself');
        const index = healthyIPAddresses.indexOf(networkNodeDetails.networkNodeIP);
        if (index !== -1) healthyIPAddresses.splice(index, 1);

        //Re-check number of healthy instances after we've removed this node's IP
        if (healthyIPAddresses.length === 0) {
            logger.error('No healthy EC2 instances left to register new node. Registration aborted');
            return registrationSuccess;
        }

        for (let i = 0; i < healthyIPAddresses.length; i++) {
            privateIP = healthyIPAddresses[i];

            //For now we assume all nodes run on the same port (in future should route registration through ELB/Apache/80)
            const Ec2Url = `http://${privateIP}:${process.env.PORT}`;
            //check blockchain node is running on the healthy EC2 instance
            const nodeListening = await checkNodeIsListening(Ec2Url);
            if (nodeListening) {

                const registrationURL = `${Ec2Url}/register-and-broadcast-node`;

                //POST request
                try {
                    logger.info(`Initiating POST registration request using URL: ${registrationURL}`);
                    const response = await axios.post(registrationURL, postData);
                    logger.info(`Reply from ${Ec2Url}: ${JSON.stringify(response.data)}`);
                    //we have successfully registered so we can exit the loop
                    registrationSuccess = true;
                    break;
                }
                catch (error) {
                    logger.error(`Error making POST request to register node on ${Ec2Url}: ${error}`);
                }
            } else {
                logger.error(`Did not detect blockchain node listening on ${Ec2Url}`);
            }
        }
        return registrationSuccess;
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

//This function handles both finding the unhealthy node and broadcasting the unhealthy node to the network
const findUnhealthyNode = async (networkNodes) => {

    const unhealthyNodes = [];
    logger.info(`Starting looking for unhealthy node`);

    /* Logic to find unhealthy node. 
    * We can assume this node is not unhealthy because the lambda function that initiated this request retrieved 
    * a list of health hosts from the ELB's target group, and this request was successfully received */
    for (const node of networkNodes) {
        try {
            logger.info(`Checking ${node}`);
            //remove port from the networkNode as we want to test the public route via Apache 
            const nodeMinusPort = node.replace(/:\d+$/, '');
            logger.info(`Port removed from node string so healthcheck is routed via Apache proxy/80. Before: ${node}, After: ${nodeMinusPort}`);
            const url = `${nodeMinusPort}/app/healthcheck`;

            logger.info(`Making GET request to ${url}. Same healthcheck endpoint that AWS Target Group uses`);
            const response = await axios.get(url);

            logger.info(`Healthcheck Response status: ${response.status}. Node ${nodeMinusPort} is healthy`);
            logger.info(`Response data: ${JSON.stringify(response.data)}`);
        }
        catch (error) {
            if (error.response) {
                // The request was made, but the server responded with a status code outside of the 2xx range
                logger.error(`Error with response from ${node}: HTTP response status: ${error.response.status}`);
            } else if (error.request) {
                // The request was made, but no response was received
                logger.error(`No response received from ${node}: ${error.request}`);
            } else {
                // Something happened in setting up the request
                logger.error(`Error in setup: ${error.message}`);
            }
            //keep track of unhealthy nodes as we run healthchecks 
            unhealthyNodes.push(node);
        }
    }

    // Make sure found unhealthy node(s) else abort deregistration 
    if (unhealthyNodes.length !== 0) {
        logger.error(`Finished running network healthchecks, the unhealthy node(s) are: ${unhealthyNodes}`);
    } else {
        logger.info('No unhealthy nodes found, no more action required');
        return;
    }

    logger.info('Initiating request to deregister unhealthy node(s) from network');

    //first remove each unhealthy node from this node's networkNode list
    for (const unhealthyNode of unhealthyNodes) {
        const index = networkNodes.indexOf(unhealthyNode);
        if (index !== -1) networkNodes.splice(index, 1);
    }
    //now we have deregistered (removed) the unhealthy node from our network list, notify the other healthy nodes to do the same
    //constuct post request object to pass array of unhealthy nodes 
    const postData = {
        unhealthyNodes: unhealthyNodes
    };

    const deregisterEndpoint = '/internal/deregister-unhealthy-node';

    for (const healthyNode of networkNodes) {
        const deregisterURL = `${healthyNode}${deregisterEndpoint}`;
        try {
            logger.info(`Sending POST request to deregister unhealthy nodes to: ${deregisterURL}`);
            const response = await axios.post(deregisterURL, postData);
            logger.info(`Reply from ${healthyNode}: ${JSON.stringify(response.data)}`);
        }
        catch (error) {
            logger.error(`Error making POST request to register node on ${healthyNode}: ${error}`);
        }
    }


}

module.exports = {

    registerThisNode,
    findUnhealthyNode
};

