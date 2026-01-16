import { NetworkConnectionManager } from './NetworkConnectionManager';
import { RateLimiter, RATE_LIMITS } from './RateLimiter';
import { NetworkEventSystem } from './NetworkEventSystem';
import { RemoteEntityManager } from './RemoteEntityManager';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { NetMessage } from '../types/MessageTypes';

/**
 * NetworkCombatManager - Gestione messaggi combattimento (start/stop combat, projectile fired)
 * Estratto da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkCombatManager {
  constructor(
    private readonly connectionManager: NetworkConnectionManager,
    private readonly rateLimiter: RateLimiter,
    private readonly eventSystem: NetworkEventSystem,
    private readonly entityManager: RemoteEntityManager,
    private readonly clientId: string,
    private getCurrentCombatNpcId: () => string | null,
    private sendMessage: (message: NetMessage) => void,
    private isConnected: () => boolean
  ) {}

  /**
   * Sends request to start combat against an NPC
   */
  sendStartCombat(data: {
    npcId: string;
    playerId: string;
  }): void {
    if (!this.connectionManager.isConnectionActive()) {
      return;
    }

    if (!this.clientId) {
      return;
    }

    // RATE LIMITING: Controlla se possiamo inviare azioni di combattimento
    if (!this.rateLimiter.canSend('combat_action', RATE_LIMITS.COMBAT_ACTION.maxRequests, RATE_LIMITS.COMBAT_ACTION.windowMs)) {
      this.eventSystem.showRateLimitNotification('combat_action');
      return;
    }

    // Salva l'NPC corrente per stop_combat
    this.entityManager.setCurrentCombatNpcId(data.npcId);

    const message = {
      type: MESSAGE_TYPES.START_COMBAT,
      clientId: this.clientId,
      npcId: data.npcId,
      playerId: data.playerId
    };

    this.connectionManager.send(JSON.stringify(message));
  }

  /**
   * Sends request to stop combat
   */
  sendStopCombat(data: {
    playerId: string;
    npcId?: string;
  }): void {
    if (!this.isConnected()) {
      return;
    }

    const message = {
      type: MESSAGE_TYPES.STOP_COMBAT,
      clientId: this.clientId,
      playerId: data.playerId,
      npcId: data.npcId || this.getCurrentCombatNpcId() || 'unknown'
    };

    this.sendMessage(message);
  }

  /**
   * Sends notification of a fired projectile to the server
   */
  sendProjectileFired(data: {
    projectileId: string;
    playerId: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    projectileType: string;
  }): void {
    if (!this.connectionManager.isConnectionActive()) {
      return;
    }

    // RATE LIMITING: Controlla se possiamo inviare azioni di combattimento
    if (!this.rateLimiter.canSend('combat_action', RATE_LIMITS.COMBAT_ACTION.maxRequests, RATE_LIMITS.COMBAT_ACTION.windowMs)) {
      this.eventSystem.showRateLimitNotification('combat_action');
      return;
    }

    const message = {
      type: MESSAGE_TYPES.PROJECTILE_FIRED,
      clientId: this.clientId,
      projectileId: data.projectileId,
      playerId: data.playerId,
      position: data.position,
      velocity: data.velocity,
      projectileType: data.projectileType
    };

    this.connectionManager.send(JSON.stringify(message));
  }
}
