import type { EntityId } from '../infrastructure/ecs/Entity';

/**
 * Base interface for all network messages
 */
export interface BaseMessage {
  type: string;
}

/**
 * Determines the server URL based on environment
 * Automatically detects production vs development
 */
function getServerUrl(): string {
  // Check for explicit environment variable
  if (import.meta.env?.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  // Auto-detect production environment
  const isProduction = window.location.hostname !== 'localhost' && 
                       window.location.hostname !== '127.0.0.1' &&
                       !window.location.hostname.startsWith('192.168.');

  if (isProduction) {
    // Production: use Render server with WSS (secure WebSocket)
    return 'wss://starfield-n5ix.onrender.com';
  }

  // Development: use localhost
  return 'ws://localhost:3000';
}

/**
 * Gets the HTTP/HTTPS API base URL from WebSocket URL
 */
export function getApiBaseUrl(): string {
  const wsUrl = getServerUrl();
  // Convert ws:// to http:// or wss:// to https://
  if (wsUrl.startsWith('wss://')) {
    return wsUrl.replace('wss://', 'https://');
  } else if (wsUrl.startsWith('ws://')) {
    return wsUrl.replace('ws://', 'http://');
  }
  return wsUrl;
}

/**
 * Network configuration constants
 * Centralizes all network-related constants for maintainability
 */
export const NETWORK_CONFIG = {
  // Connection settings - auto-detects environment
  DEFAULT_SERVER_URL: getServerUrl(),

  // Timing intervals (in milliseconds)
  HEARTBEAT_INTERVAL: 5000, // 5 seconds
  POSITION_SYNC_INTERVAL: 50, // 20 FPS for position updates

  // Position sync thresholds
  POSITION_CHANGE_THRESHOLD: 5, // Minimum position change to trigger sync (pixels)
  ROTATION_CHANGE_THRESHOLD: 0.05, // Minimum rotation change to trigger sync (radians)

  // Connection management
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY: 1000,

  // Player position cache
  PLAYER_POSITION_CACHE_DURATION: 100, // Cache duration in milliseconds

  // Fallback positions
  FALLBACK_POSITION: {
    x: 0,
    y: 0,
    rotation: 0
  }
} as const;

/**
 * Branded types per type safety nella comunicazione di rete
 */
export type ClientId = string & { readonly __brand: unique symbol };
export type NpcId = string & { readonly __brand: unique symbol };
export type ProjectileId = string & { readonly __brand: unique symbol };
export type ExplosionId = string & { readonly __brand: unique symbol };

/**
 * Branded types per identificatori giocatore
 * Separazione esplicita tra UUID autenticazione e ID database
 */
export type PlayerUuid = string & { readonly __brand: unique symbol }; // UUID Supabase (auth)
export type PlayerDbId = number & { readonly __brand: unique symbol }; // ID numerico database

/**
 * Network message types
 * Centralizes message type constants to avoid typos and ensure consistency
 */
export const MESSAGE_TYPES = {
  // Connection messages
  JOIN: 'join',
  WELCOME: 'welcome',
  HEARTBEAT: 'heartbeat',
  HEARTBEAT_ACK: 'heartbeat_ack',

  // Player messages
  POSITION_UPDATE: 'position_update',
  POSITION_ACK: 'position_ack',
  REMOTE_PLAYER_UPDATE: 'remote_player_update',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  PLAYER_STATE_UPDATE: 'player_state_update',

  // World messages
  WORLD_UPDATE: 'world_update',

  // Error messages
  ERROR: 'error',

  // NPC messages
  NPC_JOINED: 'npc_joined',
  NPC_SPAWN: 'npc_spawn',
  NPC_UPDATE: 'npc_update',
  NPC_BULK_UPDATE: 'npc_bulk_update',
  INITIAL_NPCS: 'initial_npcs',
  NPC_LEFT: 'npc_left',
  NPC_DAMAGED: 'npc_damaged',

  // Player messages
  PLAYER_RESPAWN: 'player_respawn',

  // Combat messages
  START_COMBAT: 'start_combat',
  STOP_COMBAT: 'stop_combat',
  COMBAT_UPDATE: 'combat_update',
  PROJECTILE_FIRED: 'projectile_fired',
  PROJECTILE_UPDATE: 'projectile_update',
  PROJECTILE_DESTROYED: 'projectile_destroyed',
  ENTITY_DAMAGED: 'entity_damaged',
  ENTITY_DESTROYED: 'entity_destroyed',
  EXPLOSION_CREATED: 'explosion_created',

  // Player data messages
  REQUEST_PLAYER_DATA: 'request_player_data',
  PLAYER_DATA_RESPONSE: 'player_data_response',
  ECONOMY_UPDATE: 'economy_update',
  SAVE_REQUEST: 'save_request',
  SAVE_RESPONSE: 'save_response',
  
  // Leaderboard messages
  REQUEST_LEADERBOARD: 'request_leaderboard',
  LEADERBOARD_RESPONSE: 'leaderboard_response'
} as const;

/**
 * Type guard for message types
 */
export type NetworkMessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

export function isValidMessageType(type: string): type is NetworkMessageType {
  return Object.values(MESSAGE_TYPES).includes(type as NetworkMessageType);
}

// ==========================================
// NPC MESSAGE INTERFACES
// ==========================================

/**
 * Nuovo NPC creato nel mondo
 */
export interface NpcJoinedMessage {
  type: typeof MESSAGE_TYPES.NPC_JOINED;
  npcId: NpcId;
  npcType: 'Scouter' | 'Kronos';
  position: { x: number; y: number; rotation: number };
  health: { current: number; max: number };
  shield: { current: number; max: number };
  behavior: string;
}

/**
 * NPC respawnato dal server
 */
export interface NpcSpawnMessage {
  type: typeof MESSAGE_TYPES.NPC_SPAWN;
  npc: {
    id: NpcId;
    type: 'Scouter' | 'Kronos';
    position: { x: number; y: number; rotation: number };
    health: { current: number; max: number };
    shield: { current: number; max: number };
    behavior: string;
  };
}

/**
 * Stato iniziale di tutti gli NPC per nuovi giocatori
 */
export interface InitialNpcsMessage {
  type: typeof MESSAGE_TYPES.INITIAL_NPCS;
  npcs: Array<{
    id: NpcId;
    type: 'Scouter' | 'Kronos';
    position: { x: number; y: number; rotation: number };
    health: { current: number; max: number };
    shield: { current: number; max: number };
    behavior: string;
  }>;
  timestamp: number;
}

/**
 * Aggiornamento singolo NPC
 */
export interface NpcUpdateMessage {
  type: typeof MESSAGE_TYPES.NPC_UPDATE;
  npcId: NpcId;
  position?: { x: number; y: number; rotation: number };
  health?: { current: number; max: number };
  shield?: { current: number; max: number };
  behavior?: string;
  timestamp: number;
}

/**
 * Aggiornamenti multipli NPC (ottimizzato per performance)
 */
export interface NpcBulkUpdateMessage {
  type: typeof MESSAGE_TYPES.NPC_BULK_UPDATE;
  npcs: Array<{
    id: NpcId;
    position: { x: number; y: number; rotation: number };
    health: { current: number; max: number };
    behavior: string;
  }>;
  timestamp: number;
}

/**
 * NPC rimosso dal mondo (distrutto)
 */
export interface NpcLeftMessage {
  type: typeof MESSAGE_TYPES.NPC_LEFT;
  npcId: NpcId;
  reason: 'destroyed' | 'cleanup';
}

/**
 * NPC danneggiato (per effetti visivi)
 */
export interface NpcDamagedMessage {
  type: typeof MESSAGE_TYPES.NPC_DAMAGED;
  npcId: NpcId;
  damage: number;
  attackerId: ClientId;
  newHealth: number;
  newShield: number;
}

/**
 * Richiesta di iniziare combattimento contro un NPC
 */
export interface StartCombatMessage {
  type: typeof MESSAGE_TYPES.START_COMBAT;
  npcId: NpcId;
  playerId: ClientId;
}

/**
 * Richiesta di fermare combattimento
 */
export interface StopCombatMessage {
  type: typeof MESSAGE_TYPES.STOP_COMBAT;
  playerId: ClientId;
}

/**
 * Aggiornamento stato combattimento
 */
export interface CombatUpdateMessage {
  type: typeof MESSAGE_TYPES.COMBAT_UPDATE;
  playerId: ClientId;
  npcId: NpcId;
  isAttacking: boolean;
  lastAttackTime: number;
}

/**
 * Proiettile sparato da un giocatore
 */
export interface ProjectileFiredMessage {
  type: typeof MESSAGE_TYPES.PROJECTILE_FIRED;
  projectileId: ProjectileId;
  playerId: ClientId;
  clientId?: ClientId; // ID connessione WebSocket per identificare giocatore locale
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  damage: number;
  projectileType: 'laser' | 'missile';
  targetId?: string | null;
}

/**
 * Aggiornamento posizione proiettile
 */
export interface ProjectileUpdateMessage {
  type: typeof MESSAGE_TYPES.PROJECTILE_UPDATE;
  projectileId: ProjectileId;
  position: { x: number; y: number };
}

/**
 * Proiettile distrutto (collisione o fuori schermo)
 */
export interface ProjectileDestroyedMessage {
  type: typeof MESSAGE_TYPES.PROJECTILE_DESTROYED;
  projectileId: ProjectileId;
  reason: 'collision' | 'out_of_bounds' | 'timeout' | 'target_hit';
}

/**
 * Entità danneggiata (giocatore o NPC)
 */
export interface EntityDamagedMessage {
  type: typeof MESSAGE_TYPES.ENTITY_DAMAGED;
  entityId: EntityId;
  entityType: 'player' | 'npc';
  damage: number;
  attackerId: ClientId;
  newHealth: number;
  newShield: number;
  position: { x: number; y: number };
  projectileType?: 'laser' | 'missile';
}

/**
 * Entità distrutta (morta)
 */
export interface EntityDestroyedMessage {
  type: typeof MESSAGE_TYPES.ENTITY_DESTROYED;
  entityId: EntityId;
  entityType: 'player' | 'npc';
  destroyerId: ClientId;
  position: { x: number; y: number };
  rewards?: {
    credits: number;
    experience: number;
    honor: number;
  };
}

/**
 * Esplosione creata (effetto visivo)
 */
export interface ExplosionCreatedMessage {
  type: typeof MESSAGE_TYPES.EXPLOSION_CREATED;
  explosionId: ExplosionId;
  entityId: EntityId;
  entityType: 'player' | 'npc';
  position: { x: number; y: number };
  explosionType: 'entity_death' | 'projectile_impact' | 'special';
}

/**
 * Respawn di un giocatore
 */
export interface PlayerRespawnMessage {
  type: typeof MESSAGE_TYPES.PLAYER_RESPAWN;
  clientId: ClientId;
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
}

/**
 * Aggiornamento completo dello stato del player (inventory, upgrades, stats)
 */
export interface PlayerStateUpdateMessage {
  type: typeof MESSAGE_TYPES.PLAYER_STATE_UPDATE;
  inventory?: {
    credits: number;
    cosmos: number;
    experience: number;
    honor: number;
    skillPoints: number;
  };
  upgrades?: {
    [key: string]: number; // Upgrade levels
  };
  recentHonor?: number; // Media mobile honor ultimi 30 giorni (per calcolo rank)
  health?: number;
  maxHealth?: number;
  shield?: number;
  maxShield?: number;
  source?: string;
  healthRepaired?: number; // Valore HP riparato (per messaggi di riparazione)
  shieldRepaired?: number; // Valore Shield riparato (per messaggi di riparazione)
  rewardsEarned?: {
    credits: number;
    cosmos: number;
    experience: number;
    honor: number;
    skillPoints: number;
    npcType: string;
  };
}

/**
 * Welcome message - server conferma connessione e assegna ID
 */
export interface WelcomeMessage {
  type: typeof MESSAGE_TYPES.WELCOME;
  clientId: ClientId;
  playerId: PlayerUuid; // Player ID (UUID dell'utente) - nome JSON invariato per compatibilità server
  playerDbId?: PlayerDbId; // Player ID numerico per database - nome JSON invariato
  initialState?: {
    // Dati essenziali (sempre inclusi)
    position: { x: number; y: number; rotation: number };
    health: number;
    maxHealth: number;
    shield: number;
    maxShield: number;

    // Flag per lazy loading
    inventoryLazy?: boolean;
    upgradesLazy?: boolean;
    questsLazy?: boolean;

    // Dati legacy (per compatibilità)
    players?: Array<{
      id: ClientId;
      position: { x: number; y: number };
      nickname: string;
    }>;
    npcs?: Array<{
      id: NpcId;
      position: { x: number; y: number };
      type: string;
    }>;
  };
}

// Type union per tutti i messaggi NPC
export type NpcMessage =
  | NpcJoinedMessage
  | NpcSpawnMessage
  | InitialNpcsMessage
  | NpcUpdateMessage
  | NpcBulkUpdateMessage
  | NpcLeftMessage
  | NpcDamagedMessage;

// Type union per tutti i messaggi di combattimento
export type CombatMessage =
  | StartCombatMessage
  | StopCombatMessage
  | CombatUpdateMessage
  | ProjectileFiredMessage
  | ProjectileUpdateMessage
  | ProjectileDestroyedMessage
  | EntityDamagedMessage
  | EntityDestroyedMessage
  | ExplosionCreatedMessage;

// Type union per tutti i messaggi di connessione
export type ConnectionMessage =
  | WelcomeMessage;

// Type union per tutti i messaggi dei giocatori
export type PlayerMessage =
  | PlayerRespawnMessage;

// Player data messages
export interface RequestPlayerDataMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.REQUEST_PLAYER_DATA;
  playerId: PlayerUuid; // Nome JSON invariato per compatibilità server
}

