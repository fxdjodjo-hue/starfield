/**
 * Core Architecture - Sistemi architetturali centralizzati
 * Classi base e factory per gestione entità e comunicazione
 */

export { RemoteEntitySystem } from './RemoteEntitySystem';
export { EntityFactory } from './EntityFactory';
export { MessageValidator } from './MessageValidator';
export { PlayerStatsCalculator } from './PlayerStatsCalculator';

// Re-export interfaces
export type { RemoteEntityData, RemoteEntityConfig } from './RemoteEntitySystem';
export type { BaseEntityConfig, CombatEntityConfig, ProgressionEntityConfig, FullEntityConfig } from './EntityFactory';
export type { ValidationResult, RateLimitContext } from './MessageValidator';
export type { PlayerUpgrades, PlayerStats, UpgradeValidation } from './PlayerStatsCalculator';