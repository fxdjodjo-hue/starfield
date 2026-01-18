import NPC_CONFIG from '../../shared/npc-config.json';

export type NpcType = 'Scouter' | 'Kronos';

export interface NpcStats {
  health: number;
  shield: number;
  damage: number;
  range: number;
  cooldown: number;
  speed: number;
}

export interface NpcDefinition {
  type: string;
  defaultBehavior: string;
  stats: NpcStats;
  rewards: {
    credits: number;
    cosmos: number;
    experience: number;
    honor: number;
  };
  description: string;
}

/**
 * Gestore centralizzato per le statistiche degli NPC
 * Single Source of Truth per valori NPC
 */
export class NpcStatsManager {
  private static instance: NpcStatsManager;
  private npcStats: Map<NpcType, NpcDefinition>;

  private constructor() {
    // Carica configurazione e valida
    this.npcStats = new Map();
    this.loadNpcStats();
  }

  static getInstance(): NpcStatsManager {
    if (!NpcStatsManager.instance) {
      NpcStatsManager.instance = new NpcStatsManager();
    }
    return NpcStatsManager.instance;
  }

  private loadNpcStats(): void {
    // Valida che tutti i tipi richiesti esistano
    const requiredTypes: NpcType[] = ['Scouter', 'Kronos'];

    for (const type of requiredTypes) {
      if (!NPC_CONFIG[type]) {
        throw new Error(`Missing NPC configuration for type: ${type}`);
      }
      this.npcStats.set(type, NPC_CONFIG[type]);
    }

  }

  // Accesso diretto ai valori base
  getHealth(type: NpcType): number {
    return this.npcStats.get(type)?.stats.health || 0;
  }

  getShield(type: NpcType): number {
    return this.npcStats.get(type)?.stats.shield || 0;
  }

  getDamage(type: NpcType): number {
    return this.npcStats.get(type)?.stats.damage || 0;
  }

  getRange(type: NpcType): number {
    return this.npcStats.get(type)?.stats.range || 0;
  }

  getCooldown(type: NpcType): number {
    return this.npcStats.get(type)?.stats.cooldown || 0;
  }

  getSpeed(type: NpcType): number {
    return this.npcStats.get(type)?.stats.speed || 0;
  }

  // Accesso completo alle statistiche
  getStats(type: NpcType): NpcStats | undefined {
    return this.npcStats.get(type)?.stats;
  }

  // Accesso completo alla definizione NPC
  getNpcDefinition(type: NpcType): NpcDefinition | undefined {
    return this.npcStats.get(type);
  }

  // Lista di tutti i tipi disponibili
  getAvailableTypes(): NpcType[] {
    return Array.from(this.npcStats.keys());
  }

  // Validazione tipo
  isValidType(type: string): type is NpcType {
    return this.npcStats.has(type as NpcType);
  }
}
