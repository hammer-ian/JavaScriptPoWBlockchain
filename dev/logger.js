const fs = require('fs');
require('dotenv').config();

const port = process.env.PORT;
const logPath = process.env.LOGFILE_PATH;

function logToFile(message) {
    const logStream = fs.createWriteStream(`${logPath}/logs-${port}.txt`, { flags: 'a' });
    logStream.write(`${message}\n`);
    logStream.end();
}
const logger = {
    info: (message) => logToFile(`[INFO] ${message}`),
    warn: (message) => logToFile(`[WARN] ${message}`),
    error: (message) => logToFile(`[ERROR] ${message}`),
};
module.exports = logger;
