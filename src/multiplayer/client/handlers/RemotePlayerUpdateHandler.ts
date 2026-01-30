import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Handles remote player update messages from the server
 * Delegates to RemotePlayerManager for actual player management
 */
export class RemotePlayerUpdateHandler extends BaseMessageHandler {
  private updateCount = 0;
  private lastUpdateTime = 0;

  constructor() {
    super(MESSAGE_TYPES.REMOTE_PLAYER_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    let clientId, position, rotation, tick, nickname, rank, health, maxHealth, shield, maxShield;

    if (message.p && Array.isArray(message.p)) {
      // FORMATO COMPATTO: [clientId, x, y, vx, vy, rotation, tick, nickname, rank, hp, maxHp, sh, maxSh]
      const p = message.p;
      clientId = p[0];
      position = { x: p[1], y: p[2], velocityX: p[3], velocityY: p[4] };
      rotation = p[5];

      // FIX TIMESTAMP: Use message.t (Date.now() from server) for interpolation timing.
      // p[6] is the server tick number (integer), which cannot be used directly for time.
      // message.t is sent as Date.now() by the server and is the correct source of truth.
      tick = message.t;

      nickname = p[7];
      rank = p[8];
      health = p[9];
      maxHealth = p[10];
      shield = p[11];
      maxShield = p[12];
    } else {
      // Formato vecchio (fallback)
      ({ clientId, position, rotation, nickname, rank, health, maxHealth, shield, maxShield } = message);
      tick = message.t; // Fallback to message.t for old format too
    }

    if (!clientId) return;

    // Debug: monitora frequenza aggiornamenti ogni 5 secondi
    this.updateCount++;
    const now = Date.now();
    if (now - this.lastUpdateTime > 5000) {
      const updatesPerSecond = this.updateCount / ((now - this.lastUpdateTime) / 1000);
      this.updateCount = 0;
      this.lastUpdateTime = now;
    }

    // Delegate to RemotePlayerManager for handling the update
    if (networkSystem.remotePlayerManager) {
      networkSystem.remotePlayerManager.handleUpdate(
        clientId,
        position,
        rotation,
        health,
        maxHealth,
        shield,
        maxShield,
        nickname,
        rank,
        tick
      );
    } else {
      console.warn('[RemotePlayerUpdateHandler] No RemotePlayerManager available');
    }
  }
}
