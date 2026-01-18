/**
 * LoggerWrapper - Logging centralizzato per categoria
 * Sostituisce logger.info/error/warn ripetuti con categorie strutturate
 */

export enum LogCategory {
  COMBAT = 'COMBAT',
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  SECURITY = 'SECURITY',
  GAMEPLAY = 'GAMEPLAY',
  SYSTEM = 'SYSTEM',
  PERFORMANCE = 'PERFORMANCE',
  ECS = 'ECS',
  AI = 'AI'
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogContext {
  userId?: string;
  clientId?: string;
  entityId?: number;
  sessionId?: string;
  [key: string]: any;
}

export class LoggerWrapper {
  private static currentLevel: LogLevel = LogLevel.INFO;
  private static loggers: Map<string, any> = new Map();

  /**
   * Imposta il livello di logging globale
   */
  static setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Registra un logger esterno per una categoria
   */
  static registerLogger(category: LogCategory, logger: any): void {
    this.loggers.set(category, logger);
  }

  /**
   * Ottiene il logger per una categoria (o quello di default)
   */
  private static getLogger(category: LogCategory): any {
    return this.loggers.get(category) || console;
  }

  /**
   * Log di debug
   */
  static debug(category: LogCategory, message: string, context?: LogContext): void {
    if (this.currentLevel > LogLevel.DEBUG) return;
    this.logWithCategory('debug', category, message, context);
  }

  /**
   * Log informativo
   */
  static info(category: LogCategory, message: string, context?: LogContext): void {
    if (this.currentLevel > LogLevel.INFO) return;
    this.logWithCategory('info', category, message, context);
  }

  /**
   * Log di avviso
   */
  static warn(category: LogCategory, message: string, context?: LogContext): void {
    if (this.currentLevel > LogLevel.WARN) return;
    this.logWithCategory('warn', category, message, context);
  }

  /**
   * Log di errore
   */
  static error(category: LogCategory, message: string, error?: Error, context?: LogContext): void {
    if (this.currentLevel > LogLevel.ERROR) return;

    const fullMessage = error ?
      `${message}: ${error.message}\n${error.stack}` :
      message;

    this.logWithCategory('error', category, fullMessage, context);
  }

  /**
   * Log critico (sempre visibile)
   */
  static critical(category: LogCategory, message: string, error?: Error, context?: LogContext): void {
    const fullMessage = error ?
      `${message}: ${error.message}\n${error.stack}` :
      message;

    this.logWithCategory('error', category, `[CRITICAL] ${fullMessage}`, context);
  }

  /**
   * Log di combattimento con contesto strutturato
   */
  static combat(message: string, context?: LogContext & {
    attackerId?: string;
    targetId?: string;
    damage?: number;
    remainingHealth?: number;
  }): void {
    this.info(LogCategory.COMBAT, message, context);
  }

  /**
   * Log di rete con contesto strutturato
   */
  static network(message: string, context?: LogContext & {
    messageType?: string;
    clientId?: string;
    userId?: string;
    latency?: number;
  }): void {
    this.info(LogCategory.NETWORK, message, context);
  }

  /**
   * Log di database con contesto strutturato
   */
  static database(message: string, context?: LogContext & {
    operation?: string;
    table?: string;
    userId?: string;
    duration?: number;
  }): void {
    this.info(LogCategory.DATABASE, message, context);
  }

  /**
   * Log di sicurezza con contesto strutturato
   */
  static security(message: string, context?: LogContext & {
    action?: string;
    clientId?: string;
    userId?: string;
    ip?: string;
    reason?: string;
  }): void {
    this.warn(LogCategory.SECURITY, message, context);
  }

  /**
   * Log di gameplay con contesto strutturato
   */
  static gameplay(message: string, context?: LogContext & {
    playerId?: string;
    action?: string;
    entityId?: number;
    position?: { x: number; y: number };
  }): void {
    this.debug(LogCategory.GAMEPLAY, message, context);
  }

  /**
   * Log di sistema con contesto strutturato
   */
  static system(message: string, context?: LogContext & {
    component?: string;
    operation?: string;
    duration?: number;
    memoryUsage?: number;
  }): void {
    this.info(LogCategory.SYSTEM, message, context);
  }

  /**
   * Log di performance con contesto strutturato
   */
  static performance(message: string, context?: LogContext & {
    operation?: string;
    duration?: number;
    memoryDelta?: number;
    fps?: number;
  }): void {
    this.debug(LogCategory.PERFORMANCE, message, context);
  }

  /**
   * Log ECS con contesto strutturato
   */
  static ecs(message: string, context?: LogContext & {
    entityId?: number;
    component?: string;
    operation?: string;
    entityCount?: number;
  }): void {
    this.debug(LogCategory.ECS, message, context);
  }

  /**
   * Log AI con contesto strutturato
   */
  static ai(message: string, context?: LogContext & {
    npcId?: string;
    behavior?: string;
    targetId?: string;
    decision?: string;
  }): void {
    this.debug(LogCategory.AI, message, context);
  }

  /**
   * Log con categoria generico
   */
  private static logWithCategory(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: LogCategory,
    message: string,
    context?: LogContext
  ): void {
    const logger = this.getLogger(category);
    const timestamp = new Date().toISOString();
    const categoryPrefix = `[${category}]`;

    let fullMessage = `${categoryPrefix} ${message}`;

    // Aggiungi contesto se presente
    if (context && Object.keys(context).length > 0) {
      try {
        const contextStr = JSON.stringify(context);
        fullMessage += ` | Context: ${contextStr}`;
      } catch (error) {
        fullMessage += ` | Context: [Failed to serialize]`;
      }
    }

    // Usa il logger appropriato
    if (logger && typeof logger[level] === 'function') {
      logger[level](fullMessage);
    } else {
      // Fallback a console
      console[level](`${timestamp} ${fullMessage}`);
    }
  }

  /**
   * Crea un logger per una categoria specifica
   */
  static createCategoryLogger(category: LogCategory) {
    return {
      debug: (message: string, context?: LogContext) => this.debug(category, message, context),
      info: (message: string, context?: LogContext) => this.info(category, message, context),
      warn: (message: string, context?: LogContext) => this.warn(category, message, context),
      error: (message: string, error?: Error, context?: LogContext) => this.error(category, message, error, context),
      critical: (message: string, error?: Error, context?: LogContext) => this.critical(category, message, error, context)
    };
  }

  /**
   * Ottiene statistiche sui logger registrati
   */
  static getRegisteredLoggers(): string[] {
    return Array.from(this.loggers.keys());
  }
}