// appUtils.js

//import 3rd party libraries
const http = require('http');

//import internal modules
const logger = require('./logger');


//Generic function to check port health.
const checkPortHealth = async (hostname, port) => {
    try {
        logger.info(`Checking health of ${hostname}:${port}`); 
	
	// Return a new Promise that checks the port's health. Promise resolves to true
        return await new Promise((resolve, reject) => {
            // Build healthcheck HTTP request
            const options = {
                hostname: hostname, 
                port: port,
                path: '/',
                method: 'GET',
                timeout: 2000
            };

            // Execute HTTP healthcheck
            const req = http.request(options, (res) => {
                // Explicitly check if the response status code is 200 (OK)
                if (res.statusCode === 200) {
                    logger.info(`Healthcheck passed for ${hostname}:${port}`); 
		    resolve(true);  // Resolve the Promise with true if the port is healthy
                } else {
		    resolve(false); // Resolve the Promise with false if the port is not healthy
                }
            });

            // Listen for an error event on the request
            req.on('error', (err) => {
                // If an error occurs, reject the Promise with the error
                reject(err);
            });

            // End the request, signaling that the request is complete
            req.end();
        });
    } catch (err) {
        
	logger.error(`Health check failed for ${hostname}:${port} - ${err.message}`);
        // Return false, port is not healthy
        return false;
    }
};

const makeNetworkNodeURL = (ip, port) => {
    return `http://${ip}:${port}`;
};

module.exports = {
    checkPortHealth//,
    //makeNetworkNodeURL
};

