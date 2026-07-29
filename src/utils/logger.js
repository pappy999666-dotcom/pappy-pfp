const pino = require('pino');
const pretty = require('pino-pretty');
const { Writable } = require('stream');
const config = require('../config');
const logBuffer = require('./logBuffer');

const prettyStream = pretty({
  colorize: false,
  translateTime: 'SYS:standard',
  ignore: 'pid,hostname',
  sync: true,
});

// Tee stream: writes to pino-pretty AND the in-memory buffer
const tee = new Writable({
  write(chunk, _enc, cb) {
    const line = chunk.toString().trimEnd();
    prettyStream.write(chunk);
    logBuffer.push(line);
    cb();
  },
});

const logger = pino({ level: config.logLevel }, tee);

module.exports = logger;
