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

module.exports = {

    registerThisNode
};

