import type { QuestObjective, QuestReward } from '../presentation/ui/QuestPanel';

/**
 * Tipi di obiettivi supportati
 * Usa const object invece di enum per compatibilità con erasableSyntaxOnly
 */
export const ObjectiveType = {
  KILL: 'kill',
  COLLECT: 'collect',
  EXPLORE: 'explore',
  INTERACT: 'interact'
} as const;

export type ObjectiveType = typeof ObjectiveType[keyof typeof ObjectiveType];

/**
 * Tipi di ricompense supportati
 * Usa const object invece di enum per compatibilità con erasableSyntaxOnly
 */
export const RewardType = {
  CREDITS: 'credits',
  COSMOS: 'cosmos',
  EXPERIENCE: 'experience',
  HONOR: 'honor',
  ITEM: 'item'
} as const;

export type RewardType = typeof RewardType[keyof typeof RewardType];

/**
 * Configurazione di un singolo obiettivo
 */
export interface QuestObjectiveConfig {
  id: string;
  type: ObjectiveType;
  description: string;
  target: number;
  targetName?: string; // nome dell'NPC/item/location da colpire/raccogliere/visitate
  targetType?: string; // tipo specifico (es. "scouter", "frigate", ecc.)
}

/**
 * Configurazione di una singola ricompensa
 */
export interface QuestRewardConfig {
  type: RewardType;
  amount: number;
  itemId?: string; // per ricompense item
}

/**
 * Configurazione completa di una quest
 */
export interface QuestConfig {
  id: string;
  title: string;
  description: string;
  type: 'kill' | 'survival' | 'progression' | 'collection' | 'achievement'; // categoria della quest
  objectives: QuestObjectiveConfig[];
  rewards: QuestRewardConfig[];
  prerequisites?: string[]; // ID di altre quest necessarie
  levelRequirement?: number;
  repeatable?: boolean;
  timeLimit?: number; // in minuti, 0 = nessuna scadenza
}

/**
 * Registry globale delle configurazioni quest
 */
export class QuestRegistry {
  private static quests = new Map<string, QuestConfig>();

  /**
   * Registra una nuova configurazione quest
   */
  static register(config: QuestConfig): void {
    this.quests.set(config.id, config);
  }

  /**
   * Ottiene una configurazione quest per ID
   */
  static get(id: string): QuestConfig | undefined {
    return this.quests.get(id);
  }

  /**
   * Ottiene tutte le configurazioni quest
   */
  static getAll(): QuestConfig[] {
    return Array.from(this.quests.values());
  }

  /**
   * Ottiene quest filtrate per tipo
   */
  static getByType(type: string): QuestConfig[] {
    return this.getAll().filter(q => q.type === type);
  }

  /**
   * Ottiene quest disponibili per un livello giocatore
   */
  static getAvailableForLevel(level: number): QuestConfig[] {
    return this.getAll().filter(q => !q.levelRequirement || q.levelRequirement <= level);
  }

  /**
   * Verifica se una quest ha tutti i prerequisiti soddisfatti
   */
  static hasPrerequisites(config: QuestConfig, completedQuestIds: string[]): boolean {
    if (!config.prerequisites) return true;
    return config.prerequisites.every(prereqId => completedQuestIds.includes(prereqId));
  }
}

/**
 * Sistema di eventi per il tracking delle quest
 * Usa const object invece di enum per compatibilità con erasableSyntaxOnly
 */
export const QuestEventType = {
  NPC_KILLED: 'npc_killed',
  ITEM_COLLECTED: 'item_collected',
  LOCATION_VISITED: 'location_visited',
  INTERACTION_COMPLETED: 'interaction_completed'
} as const;

export type QuestEventType = typeof QuestEventType[keyof typeof QuestEventType];

export interface QuestEvent {
  type: QuestEventType;
  targetId: string; // ID dell'NPC/item/location
  targetType?: string; // tipo specifico
  amount?: number; // quantità (default 1)
  playerId?: string; // per multiplayer futuro
}

/**
 * Handler per eventi di quest
 */
export interface QuestEventHandler {
  handleEvent(event: QuestEvent, activeQuestComponent: any): void;
}

/**
 * Factory per creare obiettivi da configurazione
 */
export class QuestObjectiveFactory {
  static create(config: QuestObjectiveConfig): QuestObjective {
    return {
      id: config.id,
      type: config.type,
      description: config.description,
      target: config.target,
      current: 0,
      targetName: config.targetName,
      targetType: config.targetType
    };
  }
}

/**
 * Factory per creare ricompense da configurazione
 */
export class QuestRewardFactory {
  static create(config: QuestRewardConfig): QuestReward {
    return {
      type: config.type,
      amount: config.amount,
      itemId: config.itemId
    };
  }
}