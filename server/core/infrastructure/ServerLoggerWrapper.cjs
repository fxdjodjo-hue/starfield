// ServerLoggerWrapper - Wrapper di logging per server che usa il logger esistente
// Adatta LoggerWrapper per funzionare con il sistema server esistente

const { logger } = require('../../logger.cjs');

class ServerLoggerWrapper {
  static debug(category, message, context = null) {
    this._logWithContext('debug', category, message, context);
    return null;
  }

  static info(category, message, context = null) {
    this._logWithContext('info', category, message, context);
    return null;
  }

  static warn(category, message, context = null) {
    this._logWithContext('warn', category, message, context);
    return null;
  }

  static error(category, message, error, context = null) {
    const fullMessage = error ? `${message}: ${error.message}` : message;
    this._logWithContext('error', category, fullMessage, context);
    return null;
  }

  static critical(category, message, error, context = null) {
    const fullMessage = error ? `[CRITICAL] ${message}: ${error.message}` : `[CRITICAL] ${message}`;
    this._logWithContext('error', category, fullMessage, context);
    return null;
  }

  // Metodi specializzati per categoria
  static combat(message, context = null) {
    this.info('COMBAT', message, context);
    return null;
  }

  static network(message, context = null) {
    this.info('NETWORK', message, context);
    return null;
  }

  static database(message, context = null) {
    this.info('DATABASE', message, context);
    return null;
  }

  static security(message, context = null) {
    this.warn('SECURITY', message, context);
    return null;
  }

  static gameplay(message, context = null) {
    this.info('GAMEPLAY', message, context);
    return null;
  }

  static system(message, context = null) {
    this.info('SYSTEM', message, context);
    return null;
  }

  static performance(message, context = null) {
    this.debug('PERFORMANCE', message, context);
    return null;
  }

  static ecs(message, context = null) {
    this.debug('ECS', message, context);
    return null;
  }

  static ai(message, context = null) {
    this.debug('AI', message, context);
    return null;
  }

  static _logWithContext(level, category, message, context = null) {
    try {
      let fullMessage = message;

      // Se c'è un context object valido, serializzalo
      if (context && typeof context === 'object' && Object.keys(context).length > 0) {
        // Filtra i valori undefined/null prima di serializzare
        const cleanContext = Object.fromEntries(
          Object.entries(context).filter(([_, value]) => value !== undefined && value !== null)
        );
        if (Object.keys(cleanContext).length > 0) {
          const contextStr = JSON.stringify(cleanContext);
          fullMessage += ` | Context: ${contextStr}`;
        }
      }

      // PASSA AL LOGGER BASE CON LA FIRMA CORRETTA: module, message, data
      if (logger && typeof logger[level] === 'function') {
        logger[level](category, fullMessage);
      } else {
        console[level](`[${category}] ${fullMessage}`);
      }
    } catch (error) {
      // Fallback in caso di errori
      console.error(`Logger error: ${error.message}`);
      console[level](`${category}: ${message}`);
    }

    // VOID-SAFE: Ritorna null invece di undefined
    return null;
  }
}

module.exports = ServerLoggerWrapper;