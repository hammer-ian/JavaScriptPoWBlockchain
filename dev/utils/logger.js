const path = require('path');
const { createLogger, format, transports } = require('winston');
require('dotenv').config();

const port = process.env.PORT;
const logDirPath = process.env.LOG_DIR_PATH;
const fileName = process.env.LOGFILE_NAME || 'blockchain-node.log';

if (!port || !logDirPath) {
    throw new Error ('Missing environment variables: PORT or LOG_DIR_PATH');
}

const logFilePath = path.join(logDirPath, fileName);

// Create the Winston logger
const logger = createLogger({
  level: 'info',  // Set the log level
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),  // Add timestamps
    format.json()  // Log in JSON format
  ),
  transports: [
    new transports.Console(),  // Output to console
    new transports.File({ filename: logFilePath })  // Output to file
  ],
});


module.exports = logger;
