import { ChatPanel } from '../../../presentation/ui/ChatPanel';
import { ChatManager } from '../ChatManager';
import { ChatMessageHandler } from '../../../multiplayer/client/handlers/ChatMessageHandler';
import { ErrorMessageHandler } from '../../../multiplayer/client/handlers/ErrorMessageHandler';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { PlayerSystem } from '../../player/PlayerSystem';
import { applyFadeIn } from '../../../core/utils/rendering/UIFadeAnimation';

/**
 * Manages chat UI, input, and message rendering
 */
export class UIChatManager {
  private chatPanel: ChatPanel;
  private chatManager: ChatManager;
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private handlersRegistered: boolean = false;

  constructor(
    ecs: ECS,
    context: any,
    playerSystem: PlayerSystem | null
  ) {
    this.chatPanel = new ChatPanel(ecs, context, playerSystem || undefined);
    this.chatManager = new ChatManager(this.chatPanel, context);
  }

  /**
   * Inizializza la chat
   */
  /**
   * Inizializza la chat
   */
  initialize(): void {
    const container = this.chatPanel.getContainer();
    // Assicurati che il pannello chat sia nel DOM anche se nascosto
    if (container && !document.body.contains(container)) {
      // Nascondi inizialmente usando il metodo pubblico
      this.chatPanel.setContainerVisibility(false);

      // Assicurati che anche internamente sia nascosto (solo header)
      this.chatPanel.hide();

      document.body.appendChild(container);
    }
  }

  /**
   * Mostra la chat (chiamato quando tutto è pronto)
   */
  show(): void {
    if (this.chatPanel) {
      // Rendi visibile il contenitore
      this.chatPanel.setContainerVisibility(true);

      const container = this.chatPanel.getContainer();
      if (container) {
        // Usa fade-in sincronizzato
        applyFadeIn(container);
      }
    }
  }

  /**
   * Imposta la visibilità totale della chat (toggle settings)
   */
  setChatVisibility(visible: boolean): void {
    if (this.chatPanel) {
      this.chatPanel.setContainerVisibility(visible);
    }
  }

  /**
   * Configura il ClientNetworkSystem per la chat
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    // Preveni doppia configurazione
    if (this.clientNetworkSystem === clientNetworkSystem && this.handlersRegistered) {
      if (import.meta.env.DEV) {
      }
      return;
    }

    this.clientNetworkSystem = clientNetworkSystem;

    // Abilita modalità multiplayer per il ChatManager
    // Usa playerId se disponibile, altrimenti clientId come fallback
    const playerId = clientNetworkSystem.gameContext?.playerDbId;
    const localPlayerId = playerId ? `${playerId}` : clientNetworkSystem.clientId;
    this.chatManager.setMultiplayerMode(true, localPlayerId);

    // Registra callback per inviare messaggi alla rete (solo se non già registrato)
    if (!this.handlersRegistered) {
      this.chatManager.onMessageSent((message) => {
        if (this.clientNetworkSystem) {
          this.clientNetworkSystem.sendChatMessage(message.content);
        }
      });

      // Registra gli handler per ricevere messaggi dalla rete
      const chatHandler = new ChatMessageHandler(this.chatManager);
      const errorHandler = new ErrorMessageHandler();
      clientNetworkSystem.getMessageRouter().registerHandler(chatHandler);
      clientNetworkSystem.getMessageRouter().registerHandler(errorHandler);

      this.handlersRegistered = true;
    }
  }

  /**
   * Imposta il PlayerSystem per la chat
   */
  setPlayerSystem(playerSystem: PlayerSystem): void {
    if (this.chatPanel) {
      this.chatPanel.setPlayerSystem(playerSystem);
    }
  }

  /**
   * Aggiunge un messaggio di sistema alla chat
   */
  addSystemMessage(message: string): void {
    this.chatPanel.addSystemMessage(message);
  }

  /**
   * Abilita/disabilita la modalità multiplayer
   */
  setMultiplayerMode(enabled: boolean, playerId?: string): void {
    this.chatManager.setMultiplayerMode(enabled, playerId);
  }

  /**
   * Ottiene il ChatManager per aggiornamenti diretti
   */
  getChatManager(): ChatManager {
    return this.chatManager;
  }

  /**
   * Registra un callback per i messaggi inviati (per invio alla rete)
   */
  onMessageSent(callback: (message: any) => void): void {
    this.chatManager.onMessageSent(callback);
  }

  /**
   * Riceve un messaggio dalla rete (multiplayer)
   */
  receiveMessage(message: any): void {
    this.chatManager.receiveNetworkMessage(message);
  }

  /**
   * Simula un messaggio dalla rete (per testing)
   */
  simulateMessage(content: string, senderName?: string): void {
    this.chatManager.simulateNetworkMessage(content, senderName);
  }

  /**
   * Ottiene lo stato della chat
   */
  getStatus(): any {
    return this.chatManager.getStatus();
  }

  /**
   * Distrugge la chat
   */
  destroy(): void {
    this.chatPanel.destroy();
  }
}
