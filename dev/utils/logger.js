const path = require('path');
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
    const callerInfo = getCallerInfo();
    logStream.write(`[${timestamp}] [${callerInfo}] ${message}\n`); 
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

function getCallerInfo() {
    const originalFunc = Error.prepareStackTrace;

    try {
        const err = new Error();
        Error.prepareStackTrace = (_, stack) => stack;
        const stack = err.stack;
        const caller = stack[3]; // Stack[2] is the caller of the logging function
        const fileName = path.basename(caller.getFileName());
        const lineNumber = caller.getLineNumber();
        const functionName = caller.getFunctionName() || 'anonymous function';
        return `${fileName}:${lineNumber} (${functionName})`;
    } catch (e) {
        return `unknown location ${e}`;
    } finally {
        Error.prepareStackTrace = originalFunc;
    }
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
