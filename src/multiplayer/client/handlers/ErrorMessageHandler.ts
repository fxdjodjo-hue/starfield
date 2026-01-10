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

    // Inoltra l'errore al ChatManager per la visualizzazione
    this.chatManager.receiveError(message.message);

    // Se è un errore di skill upgrade, resetta lo stato del pannello Skills
    if (message.code === 'INSUFFICIENT_SKILL_POINTS') {
      const uiSystem = networkSystem.getUiSystem();
      if (uiSystem) {
        const skillsPanel = uiSystem.getSkillsPanel();
        if (skillsPanel) {
          // Resetta tutti gli upgrade in progress
          console.log('🔧 [ERROR] Resetting skill upgrade progress due to insufficient skill points');
          // Il pannello dovrebbe avere un metodo per resettare tutti gli stati
          // Per ora, ricarichiamo il pannello per sicurezza
          skillsPanel.updatePlayerStats();
        }
      }
    }
  }
}
