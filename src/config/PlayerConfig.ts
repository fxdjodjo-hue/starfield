/**
 * Configurazione del Player - definisce statistiche iniziali e comportamento
 * Questo permette di configurare facilmente le statistiche del giocatore senza modificare il codice
 */

export interface PlayerStats {
  health: number;
  shield?: number; 
  damage: number;
  range: number;
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

export interface PlayerDefinition {
  stats: PlayerStats;
  startingResources: PlayerStartingResources;
  spriteSize: PlayerSpriteSize;
  description?: string;
}

/**
 * Definizione del giocatore
 */
export const PLAYER_DEFINITION: PlayerDefinition = {
  stats: {
    health: 100000,
    shield: 50000,
    damage: 500,
    range: 300,
    cooldown: 1000,
    speed: 300
  },
  startingResources: {
    credits: 1000,
    cosmos: 50,
    level: 1,
    experience: 0,
    honor: 0,
    skillPoints: 10
  },
  spriteSize: {
    width: 112,
    height: 112
  },
  description: 'La nave controllata dal giocatore'
};

/**
 * Ottiene la definizione del giocatore
 */
export function getPlayerDefinition(): PlayerDefinition {
  return PLAYER_DEFINITION;
}
