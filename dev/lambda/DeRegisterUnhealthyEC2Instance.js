import { ElasticLoadBalancingV2Client, DescribeTargetHealthCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import axios from "axios";

/*
When CloudWatch Alarm notifies Lambda of an unhealthy instance in the TG, to de-register the unhealthy instance from the blockchain network we need the private IP address of the unhealthy instance
Unfortunately instance details are not included in the CloudWatch Alarm event. To retrieve the private IP we would need to :
  1. Query the ELB/TG to get the unhealthy instance id using the TG details provided in the CloudWatch event
  2. Use the instance id to query the EC2 instance to get the private IP
Given the edges cases around instance states (Stopped, Terminated) which may prevent us from successfully retrieving the unhealthy private IP we will instead
  1. Use lambda to identify a HEALTHY instance, and then notify the healthy instance that simply a "deregistration is required"
  2. The logic to identify the UNHEALTHY instance will be handled in nodeRegistration.js 
    a. nodeRegistration.js will cycle through blockchain.networkNodes[]
    b. executing GET requests to the same /heathcheck endpoint the TG uses, until it finds an error
    c. once the unhealthy nodes(s) are identified the HEALTHY node will broadcast a request to the remaining nodes to 'deregister' the bad node
*/

export const handler = async (event) => {
  
  //Extract TG details from CloudWatch Alarm event to construct full TG ARN
  const TgAWSregion = event.region;
  const actNum = event.accountId;
  const targetGroupName = event.alarmData.configuration.metrics[0].metricStat.metric.dimensions.TargetGroup;
  //Final TG ARN
  const targetGroupArn = `arn:aws:elasticloadbalancing:${TgAWSregion}:${actNum}:${targetGroupName}`;
  
  const healthyInstancesIPs = await findHealthyEC2Instances(targetGroupArn);
  
  console.log(`Healthy Private IPs are: ${healthyInstancesIPs}`);
  
  await initiateDeregistrationRequest(healthyInstancesIPs);
  
  //Now to call the /de-register-and-broadcast-node endpoint

  async function initiateDeregistrationRequest(healthyInstancesIPs){
  
    try {
      for (const ip of healthyInstancesIPs){
        const URL = `http://${ip}:3001/app/find-unhealthy-node`;
              
        //send GET request to Url
        console.log(`Sending find-unhealthy-node request to ${URL}`);
        const response = await axios.get(URL);
      
        if (response.status === 200) {
          console.log(`Success: Received response from ${URL}:`, response.data);
          // Exit the loop after the first successful response
          break;
        } else {
          console.log(`Failed with status code: ${response.status}`);
        }
      }
    } catch (error){
        console.log(`Error thrown sending deregistration request. Error: ${error}`);
    }
  }

  //Find a healthy EC2 instance (blockchain node) to notify of the unhealthy instance
  async function findHealthyEC2Instances(targetGroupArn) {
        
    const params = { TargetGroupArn: targetGroupArn };
    let retryCount = 0;
    let healthyInstances = [];
  
    try{  
      const ElbClient = new ElasticLoadBalancingV2Client();
      const command = new DescribeTargetHealthCommand(params)
      
      const data = await ElbClient.send(command);
      healthyInstances = data.TargetHealthDescriptions.filter(
          target => target.TargetHealth.State === 'healthy'
      );
      
      console.log(healthyInstances);
      
      if(healthyInstances.length === 0){
        console.log('No healthy EC2 instances were found, node de-registration not possible'); 
        return [];
  	  }
  	  else {
        //get privateIP addresses for healthy instances
        console.log('Healthy EC2 Instances potentially found, retrieving private IP of each instance');
        const privateIPAddresses = [];
        for (const target of healthyInstances) {
            const instanceId = target.Target.Id;
            const privateIp = await getPrivateIp(instanceId);

            privateIPAddresses.push(privateIp);
            console.log(`Instance ID: ${instanceId}, Private IP: ${privateIp}`);
        }
        return privateIPAddresses;
      }
    } catch (err) {
        console.log(`Error describing target health: ${err}`);
        return [];
    }
  }
  //find the private IP of each healthy EC2 instance
  async function getPrivateIp(instanceId) {

    const params = { InstanceIds: [instanceId] };
    try {
        console.log(`Retrieving private IP for instance ${instanceId}`);
        const ec2Client = new EC2Client();
        const command = new DescribeInstancesCommand(params);
        
        const data = await ec2Client.send(command);
        const instance = data.Reservations[0].Instances[0];
        return instance.PrivateIpAddress;
    } catch (err) {
        console.log(`Error retrieving IP for instance ${instanceId}:, ${err}`);
        return 'N/A';
    }
  }
};
