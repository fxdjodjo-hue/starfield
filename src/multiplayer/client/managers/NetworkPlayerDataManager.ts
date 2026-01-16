import { NetworkConnectionManager } from './NetworkConnectionManager';
import { GameContext } from '../../../infrastructure/engine/GameContext';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { NetMessage } from '../types/MessageTypes';

/**
 * NetworkPlayerDataManager - Richiesta/gestione dati player (skill upgrade, player data)
 * Estratto da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkPlayerDataManager {
  constructor(
    private readonly connectionManager: NetworkConnectionManager,
    private readonly gameContext: GameContext,
    private readonly clientId: string,
    private sendMessage: (message: NetMessage) => void,
    private isConnected: () => boolean
  ) {}

  /**
   * Requests a stat upgrade to the server (Server Authoritative)
   * Costs credits and cosmos instead of skill points
   */
  requestSkillUpgrade(upgradeType: 'hp' | 'shield' | 'speed' | 'damage'): void {
    if (!this.isConnected()) {
      return;
    }

    const message = {
      type: 'skill_upgrade_request',
      clientId: this.clientId,  // WebSocket client ID
      playerId: this.gameContext.authId,  // User/auth ID (UUID)
      upgradeType: upgradeType
    };

    this.sendMessage(message);

    // Setup timeout per gestire risposte mancanti
    setTimeout(() => {
      // TODO: Handle timeout if needed
    }, 3000);
  }

  /**
   * Richiede i dati completi del giocatore al server (dopo welcome)
   */
  requestPlayerData(playerId: string): void {
    if (!this.connectionManager.isConnectionActive()) {
      console.warn('📊 [PLAYER_DATA] Cannot request player data - not connected');
      return;
    }

    const message = {
      type: MESSAGE_TYPES.REQUEST_PLAYER_DATA,
      clientId: this.clientId,
      playerId: playerId,
      timestamp: Date.now()
    };

    this.connectionManager.send(JSON.stringify(message));
  }
}
