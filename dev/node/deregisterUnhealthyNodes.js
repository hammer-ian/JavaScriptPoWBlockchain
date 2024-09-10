/*********************************************************************
 *
 *  Deregister unhealthy blockchain nodes on network
 *
 *
 * *******************************************************************/

//import 3rd party libraries
const axios = require('axios'); //manage internal HTTP requests

//Import environment config and internal modules
require('dotenv').config();
const logger = require('../utils/logger');

//This function handles both finding the unhealthy node and broadcasting the unhealthy node to the network
const deRegisterUnhealthyNodes = async (networkNodes) => {

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

    deRegisterUnhealthyNodes
};

