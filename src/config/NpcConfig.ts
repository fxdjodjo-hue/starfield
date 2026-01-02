/**
 * Configurazione degli NPC - definisce statistiche e ricompense per ogni tipo di NPC
 * Questo permette di aggiungere facilmente nuovi tipi di NPC in futuro
 */

export interface NpcStats {
  health: number;
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

export interface NpcDefinition {
  type: string;
  defaultBehavior: string;
  stats: NpcStats;
  rewards: NpcRewards;
  description?: string;
}

/**
 * Definizioni di tutti gli NPC del gioco
 */
export const NPC_DEFINITIONS: Record<string, NpcDefinition> = {
  'Scouter': {
    type: 'Scouter',
    defaultBehavior: 'wander',
    stats: {
      health: 40,
      damage: 12,
      range: 220,
      cooldown: 1200, // 1.2 secondi
    },
    rewards: {
      credits: 824,
      cosmos: 3,
      experience: 412,
      honor: 2
    },
    description: 'Nemico base dello spazio profondo'
  }
};

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
