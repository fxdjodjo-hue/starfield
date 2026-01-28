/**
 * Type definitions for network message handling
 * Using classes instead of interfaces to avoid circular import issues
 */

import { ClientNetworkSystem } from '../ClientNetworkSystem';

/**
 * Base class for all message handlers
 * Provides the interface contract through inheritance
 */
export abstract class MessageHandler {
  /**
   * Determines if this handler can process the given message type
   * @param type The message type to check
   * @returns true if this handler can handle the message type
   */
  abstract canHandle(type: string): boolean;

  /**
   * Processes the message
   * @param message The parsed message object
   * @param networkSystem The network system instance for accessing dependencies
   */
  abstract handle(message: NetworkMessage, networkSystem: ClientNetworkSystem): void;
}

/**
 * Base type for all network messages
 * Ensures type safety and consistency across the network layer
 */
export type NetworkMessage = {
  /** Message type identifier */
  type: string;

  /** Client identifier (usually present in most messages) */
  clientId?: string;

  /** Additional message-specific fields */
  [key: string]: any;
};

/**
 * Specific message types with proper typing
 */
export interface JoinMessage extends NetworkMessage {
  type: 'join';
  clientId: string;
  nickname?: string;
  playerId?: number;
  userId?: string;
  position: { x: number; y: number; rotation: number };
}

export interface PositionUpdateMessage extends NetworkMessage {
  type: 'position_update';
  clientId: string;
  position: { x: number; y: number };
  rotation: number;
  tick: number;
}

export interface HeartbeatMessage extends NetworkMessage {
  type: 'heartbeat';
  clientId: string;
  timestamp: number;
}

export interface RemotePlayerUpdateMessage extends NetworkMessage {
  type: 'remote_player_update';
  clientId: string;
  position: { x: number; y: number };
  rotation?: number;
  nickname?: string;
  rank?: string;
}

export interface PlayerJoinedMessage extends NetworkMessage {
  type: 'player_joined';
  clientId: string;
  nickname?: string;
  playerId?: number;
}

export interface PlayerLeftMessage extends NetworkMessage {
  type: 'player_left';
  clientId: string;
}

export interface WelcomeMessage extends NetworkMessage {
  type: 'welcome';
  clientId: string;
  message?: string;
}

export interface ErrorMessage extends NetworkMessage {
  type: 'error';
  message: string;
  code?: string;
}

export interface RewardsEarnedMessage extends NetworkMessage {
  type: 'rewards_earned';
  rewards: {
    credits: number;
    cosmos: number;
    experience: number;
    honor: number;
  };
  source: string;
  totalInventory: {
    credits: number;
    cosmos: number;
    experience: number;
    honor: number;
  };
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
  | RewardsEarnedMessage;
