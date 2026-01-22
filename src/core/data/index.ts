/**
 * Core Data Structures - Moduli centralizzati per gestione dati
 * Punto di ingresso unificato per tutti i data structures del sistema
 */

export { CollectionManager } from './CollectionManager';
export { ComponentHelper } from './ComponentHelper';
export { LoggerWrapper, LogCategory, LogLevel } from './LoggerWrapper';

// Re-export interfaces
export type { CollectionStats } from './CollectionManager';
export type { LogContext } from './LoggerWrapper';