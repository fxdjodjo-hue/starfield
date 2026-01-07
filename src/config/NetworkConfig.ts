/**
 * Network configuration constants
 * Centralizes all network-related constants for maintainability
 */
export const NETWORK_CONFIG = {
  // Connection settings
  DEFAULT_SERVER_URL: 'wss://starfield-n5ix.onrender.com',

  // Timing intervals (in milliseconds)
  HEARTBEAT_INTERVAL: 5000, // 5 seconds
  POSITION_SYNC_INTERVAL: 50, // 20 FPS for position updates

  // Position sync thresholds
  POSITION_CHANGE_THRESHOLD: 5, // Minimum position change to trigger sync (pixels)
  ROTATION_CHANGE_THRESHOLD: 0.05, // Minimum rotation change to trigger sync (radians) - ridotto per più fluidità

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
  EXPLOSION_CREATED: 'explosion_created'
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
  npcId: string;
  npcType: 'Scouter' | 'Frigate';
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
    id: string;
    type: 'Scouter' | 'Frigate';
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
    id: string;
    type: 'Scouter' | 'Frigate';
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
  npcId: string;
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
    id: string;
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
  npcId: string;
  reason: 'destroyed' | 'cleanup';
}

/**
 * NPC danneggiato (per effetti visivi)
 */
export interface NpcDamagedMessage {
  type: typeof MESSAGE_TYPES.NPC_DAMAGED;
  npcId: string;
  damage: number;
  attackerId: string;
  newHealth: number;
  newShield: number;
}

/**
 * Richiesta di iniziare combattimento contro un NPC
 */
export interface StartCombatMessage {
  type: typeof MESSAGE_TYPES.START_COMBAT;
  npcId: string;
  playerId: string;
}

/**
 * Richiesta di fermare combattimento
 */
export interface StopCombatMessage {
  type: typeof MESSAGE_TYPES.STOP_COMBAT;
  playerId: string;
}

/**
 * Aggiornamento stato combattimento
 */
export interface CombatUpdateMessage {
  type: typeof MESSAGE_TYPES.COMBAT_UPDATE;
  playerId: string;
  npcId: string;
  isAttacking: boolean;
  lastAttackTime: number;
}

/**
 * Proiettile sparato da un giocatore
 */
export interface ProjectileFiredMessage {
  type: typeof MESSAGE_TYPES.PROJECTILE_FIRED;
  projectileId: string;
  playerId: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  damage: number;
  projectileType: 'laser' | 'plasma' | 'missile';
}

/**
 * Aggiornamento posizione proiettile
 */
export interface ProjectileUpdateMessage {
  type: typeof MESSAGE_TYPES.PROJECTILE_UPDATE;
  projectileId: string;
  position: { x: number; y: number };
}

/**
 * Proiettile distrutto (collisione o fuori schermo)
 */
export interface ProjectileDestroyedMessage {
  type: typeof MESSAGE_TYPES.PROJECTILE_DESTROYED;
  projectileId: string;
  reason: 'collision' | 'out_of_bounds' | 'timeout';
}

/**
 * Entità danneggiata (giocatore o NPC)
 */
export interface EntityDamagedMessage {
  type: typeof MESSAGE_TYPES.ENTITY_DAMAGED;
  entityId: string;
  entityType: 'player' | 'npc';
  damage: number;
  attackerId: string;
  newHealth: number;
  newShield: number;
  position: { x: number; y: number };
}

/**
 * Entità distrutta (morta)
 */
export interface EntityDestroyedMessage {
  type: typeof MESSAGE_TYPES.ENTITY_DESTROYED;
  entityId: string;
  entityType: 'player' | 'npc';
  destroyerId: string;
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
  explosionId: string;
  entityId: string;
  entityType: 'player' | 'npc';
  position: { x: number; y: number };
  explosionType: 'entity_death' | 'projectile_impact' | 'special';
}

/**
 * Respawn di un giocatore
 */
export interface PlayerRespawnMessage {
  type: typeof MESSAGE_TYPES.PLAYER_RESPAWN;
  clientId: string;
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
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

// Type union per tutti i messaggi dei giocatori
export type PlayerMessage =
  | PlayerRespawnMessage;

// Type union per tutti i messaggi di rete
export type NetworkMessageUnion =
  | PlayerMessage
  | NpcMessage
  | CombatMessage;
