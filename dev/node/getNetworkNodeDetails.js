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

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // We're interested in non-internal, IPv4 addresses
            if (net.family === 'IPv4' && !net.internal) {
                networkNodeIP = net.address;
                break;
            }
        }
        if (networkNodeIP) break;  // Stop when we've found the local IP
    }

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

module.exports = {
    getNetworkNodeDetails
};

