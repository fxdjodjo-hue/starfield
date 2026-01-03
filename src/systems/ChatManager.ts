import { ChatPanel } from '../presentation/ui/ChatPanel';

/**
 * ChatManager - Gestore centrale della chat per single-player e multiplayer
 * Prepara l'architettura per il supporto multiplayer
 */
export class ChatManager {
  private chatPanel: ChatPanel;
  private isMultiplayerMode: boolean = false;
  private localPlayerId: string = 'local-player';
  private context: any = null;
  private messageCallbacks: ((message: ChatMessage) => void)[] = [];

  constructor(chatPanel: ChatPanel, context?: any) {
    this.chatPanel = chatPanel;
    this.context = context;
    this.setupEventListeners();
  }

  /**
   * Imposta la modalità multiplayer
   */
  setMultiplayerMode(enabled: boolean, playerId?: string): void {
    this.isMultiplayerMode = enabled;
    if (playerId) {
      this.localPlayerId = playerId;
    }

    if (enabled) {
      console.log('Chat: Multiplayer mode enabled');
    } else {
      console.log('Chat: Single-player mode');
    }
  }

  /**
   * Imposta l'ID del giocatore locale
   */
  setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId;
  }

  /**
   * Registra un callback per i messaggi in uscita (da inviare alla rete)
   */
  onMessageSent(callback: (message: ChatMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Riceve un messaggio dalla rete (multiplayer) - DA USARE QUANDO IMPLEMENTI IL MULTIPLAYER
   */
  receiveNetworkMessage(message: ChatMessage): void {
    if (!this.isMultiplayerMode) {
      console.warn('Chat: Received network message but not in multiplayer mode');
      return;
    }

    // Non mostrare messaggi propri (già mostrati localmente)
    if (message.senderId === this.localPlayerId) {
      return;
    }

    // Aggiungi alla chat
    this.chatPanel.addMessage({
      id: message.id,
      sender: message.senderName,
      content: message.content,
      timestamp: message.timestamp,
      type: 'user' // o 'network' se vuoi distinguere
    });
  }

  /**
   * Invia un messaggio (usato internamente dalla chat)
   */
  private sendMessage(content: string): void {
    const message: ChatMessage = {
      id: this.generateMessageId(),
      senderId: this.localPlayerId,
      senderName: this.getPlayerDisplayName(),
      content: content,
      timestamp: new Date(),
      type: 'user'
    };

    // Mostra sempre localmente
    this.chatPanel.addMessage({
      id: message.id,
      sender: message.senderName,
      content: message.content,
      timestamp: message.timestamp,
      type: 'user'
    });

    // In multiplayer, invia alla rete
    if (this.isMultiplayerMode) {
      this.messageCallbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Chat: Error in message callback:', error);
        }
      });
    }
  }

  /**
   * Genera un ID univoco per il messaggio
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ottiene il nome visualizzato del giocatore
   */
  private getPlayerDisplayName(): string {
    // Usa il nickname dal context se disponibile
    return this.context?.playerNickname || 'Player';
  }

  /**
   * Setup degli event listeners per catturare messaggi dalla chat
   */
  private setupEventListeners(): void {
    // Ascolta i messaggi inviati dalla chat
    document.addEventListener('chatMessage', (event: any) => {
      const { message } = event.detail;
      if (message) {
        this.sendMessage(message);
      }
    });
  }

  /**
   * Metodi di utilità per il multiplayer futuro
   */

  /**
   * Simula ricezione messaggio dalla rete (per testing)
   */
  simulateNetworkMessage(content: string, senderName: string = 'OtherPlayer'): void {
    const message: ChatMessage = {
      id: this.generateMessageId(),
      senderId: `player_${senderName.toLowerCase()}`,
      senderName: senderName,
      content: content,
      timestamp: new Date(),
      type: 'user'
    };

    this.receiveNetworkMessage(message);
  }

  /**
   * Ottiene lo stato attuale della chat
   */
  getStatus(): { isMultiplayerMode: boolean, localPlayerId: string, messageCount: number } {
    return {
      isMultiplayerMode: this.isMultiplayerMode,
      localPlayerId: this.localPlayerId,
      messageCount: this.messageCallbacks.length
    };
  }
}

/**
 * Interfaccia per i messaggi della chat (multiplayer-ready)
 */
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'system' | 'network';
}
