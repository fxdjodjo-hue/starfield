/**
 * Network configuration constants
 * Centralizes all network-related constants for maintainability
 */
export const NETWORK_CONFIG = {
  // Connection settings
  DEFAULT_SERVER_URL: 'ws://localhost:3000',

  // Timing intervals (in milliseconds)
  HEARTBEAT_INTERVAL: 5000, // 5 seconds
  POSITION_SYNC_INTERVAL: 50, // 20 FPS for position updates

  // Position sync thresholds
  POSITION_CHANGE_THRESHOLD: 5, // Minimum position change to trigger sync

  // Connection management
  RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY: 1000,

  // Player position cache
  PLAYER_POSITION_CACHE_DURATION: 100, // Cache duration in milliseconds

  // Fallback positions
  FALLBACK_POSITION: {
    x: 400,
    y: 300,
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
  NPC_UPDATE: 'npc_update',
  NPC_BULK_UPDATE: 'npc_bulk_update',
  INITIAL_NPCS: 'initial_npcs',
  NPC_LEFT: 'npc_left',
  NPC_DAMAGED: 'npc_damaged'
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

// Type union per tutti i messaggi NPC
export type NpcMessage =
  | NpcJoinedMessage
  | InitialNpcsMessage
  | NpcUpdateMessage
  | NpcBulkUpdateMessage
  | NpcLeftMessage
  | NpcDamagedMessage;
