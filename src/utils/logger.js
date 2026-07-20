const pino = require('pino');
const pretty = require('pino-pretty');
const config = require('../config');

// Use synchronous pino-pretty stream so all logs reach the workflow console
// (async worker-thread transport can be swallowed by Replit's log capture)
const stream = pretty({
  colorize: false,          // plain text — easier to grep in workflow logs
  translateTime: 'SYS:standard',
  ignore: 'pid,hostname',
  sync: true,               // flush synchronously → always visible in workflow log
});

const logger = pino({ level: config.logLevel }, stream);

module.exports = logger;
