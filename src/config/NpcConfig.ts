/**
 * Configurazione degli NPC - carica da file JSON condiviso per single source of truth
 * Questo garantisce coerenza tra client e server
 */

export interface NpcStats {
  health: number;
  shield: number;
  damage: number;
  range: number;
  cooldown: number;
  speed?: number; // Opzionale, se non specificato usa movimento normale
}

export interface NpcRewards {
  credits: number;
  cosmos: number;
  experience: number;
  honor: number;
}

export interface NpcAI {
  aggressionLevel: 'low' | 'medium' | 'high';
  targetPriority: 'nearest' | 'weakest' | 'players' | 'defense';
  formation: 'scattered' | 'patrol' | 'pack' | 'solo' | 'swarm';
}

export interface NpcDefinition {
  type: string;
  defaultBehavior: string;
  stats: NpcStats;
  rewards: NpcRewards;
  spawns?: string[]; // Tipi di NPC che questo NPC può generare
  ai?: NpcAI; // Configurazione AI avanzata
  description?: string;
}

// Carica configurazione condivisa
import npcConfigData from '../../shared/npc-config.json';

// Dichiarazione per import JSON
declare module '*.json' {
  const value: any;
  export default value;
}

/**
 * Definizioni di tutti gli NPC del gioco - caricate da file condiviso
 */
export const NPC_DEFINITIONS: Record<string, NpcDefinition> = npcConfigData as Record<string, NpcDefinition>;

/**
 * Ottiene la definizione di un NPC per tipo
 */
export function getNpcDefinition(npcType: string): NpcDefinition | null {
  return NPC_DEFINITIONS[npcType] || null;
}

/**
 * Ottiene tutti i tipi di NPC disponibili
 */
export function getAllNpcTypes(): string[] {
  return Object.keys(NPC_DEFINITIONS);
}
