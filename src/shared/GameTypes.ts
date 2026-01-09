// ======================================================================
// SHARED TYPES - Client ↔ Server
// Questi tipi sono utilizzabili sia da client che server
// NON contengono logica di business o metodi privati
// ======================================================================

/**
 * Livelli di autorità - condivisi tra client e server
 */
export enum AuthorityLevel {
  SERVER_AUTHORITATIVE = 'server_authoritative',
  CLIENT_PREDICTIVE = 'client_predictive',
  CLIENT_LOCAL = 'client_local'
}

/**
 * Tipi di entità nel mondo di gioco
 */
export enum EntityType {
  PLAYER = 'player',
  NPC = 'npc',
  PROJECTILE = 'projectile',
  EXPLOSION = 'explosion'
}

/**
 * Struttura posizione - condivisa per sincronizzazione
 */
export interface Position {
  x: number;
  y: number;
  rotation?: number;
}

/**
 * Struttura velocità - per movimento e fisica
 */
export interface Velocity {
  x: number;
  y: number;
}

/**
 * Stato salute - per combattimento
 */
export interface HealthState {
  current: number;
  max: number;
}

/**
 * Stato scudo - per combattimento
 */
export interface ShieldState {
  current: number;
  max: number;
}

/**
 * Stato autorità - per controllo entity
 */
export interface AuthorityState {
  ownerId: string;
  level: AuthorityLevel;
  isPredicted: boolean;
}

/**
 * Stato completo di un'entità - per sincronizzazione
 */
export interface EntityState {
  id: string;
  type: EntityType;
  position: Position;
  health?: HealthState;
  shield?: ShieldState;
  velocity?: Velocity;
  authority: AuthorityState;
  lastUpdate: number;
}

/**
 * Stato del player - dati persistenti
 */
export interface PlayerState {
  playerId: string;
  nickname: string;
  position: Position;
  health: HealthState;
  shield: ShieldState;
  inventory: InventoryState;
  upgrades: UpgradeState;
  quests: QuestState[];
  lastUpdate: number;
}

/**
 * Stato inventario - risorse economiche
 */
export interface InventoryState {
  credits: number;
  cosmos: number;
  experience: number;
  honor: number;
  skillPoints: number;
}

/**
 * Stato upgrade - abilità del player
 */
export interface UpgradeState {
  hpUpgrades: number;
  shieldUpgrades: number;
  speedUpgrades: number;
  damageUpgrades: number;
}

/**
 * Stato quest - missioni del player
 */
export interface QuestState {
  questId: string;
  objectives: any[]; // TODO: definire struttura objectives
  isCompleted: boolean;
  startedAt: number;
  completedAt?: number;
}

// ======================================================================
// MESSAGE TYPES - Protocollo di comunicazione
// ======================================================================

/**
 * Base message - struttura minima per tutti i messaggi
 */
export interface BaseMessage {
  type: string;
  clientId?: string;
  timestamp?: number;
}

/**
 * Update posizione - movimento del player
 */
export interface PositionUpdateMessage extends BaseMessage {
  type: 'position_update';
  position: Position;
  rotation: number;
  tick: number;
}

/**
 * Messaggio combattimento - inizio/fine combattimento
 */
export interface CombatMessage extends BaseMessage {
  type: 'start_combat' | 'stop_combat';
  npcId: string;
  playerId: string;
}

/**
 * Messaggio proiettile - sparo di un proiettile
 */
export interface ProjectileMessage extends BaseMessage {
  type: 'projectile_fired';
  projectileId: string;
  position: Position;
  velocity: Velocity;
  damage: number;
  projectileType: string;
  targetId?: string;
}

/**
 * Messaggio chat - comunicazione testuale
 */
export interface ChatMessage extends BaseMessage {
  type: 'chat_message';
  senderName: string;
  content: string;
}

/**
 * Update stato player - cambiamenti persistenti
 */
export interface StateUpdateMessage extends BaseMessage {
  type: 'player_state_update';
  inventory: InventoryState;
  upgrades: UpgradeState;
  health: HealthState;
  maxHealth: number;
  shield: ShieldState;
  maxShield: number;
  source: string;
}

// ======================================================================
// CONSTANTS - Valori condivisi
// ======================================================================

export const GAME_CONSTANTS = {
  WORLD: {
    WIDTH: 21000,
    HEIGHT: 13100,
  },
  COMBAT: {
    PLAYER_RANGE: 1500,
    PLAYER_START_RANGE: 2000,
    NPC_ATTACK_RANGE: 1200,
  },
  PROJECTILE: {
    SPEED: 800,
    LIFETIME: 3000,
  },
  NETWORK: {
    TICK_RATE: 20,
    POSITION_UPDATE_RATE: 10,
    HEARTBEAT_INTERVAL: 5000,
  },
  VALIDATION: {
    MAX_CHAT_LENGTH: 200,
    MAX_POSITION_DELTA: 100,
    MAX_VELOCITY: 1000,
  }
} as const;

// ======================================================================
// TYPE UNIONS - Per type safety
// ======================================================================

/**
 * Union di tutti i possibili messaggi di rete
 */
export type NetMessage =
  | PositionUpdateMessage
  | CombatMessage
  | ProjectileMessage
  | ChatMessage
  | StateUpdateMessage
  | BaseMessage;

// ======================================================================
// SERVER-ONLY TYPES - NON DEVONO ESSERE USATI DAL CLIENT
// ======================================================================

/**
 * Stato server di un'entità - contiene dati privati
 */
export interface ServerEntityState extends EntityState {
  serverOnly: {
    lastProcessedInput: number;
    authorityViolations: number;
    isStale: boolean;
  };
}

/**
 * Stato server del player - contiene dati privati
 */
export interface ServerPlayerState extends PlayerState {
  serverOnly: {
    connectionQuality: number;
    lastValidPosition: Position;
    inputBuffer: any[];
    authorityViolations: number;
  };
}

// ======================================================================
// TYPE GUARDS - Per runtime type checking
// ======================================================================

/**
 * Type guard per verificare se un messaggio è un PositionUpdateMessage
 */
export function isPositionUpdateMessage(msg: NetMessage): msg is PositionUpdateMessage {
  return msg.type === 'position_update';
}

/**
 * Type guard per verificare se un messaggio è un CombatMessage
 */
export function isCombatMessage(msg: NetMessage): msg is CombatMessage {
  return msg.type === 'start_combat' || msg.type === 'stop_combat';
}

/**
 * Type guard per verificare se un messaggio è un ChatMessage
 */
export function isChatMessage(msg: NetMessage): msg is ChatMessage {
  return msg.type === 'chat_message';
}