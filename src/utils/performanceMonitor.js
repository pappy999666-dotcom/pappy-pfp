'use strict';
// Lightweight performance monitor

const logger = require('./logger');
const os = require('os');

let _startTime = Date.now();
let _interval = null;

function getMemoryMB() {
  const mem = process.memoryUsage();
  return {
    rss:      Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    external: Math.round(mem.external / 1024 / 1024),
  };
}

function getUptime() {
  const secs = Math.floor((Date.now() - _startTime) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}h ${m}m ${s}s`;
}

function getCpuLoad() {
  const load = os.loadavg();
  return { '1m': load[0].toFixed(2), '5m': load[1].toFixed(2), '15m': load[2].toFixed(2) };
}

function logStats() {
  const mem = getMemoryMB();
  const cpu = getCpuLoad();
  logger.info(`[Perf] Uptime: ${getUptime()} | RSS: ${mem.rss}MB | Heap: ${mem.heapUsed}/${mem.heapTotal}MB | CPU Load: ${cpu['1m']}(1m)`);
}

function start(intervalMs = 30 * 60 * 1000) {
  if (_interval) return;
  _interval = setInterval(logStats, intervalMs);
  if (_interval?.unref) _interval.unref();
  logger.info('[Perf] Performance monitor started');
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

function snapshot() {
  return {
    uptime: getUptime(),
    memory: getMemoryMB(),
    cpu: getCpuLoad(),
    freeMemMB: Math.round(os.freemem() / 1024 / 1024),
    totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
  };
}

module.exports = { start, stop, logStats, snapshot, getMemoryMB, getUptime, getCpuLoad };
