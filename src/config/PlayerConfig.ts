/**
 * Configurazione del Player - definisce statistiche iniziali e comportamento
 * Questo permette di configurare facilmente le statistiche del giocatore senza modificare il codice
 */

export interface PlayerStats {
  health: number;
  shield?: number; // Opzionale, player potrebbe non avere scudi
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
}

export interface PlayerDefinition {
  stats: PlayerStats;
  startingResources: PlayerStartingResources;
  description?: string;
}

/**
 * Definizione del giocatore
 */
export const PLAYER_DEFINITION: PlayerDefinition = {
  stats: {
    health: 100000,
    // shield: 0, // Commentato - player senza scudi
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
    honor: 0
  },
  description: 'La nave controllata dal giocatore'
};

/**
 * Ottiene la definizione del giocatore
 */
export function getPlayerDefinition(): PlayerDefinition {
  return PLAYER_DEFINITION;
}
