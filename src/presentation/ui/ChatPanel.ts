import type { ECS } from '../../infrastructure/ecs/ECS';
import type { PlayerSystem } from '../../systems/player/PlayerSystem';
import { DisplayManager } from '../../infrastructure/display';
import { DomPanelInteractionController } from './interactions/DomPanelInteractionController';

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
  private panelInteraction: DomPanelInteractionController | null = null;
  private panelMinWidth: number;
  private panelExpandedMinHeight: number;
  private panelCollapsedMinHeight: number;

  constructor(ecs?: ECS, context?: any, playerSystem?: PlayerSystem) {
    // ecs and playerSystem parameters kept for API compatibility but no longer used
    this.context = context || null;
    this.isEnabled = true;

    const dpr = DisplayManager.getInstance().getDevicePixelRatio();
    this.dprCompensation = 1 / dpr;
    this.targetHeight = Math.round(300 * this.dprCompensation);
    this.panelMinWidth = Math.max(1, Math.round(320 * this.dprCompensation));
    this.panelExpandedMinHeight = Math.max(1, Math.round(140 * this.dprCompensation));
    this.panelCollapsedMinHeight = Math.max(1, Math.round(52 * this.dprCompensation));

    this.initializeManagers();
    // Inizializza in stato chiuso (solo header visibile)
    this.hide();
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
      () => {
        this.applyExpandedInteractionConstraints();
        this.visibilityManager.show();
      },
      () => {
        this.applyCollapsedInteractionConstraints();
        this.visibilityManager.hideWithAnimation();
      },
      () => {
        this.inputManager.sendMessage();
      }
    );

    // Setup event listeners
    this.inputManager.setupEventListeners(
      () => {
        if (this.visibilityManager.isVisible()) {
          this.applyCollapsedInteractionConstraints();
          this.visibilityManager.hideWithAnimation();
        } else {
          this.applyExpandedInteractionConstraints();
          this.visibilityManager.show();
        }
      },
      () => {
        this.inputManager.sendMessage();
      }
    );

    this.panelInteraction = new DomPanelInteractionController({
      container: this.container,
      dragHandle: this.header,
      minWidth: this.panelMinWidth,
      minHeight: this.panelExpandedMinHeight,
      onSizeChanged: (size) => {
        this.visibilityManager.setExpandedHeight(size.height);
      }
    });
    this.applyCollapsedInteractionConstraints();
    this.panelInteraction.applyStoredLayout();

    this.managersInitialized = true;
  }

  private resolveCollapsedMinHeight(): number {
    if (!this.header) return this.panelCollapsedMinHeight;
    const measuredHeaderHeight = Math.round(this.header.getBoundingClientRect().height || 0);
    return Math.max(this.panelCollapsedMinHeight, measuredHeaderHeight || this.panelCollapsedMinHeight);
  }

  private applyExpandedInteractionConstraints(): void {
    if (!this.panelInteraction) return;
    this.panelInteraction.setMinDimensions(this.panelMinWidth, this.panelExpandedMinHeight);
    this.panelInteraction.setNativeResizeMode('both');
  }

  private applyCollapsedInteractionConstraints(): void {
    if (!this.panelInteraction) return;
    this.panelInteraction.setMinDimensions(this.panelMinWidth, this.resolveCollapsedMinHeight());
    this.panelInteraction.setNativeResizeMode('horizontal');
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
    this.applyExpandedInteractionConstraints();
    this.visibilityManager.show();
  }

  /**
   * Nasconde la chat (solo messaggi e input, mantiene l'header)
   */
  hide(): void {
    this.applyCollapsedInteractionConstraints();
    this.visibilityManager.hide();
  }

  /**
   * Imposta la visibilità dell'intero contenitore chat (incluso header)
   */
  setContainerVisibility(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'flex' : 'none';
    }
  }

  getContainer(): HTMLElement {
    return this.container;
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
    if (this.panelInteraction) {
      this.panelInteraction.destroy();
      this.panelInteraction = null;
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
  isAdministrator?: boolean;
}
