import { NetworkConnectionManager } from './NetworkConnectionManager';
import { GameContext } from '../../../infrastructure/engine/GameContext';
import { MESSAGE_TYPES, type PlayerUuid } from '../../../config/NetworkConfig';
import type { NetMessage } from '../types/MessageTypes';

/**
 * NetworkPlayerDataManager - Richiesta/gestione dati player (skill upgrade, player data)
 * Estratto da ClientNetworkSystem per Separation of Concerns
 */
export class NetworkPlayerDataManager {
  private readonly connectionManager: NetworkConnectionManager;
  private readonly gameContext: GameContext;
  public clientId: string;
  private readonly sendMessage: (message: NetMessage) => void;
  private readonly isConnected: () => boolean;

  constructor(
    connectionManager: NetworkConnectionManager,
    gameContext: GameContext,
    clientId: string,
    sendMessage: (message: NetMessage) => void,
    isConnected: () => boolean
  ) {
    this.connectionManager = connectionManager;
    this.gameContext = gameContext;
    this.clientId = clientId;
    this.sendMessage = sendMessage;
    this.isConnected = isConnected;
  }

  private getCurrentClientId(): string {
    return this.gameContext.localClientId || this.clientId;
  }

  /**
   * Requests a stat upgrade to the server (Server Authoritative)
   * Costs credits and cosmos instead of skill points
   */
  requestSkillUpgrade(upgradeType: 'hp' | 'shield' | 'speed' | 'damage' | 'missileDamage'): void {
    if (!this.isConnected()) {
      return;
    }

    const currentClientId = this.getCurrentClientId();
    const message = {
      type: 'skill_upgrade_request',
      clientId: currentClientId,  // WebSocket client ID
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
  requestPlayerData(_playerUuid: PlayerUuid): void {
    if (!this.connectionManager.isConnectionActive()) {
      console.warn('📊 [PLAYER_DATA] Cannot request player data - not connected');
      return;
    }

    // Require a server-assigned client id, without assuming a numeric format.
    const currentClientId = this.getCurrentClientId();
    if (!currentClientId || `${currentClientId}`.trim().length === 0) {
      console.warn('📊 [PLAYER_DATA] Cannot request player data - waiting for persistent clientId');
      return;
    }

    const message = {
      type: MESSAGE_TYPES.REQUEST_PLAYER_DATA,
      clientId: currentClientId
    };

    this.connectionManager.send(JSON.stringify(message));
  }
}