export interface PlayerDataResponseMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.PLAYER_DATA_RESPONSE;
  playerId: PlayerUuid; // Nome JSON invariato per compatibilità server
  inventory: {
    credits: number;
    cosmos: number;
    experience: number;
    honor: number;
    skillPoints: number;
  };
  upgrades: {
    hpUpgrades: number;
    shieldUpgrades: number;
    speedUpgrades: number;
    damageUpgrades: number;
  };
  recentHonor?: number; // Media mobile honor ultimi 30 giorni (per calcolo rank)
  isAdministrator?: boolean; // Admin status
  quests: any[];
  timestamp: number;
}

export interface SaveRequestMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.SAVE_REQUEST;
  clientId: string;
  playerId: PlayerUuid; // Nome JSON invariato per compatibilità server
  timestamp: number;
}

export interface SaveResponseMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.SAVE_RESPONSE;
  success: boolean;
  message: string;
  error?: string;
  timestamp: number;
}

/**
 * Aggiornamento dati economici dal client al server
 */
export interface EconomyUpdateMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.ECONOMY_UPDATE;
  playerId: PlayerUuid; // Nome JSON invariato per compatibilità server
  inventory: {
    credits: number;
    cosmos: number;
    experience: number;
    honor: number;
    skillPoints: number;
  };
}

/**
 * Richiesta leaderboard dal client al server
 */
export interface LeaderboardRequestMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.REQUEST_LEADERBOARD;
  sortBy?: 'honor' | 'experience' | 'kills' | 'playTime';
  limit?: number;
}

/**
 * Risposta leaderboard dal server al client
 */
export interface LeaderboardResponseMessage extends BaseMessage {
  type: typeof MESSAGE_TYPES.LEADERBOARD_RESPONSE;
  entries: Array<{
    rank: number;
    playerId: PlayerDbId; // Nome JSON invariato per compatibilità server
    username: string;
    experience: number;
    honor: number;
    recentHonor?: number;
    rankingPoints: number;
    kills: number;
    playTime: number;
    level: number;
    rankName: string;
  }>;
  sortBy: string;
  playerRank?: number;
}

// Type union per tutti i messaggi di rete
export type NetworkMessageUnion =
  | ConnectionMessage
  | PlayerMessage
  | NpcMessage
  | CombatMessage
  | RequestPlayerDataMessage
  | PlayerDataResponseMessage
  | EconomyUpdateMessage
  | SaveRequestMessage
  | SaveResponseMessage
  | LeaderboardRequestMessage
  | LeaderboardResponseMessage;
