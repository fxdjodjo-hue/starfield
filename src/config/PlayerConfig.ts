/**
 * Configurazione del Player - caricata da file JSON condiviso per coerenza client/server
 * Questo garantisce single source of truth e permette modifiche senza ricompilare
 */

// Import della configurazione condivisa
import playerConfigData from '../../shared/player-config.json';

// Dichiarazione per import JSON
declare module '*.json' {
  const value: any;
  export default value;
}

export interface PlayerStats {
  health: number;
  shield?: number;
  damage: number;
  range: number; // Combat range distance
  rangeWidth?: number; // Width of combat range rectangle
  rangeHeight?: number; // Height of combat range rectangle
  cooldown: number;
  speed: number;
}

export interface PlayerStartingResources {
  credits: number;
  cosmos: number;
  level: number;
  experience: number;
  honor: number;
  skillPoints: number;
}

export interface PlayerSpriteSize {
  width: number;
  height: number;
}

export interface PlayerUpgrades {
  maxHpUpgrades: number;
  maxShieldUpgrades: number;
  maxSpeedUpgrades: number;
  maxDamageUpgrades: number;
}

export interface PlayerDefinition {
  stats: PlayerStats;
  startingResources: PlayerStartingResources;
  spriteSize: PlayerSpriteSize;
  upgrades: PlayerUpgrades;
  description?: string;
}

/**
 * Definizione del giocatore caricata da file JSON condiviso
 */
export const PLAYER_DEFINITION: PlayerDefinition = playerConfigData as PlayerDefinition;

/**
 * Ottiene la definizione del giocatore
 */
export function getPlayerDefinition(): PlayerDefinition {
  return PLAYER_DEFINITION;
}


/**
 * Ottiene la larghezza del rettangolo di range del giocatore
 */
export function getPlayerRangeWidth(): number {
  return PLAYER_DEFINITION.stats.rangeWidth ?? 1280; // Default fallback
}

/**
 * Ottiene l'altezza del rettangolo di range del giocatore
 */
export function getPlayerRangeHeight(): number {
  return PLAYER_DEFINITION.stats.rangeHeight ?? 720; // Default fallback
}
