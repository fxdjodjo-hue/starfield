import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { LeaderboardResponseMessage } from '../../../config/NetworkConfig';
import type { LeaderboardData } from '../../../presentation/ui/LeaderboardPanel';

/**
 * Handles leaderboard response messages from the server
 * Updates the leaderboard panel with top players data
 */
export class LeaderboardResponseHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.LEADERBOARD_RESPONSE);
  }

  handle(message: LeaderboardResponseMessage, networkSystem: ClientNetworkSystem): void {
    console.log('[LeaderboardResponseHandler] Received leaderboard response:', {
      entriesCount: message.entries?.length || 0,
      sortBy: message.sortBy,
      playerRank: message.playerRank,
      error: (message as any).error
    });

    // Ottieni UiSystem per aggiornare il pannello leaderboard
    const uiSystem = networkSystem.getUiSystem();
    if (!uiSystem) {
      console.warn('[LeaderboardResponseHandler] UiSystem not available');
      return;
    }

    // Converti i dati del messaggio nel formato LeaderboardData
    const leaderboardData: LeaderboardData = {
      entries: (message.entries || []).map(entry => ({
        rank: entry.rank,
        playerId: entry.playerId,
        username: entry.username,
        experience: entry.experience,
        honor: entry.honor,
        recentHonor: entry.recentHonor,
        rankingPoints: entry.rankingPoints,
        kills: entry.kills,
        playTime: entry.playTime,
        level: entry.level,
        rankName: entry.rankName
      })),
      sortBy: message.sortBy,
      playerRank: message.playerRank
    };

    console.log('[LeaderboardResponseHandler] Processed leaderboard data:', {
      entriesCount: leaderboardData.entries.length,
      firstEntry: leaderboardData.entries[0]
    });

    // Aggiorna il pannello leaderboard
    const uiManager = uiSystem.getUIManager();
    if (uiManager) {
      // Il pannello è registrato con id 'leaderboard' (da PanelConfig)
      const leaderboardPanel = uiManager.getPanel('leaderboard');
      if (leaderboardPanel && typeof leaderboardPanel.update === 'function') {
        leaderboardPanel.update(leaderboardData);
      } else {
        console.warn('[LeaderboardResponseHandler] Leaderboard panel not found or update method not available');
      }
    }
  }
}
