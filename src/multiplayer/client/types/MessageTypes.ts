// Network message type definitions
import { NetMessage, PositionUpdateMessage, CombatMessage, ProjectileMessage, ChatMessage, StateUpdateMessage, BaseMessage } from '/src/shared/GameTypes';
import { ClientId, NpcId, ProjectileId, ExplosionId } from '../../../config/NetworkConfig';

// Re-export shared types per compatibilità
export type {
  NetMessage,
  PositionUpdateMessage,
  CombatMessage,
  ProjectileMessage,
  ChatMessage,
  StateUpdateMessage,
  BaseMessage
} from '../../../../shared/GameTypes';

// Tipi specifici del client che estendono i shared types
export interface JoinMessage extends BaseMessage {
  type: 'join';
  clientId: string;
  nickname?: string;
  playerId?: number;
  userId?: string;
  position: { x: number; y: number; rotation: number };
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
  clientId: string;
  timestamp: number;
}

export interface RemotePlayerUpdateMessage extends BaseMessage {
  type: 'remote_player_update';
  clientId: string;
  position: { x: number; y: number };
  rotation?: number;
  nickname?: string;
  rank?: string;
}

export interface PlayerJoinedMessage extends BaseMessage {
  type: 'player_joined';
  clientId: string;
  nickname?: string;
  playerId?: number;
}

export interface PlayerLeftMessage extends BaseMessage {
  type: 'player_left';
  clientId: string;
}

export interface WelcomeMessage extends BaseMessage {
  type: 'welcome';
  clientId: string;
  message?: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

export interface ChatHistoryMessage extends BaseMessage {
  type: 'chat_history';
  messages: Array<{
    senderName: string;
    content: string;
    timestamp: number;
  }>;
}

// Union type for all client-specific messages
export type NetworkMessageUnion =
  | JoinMessage
  | HeartbeatMessage
  | RemotePlayerUpdateMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | WelcomeMessage
  | ErrorMessage
  | ChatHistoryMessage;
