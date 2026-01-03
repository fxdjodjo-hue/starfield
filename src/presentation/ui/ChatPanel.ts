import { ECS } from '../../infrastructure/ecs/ECS';
import { ChatText } from '../../entities/combat/ChatText';
import { PlayerSystem } from '../../systems/player/PlayerSystem';

/**
 * ChatPanel - Pannello chat semplice nell'angolo in basso a sinistra
 * Mostra sempre la chat senza possibilità di chiusura
 */
export class ChatPanel {
  private container: HTMLElement;
  private messagesContainer: HTMLElement;
  private inputContainer: HTMLElement;
  private inputElement: HTMLInputElement;
  private isVisible: boolean = false;
  private messages: ChatMessage[] = [];
  private maxMessages: number = 50;
  private ecs: ECS | null = null;
  private context: any = null;
  private playerSystem: PlayerSystem | null = null;

  constructor(ecs?: ECS, context?: any, playerSystem?: PlayerSystem) {
    this.ecs = ecs || null;
    this.context = context || null;
    this.playerSystem = playerSystem || null;
    this.createPanel();
    this.setupEventListeners();
  }

  /**
   * Imposta il riferimento al PlayerSystem
   */
  setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
  }

  /**
   * Crea il contenitore principale della chat
   */
  private createPanel(): void {
    // Container principale
    this.container = document.createElement('div');
    this.container.id = 'chat-panel';
    this.container.className = 'chat-panel';
    this.container.style.cssText = `
      position: fixed;
      bottom: 5px;
      left: 5px;
      width: 400px;
      height: 300px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 12px;
      box-shadow:
        0 20px 40px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      z-index: 1500;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    // Header con titolo e pulsante chiusura
    const header = document.createElement('div');
    header.className = 'chat-header';
    header.style.cssText = `
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%);
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px 12px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    `;

    // Container sinistro con titolo
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `display: flex; align-items: center; gap: 8px;`;

    const title = document.createElement('span');
    title.textContent = '💬 Chat';
    title.style.cssText = `
      color: rgba(255, 255, 255, 0.95);
      font-size: 14px;
      font-weight: 700;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    `;

    titleContainer.appendChild(title);

    // Pulsante chiusura nell'angolino destro (stile glass)
    const closeButton = document.createElement('button');
    closeButton.textContent = '-';
    closeButton.className = 'chat-close-button';
    closeButton.style.cssText = `
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.3);
      color: rgba(148, 163, 184, 0.8);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      border-radius: 6px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      line-height: 1;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(148, 163, 184, 0.9)';
      closeButton.style.borderColor = 'rgba(148, 163, 184, 0.5)';
      closeButton.style.color = 'rgba(15, 23, 42, 0.9)';
      closeButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(15, 23, 42, 0.8)';
      closeButton.style.borderColor = 'rgba(148, 163, 184, 0.3)';
      closeButton.style.color = 'rgba(148, 163, 184, 0.8)';
      closeButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
    });

    closeButton.addEventListener('click', () => {
      this.hideWithAnimation();
    });

    header.appendChild(titleContainer);
    header.appendChild(closeButton);

    // Container dei messaggi
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'chat-messages';
    this.messagesContainer.style.cssText = `
      flex: 1;
      padding: 12px 16px;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scrollbar-width: thin;
      scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
    `;

    // Personalizza scrollbar per WebKit
    this.messagesContainer.style.cssText += `
      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.3);
        border-radius: 3px;
      }
      &::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.5);
      }
    `;

    // Container input
    this.inputContainer = document.createElement('div');
    this.inputContainer.className = 'chat-input-container';
    this.inputContainer.style.cssText = `
      padding: 12px 16px;
      border-top: 1px solid rgba(148, 163, 184, 0.2);
      background: rgba(30, 41, 59, 0.8);
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Input field
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.placeholder = 'Scrivi un messaggio...';
    this.inputElement.className = 'chat-input';
    this.inputElement.autocomplete = 'off';
    this.inputElement.spellcheck = false;
    this.inputElement.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      background: rgba(51, 65, 85, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 6px;
      color: #ffffff;
      font-size: 14px;
      font-family: Arial, sans-serif;
      outline: none;
      transition: all 0.2s ease;
      white-space: pre;
      letter-spacing: normal;
      word-spacing: normal;
    `;

    this.inputElement.addEventListener('focus', () => {
      this.inputElement.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      this.inputElement.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)';
    });

    this.inputElement.addEventListener('blur', () => {
      this.inputElement.style.borderColor = 'rgba(148, 163, 184, 0.3)';
      this.inputElement.style.boxShadow = 'none';
    });

    // Pulsante invio
    const sendButton = document.createElement('button');
    sendButton.textContent = '📤';
    sendButton.className = 'chat-send-button';
    sendButton.style.cssText = `
      padding: 8px 12px;
      background: linear-gradient(135deg, #10b981, #059669);
      border: 1px solid rgba(16, 185, 129, 0.5);
      border-radius: 6px;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    sendButton.addEventListener('mouseenter', () => {
      sendButton.style.background = 'linear-gradient(135deg, #059669, #047857)';
      sendButton.style.borderColor = 'rgba(16, 185, 129, 0.8)';
    });

    sendButton.addEventListener('mouseleave', () => {
      sendButton.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      sendButton.style.borderColor = 'rgba(16, 185, 129, 0.5)';
    });

    sendButton.addEventListener('click', () => {
      this.sendMessage();
    });

    this.inputContainer.appendChild(this.inputElement);
    this.inputContainer.appendChild(sendButton);

    // Assembla tutto
    this.container.appendChild(header);
    this.container.appendChild(this.messagesContainer);
    this.container.appendChild(this.inputContainer);
  }

  /**
   * Imposta gli event listeners
   */
  private setupEventListeners(): void {
    // Focus sull'input mostra la chat
    this.inputElement.addEventListener('focus', () => {
      if (!this.isVisible) {
        this.show();
      }
    });


    // Listener per l'evento input (quando il valore cambia)
    this.inputElement.addEventListener('input', (e) => {
      console.log('Input value changed to:', `"${this.inputElement.value}"`);
    });

    // Invio messaggio con Enter
    this.inputElement.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    // Listener globale per ESC e "-" che chiude la chat quando è aperta
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Escape' || e.key === '-') && this.isVisible) {
        e.preventDefault();
        this.hideWithAnimation();
      }
    });

    // Listener globale per riaprire la chat con Invio quando è chiusa
    document.addEventListener('keydown', (e) => {
      // Non intercettare se qualsiasi input ha il focus
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Enter' && !this.isVisible) {
        e.preventDefault();
        this.show();
      }
    });

    // Previeni chiusura del pannello quando si clicca dentro
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Mostra la chat con animazione d'entrata
   */
  show(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }

    // Mostra il container
    this.container.style.display = 'flex';

    // Inizia con la chat sotto lo schermo
    this.container.style.transform = 'translateY(100%)';

    // Piccola pausa per permettere al browser di applicare la trasformazione iniziale
    setTimeout(() => {
      // Aggiungi animazione per far salire la chat
      this.container.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      this.container.style.transform = 'translateY(0)';
    }, 10);

    // Focus automatico sull'input quando l'animazione è completa
    setTimeout(() => {
      this.inputElement.focus();
      // Rimuovi la transizione dopo l'animazione
      this.container.style.transition = '';
    }, 410);

    // Il messaggio di benvenuto viene gestito dal PlayState
  }

  /**
   * Nasconde la chat
   */
  hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.container.style.display = 'none';
  }

  /**
   * Invia un messaggio
   */
  private sendMessage(): void {
    const message = this.inputElement.value.trim();

    if (!message) {
      // Input vuoto: chiudi la chat invece di inviare
      this.hideWithAnimation();
      return;
    }

    // Svuota l'input
    this.inputElement.value = '';

    // Trigger event per ChatManager (che gestisce tutto)
    const event = new CustomEvent('chatMessage', {
      detail: { message, sender: 'player' }
    });
    document.dispatchEvent(event);
  }

  /**
   * Aggiunge un messaggio alla chat
   */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);

    // Limita il numero di messaggi
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    this.updateMessagesDisplay();
    this.scrollToBottom();
  }

  /**
   * Aggiunge un messaggio di sistema
   */
  addSystemMessage(content: string): void {
    this.addMessage({
      id: `system-${Date.now()}`,
      sender: 'Sistema',
      content,
      timestamp: new Date(),
      type: 'system'
    });
  }

  /**
   * Aggiorna la visualizzazione dei messaggi
   */
  private updateMessagesDisplay(): void {
    this.messagesContainer.innerHTML = '';

    this.messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      this.messagesContainer.appendChild(messageElement);
    });
  }

  /**
   * Crea un elemento per un messaggio (solo testo semplice)
   */
  private createMessageElement(message: ChatMessage): HTMLElement {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.style.cssText = `
      margin-bottom: 2px;
      padding: 1px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      line-height: 1.2;
      word-wrap: break-word;
    `;

    // Nome del giocatore (solo per messaggi utente)
    if (message.type === 'user') {
      const playerName = this.context?.playerNickname || 'Player';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${playerName}: `;
      nameSpan.style.cssText = `
        color: #10b981;
        font-weight: 600;
      `;
      messageDiv.appendChild(nameSpan);
    }

    // Testo del messaggio
    const textSpan = document.createElement('span');
    textSpan.textContent = message.content;
    textSpan.style.cssText = `
      word-wrap: break-word;
      color: ${message.type === 'system' ? '#3b82f6' : 'rgba(255, 255, 255, 0.9)'};
    `;

    messageDiv.appendChild(textSpan);

    return messageDiv;
  }

  /**
   * Formatta l'ora del messaggio
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Nasconde la chat con animazione verso il basso
   */
  private hideWithAnimation(): void {
    // Aggiungi animazione di slide down
    this.container.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    this.container.style.transform = 'translateY(100%)';

    // Dopo l'animazione, nascondi completamente
    setTimeout(() => {
      this.hide();
      // Ripristina la posizione per quando verrà ri-mostrata
      this.container.style.transform = 'translateY(0)';
      this.container.style.transition = '';
    }, 500);
  }

  /**
   * Crea un testo fluttuante sopra il giocatore con il messaggio della chat
   */
  private createChatTextAbovePlayer(message: string): void {
    if (!this.ecs || !this.playerSystem) {
      console.warn('ChatPanel: ECS or PlayerSystem not available');
      return;
    }

    // Trova l'entità del giocatore
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) {
      console.warn('ChatPanel: Player entity not found');
      return;
    }

    // Limita la lunghezza del messaggio per il testo fluttuante
    const shortMessage = message.length > 15 ? message.substring(0, 12) + '...' : message;

    // Crea il testo fluttuante dedicato per i messaggi chat
    const chatTextEntity = this.ecs.createEntity();
    const chatText = new ChatText(shortMessage, playerEntity.id, 0, -100, 2500); // Più in alto sopra il personaggio

    this.ecs.addComponent(chatTextEntity, ChatText, chatText);
  }

  /**
   * Scrolla automaticamente in basso
   */
  private scrollToBottom(): void {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 10);
  }

  /**
   * Verifica se la chat è visibile
   */
  isVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Distrugge il pannello e rimuove gli elementi dal DOM
   */
  destroy(): void {
    if (document.body.contains(this.container)) {
      document.body.removeChild(this.container);
    }
  }
}

/**
 * Interfaccia per i messaggi della chat
 */
export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
  type: 'user' | 'system' | 'other';
}
