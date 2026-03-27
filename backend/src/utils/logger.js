'use strict';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[LOG_LEVEL] !== undefined ? LEVELS[LOG_LEVEL] : LEVELS.info;

function write(level, message, meta = {}) {
  if (LEVELS[level] > currentLevel) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const output = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};

module.exports = logger;
