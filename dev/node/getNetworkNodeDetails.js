//import 3rd party libraries
const { networkInterfaces } = require('os'); //access host network info
require('dotenv').config();

//import internal modules
const logger = require('../utils/logger');

//create networkNode URL using information from the host
const getNetworkNodeDetails = () => {

    logger.info(`Setting Network node URL`);
    let networkNodeIP;
    const nets = networkInterfaces();
    //const results = Object.create(null); // Or just '{}', an empty object

    // Loop through network interfaces
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // We're interested in non-internal, IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                // Prioritize selecting from the "Ethernet" adapter
                //if (name === 'Ethernet') {
                networkNodeIP = net.address;
                break;
                //}
            }
        }
        if (networkNodeIP) break;  // Stop when we've found the local IP
    }
    logger.info(`Host network interfaces: ${JSON.stringify(nets)}`);
    logger.info(`Host IP retrieved from network interface is: ${networkNodeIP}`);
    //read PORT from .env configuration file 
    const networkNodePort = process.env.PORT;

    const networkNodeURL = `http://${networkNodeIP}:${networkNodePort}`;
    logger.info(`Network node URL is ${networkNodeURL}`);
    logger.setNetworkNode(`${networkNodeURL}`);

    return {
        networkNodeIP: networkNodeIP,
        networkNodePort: networkNodePort,
        networkNodeURL: networkNodeURL
    };
};

const getNodeCreditAddress = () => {

    const serviceName = process.env.SERVICE_NAME;
    logger.info(`Returning default account address for node: ${serviceName}`);

    if (serviceName === 'node1') {
        return process.env.NODE1_ADDRESS;

    } else if (serviceName === 'node2') {
        return process.env.NODE2_ADDRESS;

    } else if (serviceName === 'node3') {
        return process.env.NODE3_ADDRESS;
    }
};

module.exports = {
    getNetworkNodeDetails,
    getNodeCreditAddress
};

