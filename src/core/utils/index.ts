/**
 * Core Utilities - Moduli centralizzati per funzionalità comuni
 * Punto di ingresso unificato per tutti i utility del sistema
 */

export { MathUtils } from './MathUtils';
export { IDGenerator } from './IDGenerator';
export { TimeManager } from './TimeManager';
export { InputValidator } from './InputValidator';
export { MessageSerializer } from './MessageSerializer';

// Config utilities
export { CONFIG } from './config/Config';
export { ConfigValidator } from './config/ConfigValidator';
export { getFormattedVersion } from './config/Version';

// Re-export interfaces
export type { DirectionResult, Position } from './MathUtils';
export type { ValidationResult } from './InputValidator';
export type { SerializationResult } from './MessageSerializer';