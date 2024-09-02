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
        const healthyIPAddresses = await findHealthyEC2Instances(targetGroupArn);
        logger.info(`HealthyIPAddresses: ${healthyIPAddresses}`); 

	for (let i=0; i<healthyIPAddresses.length; i++){ 
            privateIP = healthyIPAddresses[i];

            //Ensure we've found a healthy EC2 instance IP address
            if(privateIP) {

                const Ec2Url = `http://${privateIP}:${networkNodePort}`; 
	        //check blockchain node is running on the healthy EC2 instance
	        const nodeListening = await checkNodeIsListening(Ec2Url);
                if(nodeListening){ 	

	            const registrationURL = `${Ec2Url}/register-and-broadcast-node`;

                    //Make POST request using axios
                    try {
                        logger.info(`Initiating POST registration request using URL: ${registrationURL}`);
                        const response = await axios.post(registrationURL, postData);
                        logger.info(`Reply from ${Ec2Url}: ${JSON.stringify(response.data)}`);
                        //we have successfully registered so we can exit the loop 
		        break;
                    }
                    catch(error) {
                        logger.info(`Error making POST request to register node on ${Ec2Url}: ${error}`);
                    }
	        } else {
                    logger.info(`Did not detect blockchain node listening on ${Ec2Url}. Will attempt to register at next healthy EC2 instance`);
	        }
            } else {
                    logger.info('Failed to find healthy EC2 instances, registration aborted');
            }
	}
    }

    async function findHealthyEC2Instances(targetGroupArn, interval = 10000) {

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

            logger.info('Healthy EC2 Instances found, now retrieving the private of IP of each instance');
            const privateIPAddresses = [];
            for (const target of healthyInstances) {
                const instanceId = target.Target.Id;
                const privateIp = await getPrivateIp(instanceId);

                privateIPAddresses.push(privateIp);
                logger.info(`Instance ID: ${instanceId}, Private IP: ${privateIp}`);
            }
            
            //Before returning the array remove this nodes IP from the list of IPs we return. A node should not attempt to register with itself
	    const index = privateIPAddresses.indexOf(networkNodeIP); 
            if (index !== -1) privateIPAddresses.splice(index,1);

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

    async function checkNodeIsListening(urlToCheck){

        try{
            logger.info(`Checking if blockchain node is listening on ${urlToCheck}. Node has 3 seconds to respond`);	
            const response = await axios.get(urlToCheck, { timeout: 3000 } );
            logger.info(`${urlToCheck} is listening!`);
            return true;
	} catch {
            logger.info(`Error: a blockchain node does not appear to be listening on ${urlToCheck}`);
            return false;
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
