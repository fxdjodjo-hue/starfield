/**
 * Configurazione degli NPC - definisce statistiche e ricompense per ogni tipo di NPC
 * Questo permette di aggiungere facilmente nuovi tipi di NPC in futuro
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
    defaultBehavior: 'cruise',
    stats: {
      health: 800,
      shield: 560,
      damage: 500,
      range: 220,
      cooldown: 1200, // 1.2 secondi
      speed: 200
    },
    rewards: {
      credits: 824,
      cosmos: 3,
      experience: 412,
      honor: 2
    },
    description: 'Nemico base dello spazio profondo'
  },
  'Frigate': {
    type: 'Frigate',
    defaultBehavior: 'patrol',
    stats: {
      health: 1200,
      shield: 840,
      damage: 750,
      range: 250,
      cooldown: 1500, // 1.5 secondi
      speed: 150
    },
    rewards: {
      credits: 1236,
      cosmos: 5,
      experience: 618,
      honor: 3
    },
    description: 'Nave da guerra di medie dimensioni'
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
