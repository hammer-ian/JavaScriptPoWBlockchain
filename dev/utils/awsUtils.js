const AWS = require('aws-sdk'); //required to call AWS services

const logger = require('./logger');

async function findHealthyEC2Instances(AWSregion, targetGroupArn, interval = 10000, maxRetries = 5) {

    //Specify AWS Region & TargetGroup
    AWS.config.update({ region: AWSregion });
    const params = { TargetGroupArn: targetGroupArn };

    //ELBv2 client to query Target Group
    const elbv2 = new AWS.ELBv2();

    let retryCount = 0;

    try {
        let healthyInstances = [];

        while (healthyInstances.length === 0 && retryCount < maxRetries) {
            logger.info('Looking for healthy EC2 instance to register with');
            const data = await elbv2.describeTargetHealth(params).promise();
            healthyInstances = data.TargetHealthDescriptions.filter(
                target => target.TargetHealth.State === 'healthy'
            );

            if (healthyInstances.length === 0) {
                retryCount++;
                logger.info(`No healthy instances found, Retrying in ${interval / 1000} seconds`);
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }
        //very unlikely to find zero healthy EC2 instances as the runtime that's executing this code is hosted on an EC2 instance, but just in case.. 
        if (healthyInstances.length === 0) {
            logger.info('No healthy EC2 instances were found after max retries, node registration not possible');
            return [];
        }

        logger.info('Healthy EC2 Instances potentially found, now retrieving the private of IP of each instance to double check');
        const privateIPAddresses = [];
        for (const target of healthyInstances) {
            const instanceId = target.Target.Id;
            const privateIp = await getPrivateIp(instanceId);

            privateIPAddresses.push(privateIp);
            logger.info(`Instance ID: ${instanceId}, Private IP: ${privateIp}`);
        }

        //return internal (private) IP address of a healthy instances so we can register our new node
        return privateIPAddresses;

    } catch (err) {
        logger.info(`Error describing target health: ${err}`);
        return [];
    }
    async function getPrivateIp(instanceId) {
        //EC2 client to query AWS
        const ec2 = new AWS.EC2();

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
}



module.exports = {
    findHealthyEC2Instances
};
