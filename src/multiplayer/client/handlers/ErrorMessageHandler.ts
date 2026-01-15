import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import type { ErrorMessage } from '../types/MessageTypes';
import { ChatManager } from '../../../systems/ui/ChatManager';

/**
 * Handles error messages from the server (rate limiting, validation errors, etc.)
 */
export class ErrorMessageHandler extends BaseMessageHandler {
  constructor(private chatManager: ChatManager) {
    super('error');
  }

  handle(message: ErrorMessage, networkSystem: ClientNetworkSystem): void {
    console.log('🚫 [ERROR] Received error from server:', message.message, message.code);

    // Se è un errore di upgrade, mostra popup elegante
    if (message.code === 'INSUFFICIENT_RESOURCES' || message.code === 'INSUFFICIENT_SKILL_POINTS') {
      console.log('🔧 [INSUFFICIENT] Showing popup for insufficient resources');
      const uiSystem = networkSystem.getUiSystem();
      if (uiSystem) {
        const upgradePanel = uiSystem.getUpgradePanel();
        if (upgradePanel) {
          console.log('🔧 [INSUFFICIENT] Found upgrade panel, showing popup');
          // Mostra popup elegante invece del messaggio chat
          upgradePanel.showInsufficientResourcesPopup(message.message);
        } else {
          console.log('🔧 [INSUFFICIENT] No upgrade panel found');
          // Fallback al chat se non c'è il pannello
          this.chatManager.receiveError(message.message);
        }
      } else {
        console.log('🔧 [INSUFFICIENT] No UI system found');
        // Fallback al chat se non c'è il sistema UI
        this.chatManager.receiveError(message.message);
      }
    } else {
      // Inoltra altri errori al ChatManager
      this.chatManager.receiveError(message.message);
    }
  }
}
