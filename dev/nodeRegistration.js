/*********************************************************************
 *
 *  Registration and de-registration of blockchain nodes on network
 *
 *
 * *******************************************************************/

//import 3rd party libraries
const AWS = require('aws-sdk'); //call AWS services
const axios = require('axios'); //manage internal HTTP requests

//Import environment config and internal modules
require('dotenv').config();
const networkNodePort = process.env.PORT;
const targetGroupArn = process.env.AWS_ALB_TG_ARN;
const logger = require('./logger');

const registerThisNode = (blockchain, networkNodeIP) => {

    logger.info(`registerThisNode: registering ${blockchain.currentNodeUrl}`); 

    //Specify AWS Region
    AWS.config.update({ region: process.env.AWS_REGION });

    //Create an ELBv2 client (for ALB and NLB) and EC2 client to get private IP of EC2 instances
    const elbv2 = new AWS.ELBv2();
    const ec2 = new AWS.EC2();

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

    sendPostRequest();
}

const deRegisterThisNode = () => {

    logger.info(`Deregistering node: `);
    // Logic to deregister a node
}

module.exports = {

    registerThisNode,
    deRegisterThisNode
};

