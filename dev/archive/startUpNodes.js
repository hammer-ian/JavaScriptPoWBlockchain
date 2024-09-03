const { spawn } = require('child_process');
const rp = require('request-promise');
//requried for logging
const logger = require('./logger');

networkHosts = ['http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005'];

const childProcessObjArr = [];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function startUpNodes() {

    for (let i = 0; i < networkHosts.length; i++) {

        hostURL = networkHosts[i];
        port = hostURL.substring(hostURL.length - 4, hostURL.length);
        console.log("Starting network node on ", hostURL, " ", port);

        let cmd = "node";
        let args = `./dev/networkNode.js ${port} ${hostURL}`.split(" ");

        const childProcessObj = spawn(cmd, args, {
            stdio: 'ignore', //pipe all stdio to /dev/null because we have a logger defined
            detached: true,
            env: process.env
        })

        childProcessObj.unref();
        childProcessObjArr.push(childProcessObj);

        //write PID to file so we can automate stopping the network later

    }
}

function registerNodes() {

    const registerNodePromises = [];

    //get first network host
    const hostToCall = networkHosts[0];

    //Loop through the other network hosts creating a request to register the new node
    for (let i = 1; i < networkHosts.length; i++) {

        const requestOptions = {
            uri: hostToCall + '/register-and-broadcast-node',
            method: 'POST',
            body: { newNodeURL: networkHosts[i] },
            json: true
        };
        //Add each register request to array
        //calling rp (request-promise) wraps the request in a Promise before adding it to the array
        registerNodePromises.push(rp(requestOptions));
    };

    Promise.all(registerNodePromises)
        .then(data => {
            console.log("New hosts registered and broadcast successfully");
        });

}

async function main() {
    startUpNodes();
    // Wait for 5 seconds before trying to register new nodes so endpoints are available
    await sleep(5000);
    registerNodes();
}

main();