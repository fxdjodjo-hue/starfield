/**
 * Core Domain Systems - Logica di business centralizzata
 * Sistemi di dominio che orchestrano le funzionalità core del gioco
 */

export { DamageSystem } from './DamageSystem';
export { EntityStateSystem } from './EntityStateSystem';
export { ProjectileFactory } from './ProjectileFactory';
export { CooldownManager } from './CooldownManager';
export { RespawnSystem } from './RespawnSystem';

// Domain modules
export { QuestManager } from './quest/QuestManager';
export { RankSystem } from './rewards/RankSystem';

// Economy domain
export { CurrencyManager } from './economy/CurrencyManager';
export { ProgressionManager } from './economy/ProgressionManager';
export { HonorManager } from './economy/HonorManager';
export { EconomyEventManager } from './economy/EconomyEventManager';
export { EconomyStatusManager } from './economy/EconomyStatusManager';
export { EconomyUIDisplayManager } from './economy/EconomyUIDisplayManager';

// Re-export interfaces
export type { DamageResult, DamageContext } from './DamageSystem';
export type { PositionUpdate, HealthUpdate, ShieldUpdate, BehaviorUpdate, EntityStateUpdate } from './EntityStateSystem';
export type { ProjectileConfig } from './ProjectileFactory';
export type { CooldownConfig, RateLimitConfig } from './CooldownManager';
export type { RespawnConfig, RespawnContext } from './RespawnSystem';