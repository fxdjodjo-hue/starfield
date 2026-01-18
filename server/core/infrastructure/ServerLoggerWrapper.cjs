// ServerLoggerWrapper - Wrapper di logging per server che usa il logger esistente
// Adatta LoggerWrapper per funzionare con il sistema server esistente

const { logger } = require('../../logger.cjs');

class ServerLoggerWrapper {
  static debug(category, message, context) {
    // Server non ha livelli di debug verbosi, usa info per debug importante
    if (process.env.NODE_ENV === 'development') {
      this._logWithContext('info', category, `[DEBUG] ${message}`, context);
    }
  }

  static info(category, message, context) {
    this._logWithContext('info', category, message, context);
  }

  static warn(category, message, context) {
    this._logWithContext('warn', category, message, context);
  }

  static error(category, message, error, context) {
    const fullMessage = error ? `${message}: ${error.message}` : message;
    this._logWithContext('error', category, fullMessage, context);
  }

  static critical(category, message, error, context) {
    const fullMessage = error ? `[CRITICAL] ${message}: ${error.message}` : `[CRITICAL] ${message}`;
    this._logWithContext('error', category, fullMessage, context);
  }

  // Metodi specializzati per categoria
  static combat(message, context) {
    this.info('COMBAT', message, context);
  }

  static network(message, context) {
    this.info('NETWORK', message, context);
  }

  static database(message, context) {
    this.info('DATABASE', message, context);
  }

  static security(message, context) {
    this.warn('SECURITY', message, context);
  }

  static gameplay(message, context) {
    this.debug('GAMEPLAY', message, context);
  }

  static system(message, context) {
    this.info('SYSTEM', message, context);
  }

  static performance(message, context) {
    this.debug('PERFORMANCE', message, context);
  }

  static ecs(message, context) {
    this.debug('ECS', message, context);
  }

  static ai(message, context) {
    this.debug('AI', message, context);
  }

  static _logWithContext(level, category, message, context) {
    try {
      let fullMessage = message;

      // Aggiungi contesto se presente
      if (context && Object.keys(context).length > 0) {
        const contextStr = JSON.stringify(context);
        fullMessage += ` | Context: ${contextStr}`;
      }

      // Usa il logger server esistente
      if (logger && typeof logger[level] === 'function') {
        logger[level](`${category}: ${fullMessage}`);
      } else {
        console[level](`${category}: ${fullMessage}`);
      }
    } catch (error) {
      // Fallback in caso di errori
      console.error(`Logger error: ${error.message}`);
      console[level](`${category}: ${message}`);
    }
  }
}

module.exports = ServerLoggerWrapper;