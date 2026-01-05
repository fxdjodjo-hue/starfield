// Network message type definitions
export type NetMessage = {
  type: string;
  clientId?: string;
  [key: string]: any;
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

// Union type for all possible network messages
export type NetworkMessageUnion =
  | JoinMessage
  | PositionUpdateMessage
  | HeartbeatMessage
  | RemotePlayerUpdateMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | WelcomeMessage
  | ErrorMessage;
