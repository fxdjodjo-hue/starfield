/**
 * Core Utilities - Moduli centralizzati per funzionalità comuni
 * Punto di ingresso unificato per tutti i utility del sistema
 */

export { MathUtils } from './MathUtils';
export { IDGenerator } from './IDGenerator';
export { TimeManager } from './TimeManager';
export { InputValidator } from './InputValidator';
export { MessageSerializer } from './MessageSerializer';
export { AtlasParser } from './AtlasParser';

// Config utilities
export { CONFIG } from './config/GameConfig';
export { ConfigValidator } from './config/ConfigValidator';
export { getFormattedVersion } from './config/AppVersion';

// Rendering utilities
export { NpcRenderer } from './rendering/NpcRenderer';
export { ProjectileRenderer } from './rendering/ProjectileRenderer';
export { PlayerRenderer } from './rendering/PlayerRenderer';
export { SpaceStationRenderer } from './rendering/SpaceStationRenderer';
export { HudRenderer } from './rendering/HudRenderer';
export { ExplosionRenderer } from './rendering/ExplosionRenderer';
export { RepairEffectRenderer } from './rendering/RepairEffectRenderer';
export { EngineFlamesRenderer } from './rendering/EngineFlamesRenderer';
export { ScreenSpace } from './rendering/ScreenSpace';
export { SpriteRenderer } from './rendering/SpriteRenderer';
export { SpritesheetRenderer } from './rendering/SpritesheetRenderer';
export { applyFadeIn, UI_FADE_CONFIG } from './rendering/UIFadeAnimation';

// Re-export interfaces
export type { DirectionResult, Position } from './MathUtils';
export type { ValidationResult } from './InputValidator';
export type { SerializationResult } from './MessageSerializer';

// Rendering interfaces
export type { ProjectileRenderParams } from './rendering/ProjectileRenderer';
export type { HealthBarRenderParams } from './rendering/HudRenderer';
export type { ExplosionRenderParams } from './rendering/ExplosionRenderer';
export type { RenderableTransform } from './rendering/SpriteRenderer';
export type { SpritesheetRenderTransform } from './rendering/SpritesheetRenderer';