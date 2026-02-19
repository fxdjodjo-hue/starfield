import { DomPanelInteractionController } from '../../interactions/DomPanelInteractionController';

/**
 * Manages chat input and event listeners
 */
export class ChatInputManager {
  private escKeyListener: ((e: KeyboardEvent) => void) | null = null;
  private enterKeyListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    private readonly inputElement: HTMLInputElement,
    private readonly container: HTMLElement,
    private readonly isEnabled: () => boolean,
    private readonly getIsVisible: () => boolean,
    private readonly show: () => void,
    private readonly hideWithAnimation: () => void,
    private readonly sendMessageCallback: () => void
  ) {}

  /**
   * Sets up event listeners
   */
  setupEventListeners(
    toggleClick: () => void,
    sendButtonClick: () => void
  ): void {
    // Focus sull'input mostra la chat
    this.inputElement.addEventListener('focus', () => {
      if (!this.isEnabled()) return;
      if (!this.getIsVisible()) {
        this.show();
      }
    });

    // Invio messaggio con Enter
    this.inputElement.addEventListener('keypress', (e) => {
      if (!this.isEnabled()) return;
      if (e.key === 'Enter') {
        this.sendMessageCallback();
      }
    });

    // Listener globale per ESC e "-" che chiude la chat quando è aperta
    this.escKeyListener = (e: KeyboardEvent) => {
      if (!this.isEnabled()) return;
      if ((e.key === 'Escape' || e.key === '-') && this.getIsVisible()) {
        e.preventDefault();
        this.hideWithAnimation();
      }
    };
    document.addEventListener('keydown', this.escKeyListener);

    // Listener globale per riaprire la chat con Invio quando è chiusa
    this.enterKeyListener = (e: KeyboardEvent) => {
      if (!this.isEnabled()) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Enter' && !this.getIsVisible()) {
        e.preventDefault();
        this.show();
      }
    };
    document.addEventListener('keydown', this.enterKeyListener);

    // Previeni chiusura del pannello quando si clicca dentro
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Setup toggle button click
    const toggleButton = this.container.querySelector('.chat-toggle-button') as HTMLElement;
    if (toggleButton) {
      toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleClick();
      });
    }

    // Setup header click (also toggles)
    const header = this.container.querySelector('.chat-header') as HTMLElement;
    if (header) {
      header.addEventListener('click', (event) => {
        if (DomPanelInteractionController.consumeSuppressedClick(this.container)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        toggleClick();
      });
    }

    // Setup send button click
    const sendButton = this.container.querySelector('.chat-send-button') as HTMLElement;
    if (sendButton) {
      sendButton.addEventListener('click', () => {
        if (!this.isEnabled()) return;
        sendButtonClick();
      });
    }
  }

  /**
   * Sends a message
   */
  sendMessage(): string | null {
    const message = this.inputElement.value.trim();

    if (!message) {
      this.hideWithAnimation();
      return null;
    }

    this.inputElement.value = '';

    // Trigger event per ChatManager
    const event = new CustomEvent('chatMessage', {
      detail: { message, sender: 'player' }
    });
    document.dispatchEvent(event);

    return message;
  }

  /**
   * Cleans up event listeners
   */
  destroy(): void {
    if (this.escKeyListener) {
      document.removeEventListener('keydown', this.escKeyListener);
      this.escKeyListener = null;
    }
    if (this.enterKeyListener) {
      document.removeEventListener('keydown', this.enterKeyListener);
      this.enterKeyListener = null;
    }
  }
}
