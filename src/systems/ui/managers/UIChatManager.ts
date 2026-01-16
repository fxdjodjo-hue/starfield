import { ChatPanel } from '../../../presentation/ui/ChatPanel';
import { ChatManager } from '../ChatManager';
import { ChatMessageHandler } from '../../../multiplayer/client/handlers/ChatMessageHandler';
import { ErrorMessageHandler } from '../../../multiplayer/client/handlers/ErrorMessageHandler';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { PlayerSystem } from '../../player/PlayerSystem';

/**
 * Manages chat UI, input, and message rendering
 */
export class UIChatManager {
  private chatPanel: ChatPanel;
  private chatManager: ChatManager;
  private clientNetworkSystem: ClientNetworkSystem | null = null;

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
  initialize(): void {
    // Assicurati che il pannello chat sia nel DOM anche se nascosto
    if (!document.body.contains(this.chatPanel['container'])) {
      // Imposta gli stili per lo stato nascosto prima di aggiungere al DOM
      const container = this.chatPanel['container'];
      const headerHeight = this.chatPanel['header'].offsetHeight || 49;
      container.style.height = headerHeight + 'px';
      container.style.display = 'none'; // NASCONDI durante il caricamento
      this.chatPanel['messagesContainer'].style.display = 'none';
      this.chatPanel['inputContainer'].style.display = 'none';
      this.chatPanel['toggleButton'].textContent = '+';
      this.chatPanel['_isVisible'] = false;

      document.body.appendChild(container);
    }
  }

  /**
   * Mostra la chat (chiamato quando tutto è pronto)
   */
  show(): void {
    if (this.chatPanel && this.chatPanel['container']) {
      const container = this.chatPanel['container'];
      const headerHeight = this.chatPanel['header'].offsetHeight || 49;
      container.style.height = headerHeight + 'px';
      container.style.display = 'flex'; // Mostra solo ora
      this.chatPanel['messagesContainer'].style.display = 'none';
      this.chatPanel['inputContainer'].style.display = 'none';
      this.chatPanel['toggleButton'].textContent = '+';
      this.chatPanel['_isVisible'] = false;
    }
  }

  /**
   * Configura il ClientNetworkSystem per la chat
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;

    // Abilita modalità multiplayer per il ChatManager
    this.chatManager.setMultiplayerMode(true, clientNetworkSystem.clientId);

    // Registra callback per inviare messaggi alla rete
    this.chatManager.onMessageSent((message) => {
      if (this.clientNetworkSystem) {
        this.clientNetworkSystem.sendChatMessage(message.content);
      }
    });

    // Registra gli handler per ricevere messaggi dalla rete
    const chatHandler = new ChatMessageHandler(this.chatManager);
    const errorHandler = new ErrorMessageHandler(this.chatManager);
    clientNetworkSystem.getMessageRouter().registerHandler(chatHandler);
    clientNetworkSystem.getMessageRouter().registerHandler(errorHandler);
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
