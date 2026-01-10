import { ECS } from '../../infrastructure/ecs/ECS';
import { ChatText } from '../../entities/combat/ChatText';
import { PlayerSystem } from '../../systems/player/PlayerSystem';

/**
 * ChatPanel - Pannello chat semplice nell'angolo in basso a sinistra
 * Mostra sempre la chat senza possibilità di chiusura
 */
export class ChatPanel {
  private container!: HTMLElement;
  private header!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private inputContainer!: HTMLElement;
  private inputElement!: HTMLInputElement;
  private toggleButton!: HTMLElement;
  private _isVisible: boolean = false;
  private messages: ChatMessage[] = [];
  private maxMessages: number = 50;
  private ecs: ECS | null = null;
  private context: any = null;
  private playerSystem: PlayerSystem | null = null;
  private escKeyListener: ((e: KeyboardEvent) => void) | null = null;
  private enterKeyListener: ((e: KeyboardEvent) => void) | null = null;
  private isEnabled: boolean = true;

  constructor(ecs?: ECS, context?: any, playerSystem?: PlayerSystem) {
    this.ecs = ecs || null;
    this.context = context || null;
    this.playerSystem = playerSystem || null;
    this.isEnabled = true; // Abilita la chat quando viene creata
    this.createPanel();
    this.setupEventListeners();
    // Inizializza in stato chiuso (solo header visibile)
    this.hide();
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
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 25px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      z-index: 1500;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // Header con titolo e pulsante toggle
    this.header = document.createElement('div');
    this.header.className = 'chat-header';
    this.header.style.cssText = `
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 25px 25px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
    `;

    // Container sinistro con titolo
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `display: flex; align-items: center; gap: 8px;`;

    const title = document.createElement('span');
    title.textContent = '💬 Chat';
    title.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    `;

    titleContainer.appendChild(title);

    // Pulsante toggle nell'angolino destro (stile glass)
    this.toggleButton = document.createElement('button');
    this.toggleButton.textContent = '+';
    this.toggleButton.className = 'chat-toggle-button';
    this.toggleButton.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.8);
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      border-radius: 12px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      line-height: 1;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;

    this.toggleButton.addEventListener('mouseenter', () => {
      this.toggleButton.style.background = 'rgba(255, 255, 255, 0.2)';
      this.toggleButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      this.toggleButton.style.color = 'rgba(255, 255, 255, 0.9)';
      this.toggleButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });

    this.toggleButton.addEventListener('mouseleave', () => {
      this.toggleButton.style.background = 'rgba(255, 255, 255, 0.1)';
      this.toggleButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      this.toggleButton.style.color = 'rgba(255, 255, 255, 0.8)';
      this.toggleButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    });

    // Toggle click handler
    const toggleClick = () => {
      if (!this.isEnabled) return;
      if (this._isVisible) {
        this.hideWithAnimation();
      } else {
        this.show();
      }
    };

    this.toggleButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleClick();
    });

    this.header.addEventListener('click', toggleClick);

    this.header.appendChild(titleContainer);
    this.header.appendChild(this.toggleButton);

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
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      gap: 8px;
      align-items: center;
    `;

    // Input field
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.placeholder = 'Type a message...';
    this.inputElement.className = 'chat-input';
    this.inputElement.autocomplete = 'off';
    this.inputElement.spellcheck = false;
    this.inputElement.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      outline: none;
      transition: all 0.2s ease;
      white-space: pre;
      letter-spacing: normal;
      word-spacing: normal;
    `;

    this.inputElement.addEventListener('focus', () => {
      this.inputElement.style.borderColor = 'rgba(255, 255, 255, 0.4)';
      this.inputElement.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.1)';
      this.inputElement.style.background = 'rgba(255, 255, 255, 0.15)';
    });

    this.inputElement.addEventListener('blur', () => {
      this.inputElement.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      this.inputElement.style.boxShadow = 'none';
      this.inputElement.style.background = 'rgba(255, 255, 255, 0.1)';
    });

    // Pulsante invio
    const sendButton = document.createElement('button');
    sendButton.textContent = '↑';
    sendButton.className = 'chat-send-button';
    sendButton.style.cssText = `
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;

    sendButton.addEventListener('mouseenter', () => {
      sendButton.style.background = 'rgba(255, 255, 255, 0.2)';
      sendButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      sendButton.style.color = 'rgba(255, 255, 255, 0.9)';
      sendButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });

    sendButton.addEventListener('mouseleave', () => {
      sendButton.style.background = 'rgba(255, 255, 255, 0.1)';
      sendButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      sendButton.style.color = 'rgba(255, 255, 255, 0.8)';
      sendButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    });

    sendButton.addEventListener('click', () => {
      if (!this.isEnabled) return;
      this.sendMessage();
    });

    this.inputContainer.appendChild(this.inputElement);
    this.inputContainer.appendChild(sendButton);

    // Assembla tutto
    this.container.appendChild(this.header);
    this.container.appendChild(this.messagesContainer);
    this.container.appendChild(this.inputContainer);
  }

