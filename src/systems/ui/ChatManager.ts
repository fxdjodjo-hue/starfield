import { ChatPanel } from '../../presentation/ui/ChatPanel';

/**
 * ChatManager - Gestore centrale della chat per single-player e multiplayer
 * Gestisce comunicazione in tempo reale tra giocatori
 */
export class ChatManager {
  private chatPanel: ChatPanel;
  private isMultiplayerMode: boolean = false;
  private localPlayerId: string = 'local-player';
  private context: any = null;
  private messageCallbacks: ((message: ChatMessage) => void)[] = [];
  private lastMessageTime: number = 0;
  private lastMessageContent: string = '';

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
      this.log('info', 'Multiplayer mode enabled');
    } else {
      this.log('info', 'Single-player mode');
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
   * Riceve un messaggio dalla rete (multiplayer)
   */
  receiveNetworkMessage(message: ChatMessage): void {
    if (!this.isMultiplayerMode) {
      this.log('warn', 'Received network message but not in multiplayer mode');
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
    // SANITIZZA INPUT per sicurezza (XSS prevention)
    const sanitizedContent = this.sanitizeInput(content);
    if (sanitizedContent.length === 0) {
      return; // Messaggio vuoto dopo sanitizzazione
    }

    // RATE LIMITING lato client: max 1 messaggio ogni 5 secondi
    const now = Date.now();
    if (now - this.lastMessageTime < 5000) { // 5000ms = max 1 msg ogni 5 sec
      const secondsLeft = Math.ceil((5000 - (now - this.lastMessageTime)) / 1000);
      this.showErrorMessage(`Please wait ${secondsLeft} second${secondsLeft === 1 ? '' : 's'} before sending another message.`);
      return;
    }

    // CONTROLLA DUPLICATI: evita messaggi identici consecutivi
    if (sanitizedContent === this.lastMessageContent && this.lastMessageContent !== '') {
      this.showErrorMessage('Please do not send duplicate messages.');
      return;
    }

    const message: ChatMessage = {
      id: this.generateMessageId(),
      senderId: this.localPlayerId,
      senderName: this.getPlayerDisplayName(),
      content: sanitizedContent,
      timestamp: new Date(),
      type: 'user'
    };

    // Aggiorna timestamp per rate limiting
    this.lastMessageTime = now;

    // Mostra sempre localmente
    this.chatPanel.addMessage({
      id: message.id,
      sender: message.senderName,
      content: message.content,
      timestamp: message.timestamp,
      type: 'user'
    });

    // Aggiorna il tracking per duplicati
    this.lastMessageContent = sanitizedContent;
    this.lastMessageTime = now;

    // In multiplayer, invia alla rete
    if (this.isMultiplayerMode) {
      this.messageCallbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          this.log('error', `Error in message callback: ${error}`);
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
   * Metodo di logging centralizzato e consistente
   */
  private log(level: 'info' | 'warn' | 'error', message: string): void {
    const prefix = `[CHAT:${level.toUpperCase()}]`;
    console[level === 'info' ? 'log' : level](`${prefix} ${message}`);
  }

  /**
   * Sanitizza l'input utente per sicurezza (XSS prevention)
   */
  private sanitizeInput(content: string): string {
    return content
      .trim()
      .replace(/[<>\"'&]/g, '') // Basic XSS prevention
      .substring(0, 200); // Enforce length limit
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
   * Riceve un errore dal server (rate limiting, ecc.)
   */
  receiveError(errorMessage: string): void {
    this.log('info', `Received error from server: ${errorMessage}`);
    this.showErrorMessage(errorMessage);
  }

  /**
   * Mostra un messaggio di errore nella chat
   */
  private showErrorMessage(content: string): void {
    this.chatPanel.addMessage({
      id: `error-${Date.now()}`,
      sender: 'System',
      content: content,
      timestamp: new Date(),
      type: 'system'
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
