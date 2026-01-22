/**
 * @fileoverview Sistema di logging strutturato per il server Starfield
 * @description Logger centralizzato con livelli di severità, colori e monitoraggio performance
 */

// Sistema di logging migliorato
const LOG_LEVELS = {
  ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3
};

const LOG_COLORS = {
  ERROR: '\x1b[31m', WARN: '\x1b[33m', INFO: '\x1b[32m', DEBUG: '\x1b[34m', RESET: '\x1b[0m', BOLD: '\x1b[1m'
};

class Logger {
  constructor(logLevel = LOG_LEVELS.INFO) {
    this.logLevel = logLevel;
  }

  error(module, message, data = null) {
    if (this.logLevel >= LOG_LEVELS.ERROR) {
      const timestamp = new Date().toISOString();
      console.error(`${LOG_COLORS.ERROR}[${timestamp}] ${LOG_COLORS.BOLD}ERROR${LOG_COLORS.RESET} [${module}] ${message}`, data || '');
    }
  }

  warn(module, message, data = null) {
    if (this.logLevel >= LOG_LEVELS.WARN) {
      const timestamp = new Date().toISOString();
      console.warn(`${LOG_COLORS.WARN}[${timestamp}] ${LOG_COLORS.BOLD}WARN${LOG_COLORS.RESET} [${module}] ${message}`, data || '');
    }
  }

  info(module, message, data = null) {
    if (this.logLevel >= LOG_LEVELS.INFO) {
      const timestamp = new Date().toISOString();
      console.info(`${LOG_COLORS.INFO}[${timestamp}] ${LOG_COLORS.BOLD}INFO${LOG_COLORS.RESET} [${module}] ${message}`, data || '');
    }
  }

  debug(module, message, data = null) {
    if (this.logLevel >= LOG_LEVELS.DEBUG) {
      const timestamp = new Date().toISOString();
      console.debug(`${LOG_COLORS.DEBUG}[${timestamp}] ${LOG_COLORS.BOLD}DEBUG${LOG_COLORS.RESET} [${module}] ${message}`, data || '');
    }
  }
}

// Determina livello log basato sull'ambiente
const isProduction = process.env.NODE_ENV === 'production';
const defaultLogLevel = isProduction ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

// Permetti override tramite variabile d'ambiente
const logger = new Logger(process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : defaultLogLevel);

// Monitoraggio performance messaggi
let messageCount = 0;
let lastMessageCountReset = Date.now();

// Reset contatore ogni 30 secondi e log performance condizionale
setInterval(() => {
  const now = Date.now();
  const elapsed = (now - lastMessageCountReset) / 1000; // secondi
  const mps = messageCount / elapsed;

  // In produzione logga solo anomalie o a intervalli più lunghi
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldLog = !isProduction || mps > 50 || mps < 1; // Log anomalie in produzione

  if (shouldLog) {
    logger.debug('PERF', `Message throughput: ${messageCount} messages in ${elapsed.toFixed(1)}s (${mps.toFixed(1)} msg/s)`);
  }

  messageCount = 0;
  lastMessageCountReset = now;
}, 30000);

const messageCountProxy = {
  get: () => messageCount,
  increment: () => messageCount++
};

module.exports = { logger, messageCount: messageCountProxy };