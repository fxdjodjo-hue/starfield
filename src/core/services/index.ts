/**
 * Core Infrastructure - Sistemi infrastrutturali centralizzati
 * Gestione risorse, comunicazione, persistenza
 */

export { BroadcastManager } from './BroadcastManager';
export { AssetLoader } from './AssetLoader';
export { AssetManager } from './AssetManager';
export { DOMEventManager } from './DOMEventManager';

// Re-export interfaces
export type { BroadcastOptions, BroadcastContext } from './BroadcastManager';
export type { AssetLoadOptions, AssetLoadResult, AssetStats } from './AssetLoader';
export type { EventHandler, EventStats } from './DOMEventManager';