  /**
   * Imposta gli event listeners
   */
  private setupEventListeners(): void {
    // Focus sull'input mostra la chat
    this.inputElement.addEventListener('focus', () => {
      if (!this.isEnabled) return;
      if (!this._isVisible) {
        this.show();
      }
    });


    // Listener per l'evento input (quando il valore cambia)
    this.inputElement.addEventListener('input', (e) => {
      // Input value changed - no action needed
    });

    // Invio messaggio con Enter
    this.inputElement.addEventListener('keypress', (e) => {
      if (!this.isEnabled) return;
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    // Listener globale per ESC e "-" che chiude la chat quando è aperta
    this.escKeyListener = (e: KeyboardEvent) => {
      if (!this.isEnabled) return;
      if ((e.key === 'Escape' || e.key === '-') && this._isVisible) {
        e.preventDefault();
        this.hideWithAnimation();
      }
    };
    document.addEventListener('keydown', this.escKeyListener);

    // Listener globale per riaprire la chat con Invio quando è chiusa
    this.enterKeyListener = (e: KeyboardEvent) => {
      if (!this.isEnabled) return;
      // Non intercettare se qualsiasi input ha il focus
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Enter' && !this._isVisible) {
        e.preventDefault();
        this.show();
      }
    };
    document.addEventListener('keydown', this.enterKeyListener);

    // Previeni chiusura del pannello quando si clicca dentro
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Mostra la chat con animazione d'espansione dal punto attuale
   */
  show(): void {
    if (this._isVisible) return;

    this._isVisible = true;
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }

    // Mostra il container
    this.container.style.display = 'flex';

    // Ottieni l'altezza attuale dell'header (quando è minimizzata)
    const currentHeight = this.container.offsetHeight;
    const targetHeight = 300;

    // Imposta l'altezza iniziale (attuale) per l'animazione
    this.container.style.height = currentHeight + 'px';
    this.container.style.transition = 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

    // Piccola pausa per permettere al browser di applicare l'altezza iniziale
    setTimeout(() => {
      // Aggiungi animazione per espandere l'altezza
      this.container.style.height = targetHeight + 'px';
    }, 10);

    // Espandi messaggi e input quando l'animazione è completa
    setTimeout(() => {
      this.messagesContainer.style.display = 'flex';
      this.inputContainer.style.display = 'flex';
      // Aggiorna il pulsante toggle
      this.toggleButton.textContent = '-';
      // Rimuovi la transizione dopo l'animazione
      this.container.style.transition = '';
    }, 410);

    // Focus automatico sull'input quando l'animazione è completa
    setTimeout(() => {
      this.inputElement.focus();
    }, 420);

    // Il messaggio di benvenuto viene gestito dal PlayState
  }

  /**
   * Nasconde la chat (solo messaggi e input, mantiene l'header)
   */
  hide(): void {
    if (!this._isVisible) return;

    this._isVisible = false;
    // Nasconde solo messaggi e input, mantiene l'header visibile
    this.messagesContainer.style.display = 'none';
    this.inputContainer.style.display = 'none';
    // Aggiorna il pulsante toggle
    this.toggleButton.textContent = '+';
    // Rimuovi il focus dall'input
    this.inputElement.blur();
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

    // Limita il numero di messaggi (ottimizzazione memory)
    if (this.messages.length > this.maxMessages) {
      this.messages.splice(0, this.messages.length - this.maxMessages);
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
   * Aggiorna la visualizzazione dei messaggi (ottimizzato con DocumentFragment)
   */
  private updateMessagesDisplay(): void {
    // Usa DocumentFragment per batch DOM operations (performance optimization)
    const fragment = document.createDocumentFragment();

    this.messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      fragment.appendChild(messageElement);
    });

    // Singola operazione DOM invece di N operazioni separate
    this.messagesContainer.innerHTML = '';
    this.messagesContainer.appendChild(fragment);
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

    // Nome del giocatore (per messaggi utente) o System (per messaggi di sistema)
    if (message.type === 'user') {
      const playerName = message.sender || this.context?.playerNickname || 'Player';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${playerName}: `;
      nameSpan.style.cssText = `
        color: rgba(200, 200, 200, 0.9);
        font-weight: 600;
      `;
      messageDiv.appendChild(nameSpan);
    } else if (message.type === 'system') {
      const systemSpan = document.createElement('span');
      systemSpan.textContent = 'System: ';
      systemSpan.style.cssText = `
        color: rgba(220, 53, 69, 0.9);
        font-weight: 600;
      `;
      messageDiv.appendChild(systemSpan);
    }

    // Testo del messaggio
    const textSpan = document.createElement('span');
    textSpan.textContent = message.content;
    textSpan.style.cssText = `
      word-wrap: break-word;
      color: ${message.type === 'system' ? 'rgba(220, 53, 69, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
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
   * Nasconde la chat con animazione di compressione
   */
  private hideWithAnimation(): void {
    if (!this._isVisible) return;

    // Salva l'altezza attuale per l'animazione
    const currentHeight = this.container.offsetHeight;
    const headerHeight = this.header.offsetHeight;

    // Imposta altezza fissa per l'animazione
    this.container.style.height = currentHeight + 'px';
    this.container.style.transition = 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

    // Dopo un breve delay, comprimi all'altezza dell'header
    setTimeout(() => {
      this.container.style.height = headerHeight + 'px';
      // Nasconde messaggi e input durante l'animazione
      this.messagesContainer.style.display = 'none';
      this.inputContainer.style.display = 'none';
    }, 10);

    // Completa l'animazione
    setTimeout(() => {
      this._isVisible = false;
      // Aggiorna il pulsante toggle
      this.toggleButton.textContent = '+';
      // Rimuovi il focus dall'input
      this.inputElement.blur();
      // Mantieni l'altezza dell'header per lo stato chiuso
      this.container.style.height = headerHeight + 'px';
      this.container.style.transition = '';
    }, 410);
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
    return this._isVisible;
  }

  /**
   * Distrugge il pannello e rimuove gli elementi dal DOM
   */
  destroy(): void {
    // Disabilita completamente la chat
    this.isEnabled = false;

    // Rimuovi event listeners globali
    if (this.escKeyListener) {
      document.removeEventListener('keydown', this.escKeyListener);
      this.escKeyListener = null;
    }
    if (this.enterKeyListener) {
      document.removeEventListener('keydown', this.enterKeyListener);
      this.enterKeyListener = null;
    }

    // Rimuovi il container dal DOM
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
