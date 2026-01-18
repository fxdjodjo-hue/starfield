/**
 * Core Domain Systems - Logica di business centralizzata
 * Sistemi di dominio che orchestrano le funzionalità core del gioco
 */

export { DamageSystem } from './DamageSystem';
export { EntityStateSystem } from './EntityStateSystem';
export { ProjectileFactory } from './ProjectileFactory';
export { CooldownManager } from './CooldownManager';
export { RespawnSystem } from './RespawnSystem';

// Re-export interfaces
export type { DamageResult, DamageContext } from './DamageSystem';
export type { PositionUpdate, HealthUpdate, ShieldUpdate, BehaviorUpdate, EntityStateUpdate } from './EntityStateSystem';
export type { ProjectileConfig } from './ProjectileFactory';
export type { CooldownConfig, RateLimitConfig } from './CooldownManager';
export type { RespawnConfig, RespawnContext } from './RespawnSystem';