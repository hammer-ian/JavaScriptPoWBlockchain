const path = require('path');
const { createLogger, format, transports } = require('winston');
const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");
require('dotenv').config();

const port = process.env.PORT;
const logDirPath = process.env.LOG_DIR_PATH;
const fileName = process.env.LOGFILE_NAME || 'blockchain-node.log';
const loggingStreamEnabled = process.env.LOGGING_STREAM_ENABLED === 'true';

// logtail client for streaming
let logtail;
// Winston logger
const loggerTransports = [];

if (loggingStreamEnabled) {
  logtail = new Logtail(process.env.BETTER_STACK_SOURCE);
  // Add Logtail transport if log streaming is enabled
  loggerTransports.push(new LogtailTransport(logtail));
}

//Build filepath for logging to local file
if (!port || !logDirPath) {
  throw new Error('Missing environment variables: PORT or LOG_DIR_PATH');
}
const logFilePath = path.join(logDirPath, fileName);
loggerTransports.push(new transports.File({ filename: logFilePath }));


const getCaller = format((info) => {
  const stack = new Error().stack.split('\n');

  // Loop through the stack to find the first caller that isn't from node_modules
  for (let i = 4; i < stack.length; i++) {
    const logOrigin = stack[i].match(/\((.*):(\d+):\d+\)/);
    if (logOrigin && !logOrigin[1].includes('node_modules') && !logOrigin[1].includes('internal')) {
      const fullPath = logOrigin[1];
      info.file = path.basename(fullPath); // Extract just the filename from the full path
      info.line = logOrigin[2]; // Line number
      break;
    }
  }

  return info;
});

// Create the Winston logger
const logger = createLogger({
  level: 'info',  // Set the log level
  defaultMeta: {
    networkNode: 'Network Node Not Set!' //should be set dynamically by setNetworkNode()
  },
  format: format.combine(
    getCaller(), //Add filename and line number 
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // Add timestamps
    format.json()
  ),
  transports: loggerTransports,
});

// Function to update the blockchainNode metadata dynamically
logger.setNetworkNode = function (networkNodeURL) {
  this.defaultMeta.networkNode = networkNodeURL;
};

function signalHandler(signal) {
  // do some stuff here
  logger.info(`${signal} received. Terminating blockchain node`);
  process.exit()
}

process.on('SIGINT', signalHandler);
process.on('SIGTERM', signalHandler);
process.on('SIGQUIT', signalHandler);

module.exports = logger;
