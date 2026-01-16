import type { ECS } from '../../infrastructure/ecs/ECS';
import type { PlayerSystem } from '../../systems/player/PlayerSystem';
import { DisplayManager } from '../../infrastructure/display';

// Modular architecture managers
import { ChatUIRenderer } from './managers/chat/ChatUIRenderer';
import { ChatMessageManager } from './managers/chat/ChatMessageManager';
import { ChatVisibilityManager } from './managers/chat/ChatVisibilityManager';
import { ChatInputManager } from './managers/chat/ChatInputManager';

/**
 * ChatPanel - Simple chat panel in the bottom left corner
 * Always shows the chat without the ability to close it
 */
export class ChatPanel {
  private container!: HTMLElement;
  private header!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private inputContainer!: HTMLElement;
  private inputElement!: HTMLInputElement;
  private toggleButton!: HTMLElement;
  private context: any = null;
  private isEnabled: boolean = true;
  private dprCompensation: number;
  private targetHeight: number;

  // Modular architecture managers
  private uiRenderer!: ChatUIRenderer;
  private messageManager!: ChatMessageManager;
  private visibilityManager!: ChatVisibilityManager;
  private inputManager!: ChatInputManager;
  private managersInitialized: boolean = false;

  constructor(ecs?: ECS, context?: any, playerSystem?: PlayerSystem) {
    // ecs and playerSystem parameters kept for API compatibility but no longer used
    this.context = context || null;
    this.isEnabled = true;
    
    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
    this.targetHeight = Math.round(300 * this.dprCompensation);
    
    this.initializeManagers();
    // Inizializza in stato chiuso (solo header visibile)
    this.visibilityManager.hide();
  }

  /**
   * Initializes managers with dependency injection
   */
  private initializeManagers(): void {
    if (this.managersInitialized) return;

    // Initialize UI renderer first
    this.uiRenderer = new ChatUIRenderer(this.dprCompensation, this.targetHeight);
    
    // Create panel UI
    const panelElements = this.uiRenderer.createPanel();
    this.container = panelElements.container;
    this.header = panelElements.header;
    this.messagesContainer = panelElements.messagesContainer;
    this.inputContainer = panelElements.inputContainer;
    this.inputElement = panelElements.inputElement;
    this.toggleButton = panelElements.toggleButton;

    // Initialize visibility manager
    this.visibilityManager = new ChatVisibilityManager(
      this.container,
      this.header,
      this.messagesContainer,
      this.inputContainer,
      this.inputElement,
      this.toggleButton,
      this.targetHeight
    );

    // Initialize message manager
    this.messageManager = new ChatMessageManager(
      this.messagesContainer,
      (msg) => this.uiRenderer.createMessageElement(msg, this.context),
      this.context
    );

    // Initialize input manager
    this.inputManager = new ChatInputManager(
      this.inputElement,
      this.container,
      () => this.isEnabled,
      () => this.visibilityManager.isVisible(),
      () => this.visibilityManager.show(),
      () => this.visibilityManager.hideWithAnimation(),
      () => {
        this.inputManager.sendMessage();
      }
    );

    // Setup event listeners
    this.inputManager.setupEventListeners(
      () => {
        if (this.visibilityManager.isVisible()) {
          this.visibilityManager.hideWithAnimation();
        } else {
          this.visibilityManager.show();
        }
      },
      () => {
        this.inputManager.sendMessage();
      }
    );

    this.managersInitialized = true;
  }

  /**
   * Imposta il riferimento al PlayerSystem
   * @deprecated No longer used, kept for API compatibility
   */
  setPlayerSystem(playerSystem: PlayerSystem): void {
    // No longer needed - chat text above player feature removed
  }



  /**
   * Mostra la chat con animazione d'espansione dal punto attuale
   */
  show(): void {
    this.visibilityManager.show();
  }

  /**
   * Nasconde la chat (solo messaggi e input, mantiene l'header)
   */
  hide(): void {
    this.visibilityManager.hide();
  }


  /**
   * Aggiunge un messaggio alla chat
   */
  addMessage(message: ChatMessage): void {
    this.messageManager.addMessage(message);
    this.messageManager.scrollToBottom();
  }

  /**
   * Aggiunge un messaggio di sistema
   */
  addSystemMessage(content: string): void {
    this.messageManager.addSystemMessage(content);
    this.messageManager.scrollToBottom();
  }


  /**
   * Verifica se la chat è visibile
   */
  isVisible(): boolean {
    return this.visibilityManager.isVisible();
  }

  /**
   * Distrugge il pannello e rimuove gli elementi dal DOM
   */
  destroy(): void {
    this.isEnabled = false;

    if (this.managersInitialized) {
      this.inputManager.destroy();
    }

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
