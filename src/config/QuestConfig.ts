import type { QuestObjective, QuestReward } from '../presentation/ui/QuestPanel';

/**
 * Tipi di obiettivi supportati
 */
export enum ObjectiveType {
  KILL = 'kill',
  COLLECT = 'collect',
  EXPLORE = 'explore',
  INTERACT = 'interact'
}

/**
 * Tipi di ricompense supportati
 */
export enum RewardType {
  CREDITS = 'credits',
  COSMOS = 'cosmos',
  EXPERIENCE = 'experience',
  HONOR = 'honor',
  ITEM = 'item'
}

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
  type: string; // categoria della quest (kill, collect, story, etc.)
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
 */
export enum QuestEventType {
  NPC_KILLED = 'npc_killed',
  ITEM_COLLECTED = 'item_collected',
  LOCATION_VISITED = 'location_visited',
  INTERACTION_COMPLETED = 'interaction_completed'
}

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
  handleEvent(event: QuestEvent, activeQuests: any[]): void;
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

/**
 * Inizializzazione delle quest di default
 */
export function initializeDefaultQuests(): void {
  // Quest di uccisione Scouter
  QuestRegistry.register({
    id: 'kill_scouter_1',
    title: 'Caccia allo Scouter',
    description: 'Gli Scouter rappresentano una minaccia. Uccidine 1 per dimostrare il tuo valore.',
    type: 'kill',
    objectives: [{
      id: 'kill_scouter_obj',
      type: ObjectiveType.KILL,
      description: 'Uccidi 1 Scouter',
      target: 1,
      targetType: 'scouter'
    }],
    rewards: [{
      type: RewardType.COSMOS,
      amount: 100
    }],
    levelRequirement: 1,
    repeatable: false
  });

  // Quest di uccisione multipla (esempio per scalabilità futura)
  QuestRegistry.register({
    id: 'kill_multiple_scouters',
    title: 'Cacciatore di Scouter',
    description: 'Hai dimostrato il tuo valore. Ora uccidine 5 per diventare un vero cacciatore.',
    type: 'kill',
    objectives: [{
      id: 'kill_multiple_scouters_obj',
      type: ObjectiveType.KILL,
      description: 'Uccidi 5 Scouter',
      target: 5,
      targetType: 'scouter'
    }],
    rewards: [
      { type: RewardType.CREDITS, amount: 500 },
      { type: RewardType.COSMOS, amount: 200 },
      { type: RewardType.EXPERIENCE, amount: 100 }
    ],
    prerequisites: ['kill_scouter_1'],
    levelRequirement: 2,
    repeatable: false
  });

}
