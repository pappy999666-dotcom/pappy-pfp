'use strict';

// In-memory circular log buffer — last 200 lines
const MAX = 200;
const _buf = [];

function push(line) {
  _buf.push({ t: Date.now(), line });
  if (_buf.length > MAX) _buf.shift();
}

function getLast(n = 50) {
  return _buf.slice(-n);
}

module.exports = { push, getLast };
