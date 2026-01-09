// Network message type definitions
import { ClientId, NpcId, ProjectileId, ExplosionId } from '../../../config/NetworkConfig';

export type NetMessage = {
  type: string;
  clientId?: ClientId;
  [key: string]: unknown; // Cambiato da any a unknown per type safety
};

/**
 * Specific message types with proper typing
 */
export interface JoinMessage extends NetMessage {
  type: 'join';
  clientId: string;
  nickname?: string;
  playerId?: number;
  userId?: string;
  position: { x: number; y: number; rotation: number };
}

export interface PositionUpdateMessage extends NetMessage {
  type: 'position_update';
  clientId: string;
  position: { x: number; y: number };
  rotation: number;
  tick: number;
}

export interface HeartbeatMessage extends NetMessage {
  type: 'heartbeat';
  clientId: string;
  timestamp: number;
}

export interface RemotePlayerUpdateMessage extends NetMessage {
  type: 'remote_player_update';
  clientId: string;
  position: { x: number; y: number };
  rotation?: number;
  nickname?: string;
  rank?: string;
}

export interface PlayerJoinedMessage extends NetMessage {
  type: 'player_joined';
  clientId: string;
  nickname?: string;
  playerId?: number;
}

export interface PlayerLeftMessage extends NetMessage {
  type: 'player_left';
  clientId: string;
}

export interface WelcomeMessage extends NetMessage {
  type: 'welcome';
  clientId: string;
  message?: string;
}

export interface ErrorMessage extends NetMessage {
  type: 'error';
  message: string;
}

export interface ChatMessage extends NetMessage {
  type: 'chat_message';
  clientId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

export interface ChatHistoryMessage extends NetMessage {
  type: 'chat_history';
  messages: Array<{
    senderName: string;
    content: string;
    timestamp: number;
  }>;
}

// Union type for all possible network messages
export type NetworkMessageUnion =
  | JoinMessage
  | PositionUpdateMessage
  | HeartbeatMessage
  | RemotePlayerUpdateMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | WelcomeMessage
  | ErrorMessage
  | ChatMessage
  | ChatHistoryMessage;
