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
    const results = Object.create(null); // Or just '{}', an empty object

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
            // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
            if (net.family === familyV4Value && !net.internal) {
                if (!results[name]) {
                    results[name] = [];
                }
                results[name].push(net.address);
            }
        }
    }
    if (process.env.ENVIRONMENT === 'PROD' || !process.env.ENVIRONMENT) {
        //get ip from Linux filesystem
        networkNodeIP = results['enX0'][0];
    } else {
        networkNodeIP = process.env.ENVIRONMENT_TEMP_IP;
    }

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

