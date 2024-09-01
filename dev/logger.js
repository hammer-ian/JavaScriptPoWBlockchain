const fs = require('fs');
require('dotenv').config();

const port = process.env.PORT;
const logPath = process.env.LOGFILE_PATH;

if (!port || !logPath) {
    throw new Error ('Missing environment variables: PORT or LOGFILE_PATH');
}

//open log stream, and do not close it until application is shut down
const logStream = fs.createWriteStream(`${logPath}/logs-${port}.txt`, { flags: 'a' });

function logToFile(message) {
    const timestamp = new Date().toISOString();
    logStream.write(`[${timestamp}] ${message}\n`); 
}

const logger = {
    info: (message) => logToFile(`[INFO] ${message}`),
    warn: (message) => logToFile(`[WARN] ${message}`),
    error: (message) => logToFile(`[ERROR] ${message}`),
};

// Handle application shutdown to close the log stream properly
function handleShutdown() {
    logStream.end(() => {
        logToFile('Log stream closed.');
    });
}

// Listen for process termination signals from Node and the exit event
process.on('exit', handleShutdown ); // Normal exit

process.on('SIGINT', () => {
    logToFile('Received SIGINT. Shutting down...');
    handleShutdown();
    process.exit(); // Exit explicitly after closing the stream
});

process.on('SIGTERM', () => {
    logToFile('Received SIGTERM. Shutting down...');
    handleShutdown();
    process.exit(); // Exit explicitly after closing the stream
});

module.exports = logger;
