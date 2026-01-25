import type { ChatMessage } from '../../ChatPanel';

/**
 * Manages UI rendering for chat panel
 */
export class ChatUIRenderer {
  constructor(
    private readonly dprCompensation: number,
    private readonly targetHeight: number
  ) { }

  /**
   * Creates the main chat panel container
   */
  createPanel(): {
    container: HTMLElement;
    header: HTMLElement;
    messagesContainer: HTMLElement;
    inputContainer: HTMLElement;
    inputElement: HTMLInputElement;
    toggleButton: HTMLElement;
  } {
    const c = this.dprCompensation;

    // Container principale
    const container = document.createElement('div');
    container.id = 'chat-panel';
    container.className = 'chat-panel';
    container.style.cssText = `
      position: fixed;
      bottom: ${Math.round(5 * c)}px;
      left: ${Math.round(5 * c)}px;
      width: ${Math.round(400 * c)}px;
      height: ${this.targetHeight}px;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: ${Math.round(25 * c)}px;
      box-shadow:
        0 12px 48px rgba(0, 0, 0, 0.5),
        inset 0 1px 1px rgba(255, 255, 255, 0.05);
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
    const header = document.createElement('div');
    header.className = 'chat-header';
    header.style.cssText = `
      padding: ${Math.round(12 * c)}px ${Math.round(16 * c)}px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: ${Math.round(25 * c)}px ${Math.round(25 * c)}px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${Math.round(8 * c)}px;
      cursor: pointer;
    `;

    // Container sinistro con titolo
    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = `display: flex; align-items: center; gap: ${Math.round(8 * c)}px;`;

    const icon = document.createElement('div');
    icon.className = 'chat-title-icon';
    const iconSize = Math.round(18 * c);
    icon.style.cssText = `
      width: ${iconSize}px;
      height: ${iconSize}px;
      background-color: rgba(255, 255, 255, 0.9);
      mask-image: url('assets/svg/chat/chat-round-dots-svgrepo-com.svg');
      mask-size: contain;
      mask-repeat: no-repeat;
      mask-position: center;
      -webkit-mask-image: url('assets/svg/chat/chat-round-dots-svgrepo-com.svg');
      -webkit-mask-size: contain;
      -webkit-mask-repeat: no-repeat;
      -webkit-mask-position: center;
      filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.3));
    `;

    const title = document.createElement('span');
    title.textContent = 'Chat';
    title.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      font-size: ${Math.round(14 * c)}px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    `;

    titleContainer.appendChild(icon);
    titleContainer.appendChild(title);

    // Pulsante toggle
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '+';
    toggleButton.className = 'chat-toggle-button';
    toggleButton.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.8);
      font-size: ${Math.round(16 * c)}px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      border-radius: ${Math.round(12 * c)}px;
      width: ${Math.round(24 * c)}px;
      height: ${Math.round(24 * c)}px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      line-height: 1;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;

    // Hover effects per toggle button
    toggleButton.addEventListener('mouseenter', () => {
      toggleButton.style.background = 'rgba(255, 255, 255, 0.2)';
      toggleButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      toggleButton.style.color = 'rgba(255, 255, 255, 0.9)';
      toggleButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });

    toggleButton.addEventListener('mouseleave', () => {
      toggleButton.style.background = 'rgba(255, 255, 255, 0.1)';
      toggleButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      toggleButton.style.color = 'rgba(255, 255, 255, 0.8)';
      toggleButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    });

    header.appendChild(titleContainer);
    header.appendChild(toggleButton);

    // Container dei messaggi
    const messagesContainer = document.createElement('div');
    messagesContainer.className = 'chat-messages';
    messagesContainer.style.cssText = `
      flex: 1;
      padding: ${Math.round(12 * c)}px ${Math.round(16 * c)}px;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: ${Math.round(8 * c)}px;
      scrollbar-width: thin;
      scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
    `;

    // Personalizza scrollbar per WebKit
    const style = document.createElement('style');
    style.textContent = `
      .chat-messages::-webkit-scrollbar {
        width: ${Math.round(6 * c)}px;
      }
      .chat-messages::-webkit-scrollbar-track {
        background: transparent;
      }
      .chat-messages::-webkit-scrollbar-thumb {
        background: rgba(148, 163, 184, 0.3);
        border-radius: ${Math.round(3 * c)}px;
      }
      .chat-messages::-webkit-scrollbar-thumb:hover {
        background: rgba(148, 163, 184, 0.5);
      }
    `;
    document.head.appendChild(style);

    // Container input
    const inputContainer = document.createElement('div');
    inputContainer.className = 'chat-input-container';
    inputContainer.style.cssText = `
      padding: ${Math.round(12 * c)}px ${Math.round(16 * c)}px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      background: rgba(0, 0, 0, 0.2);
      display: flex;
      gap: ${Math.round(8 * c)}px;
      align-items: center;
    `;

    // Input field
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.placeholder = 'Type a message...';
    inputElement.className = 'chat-input';
    inputElement.autocomplete = 'off';
    inputElement.spellcheck = false;
    inputElement.style.cssText = `
      flex: 1;
      padding: ${Math.round(8 * c)}px ${Math.round(12 * c)}px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: ${Math.round(12 * c)}px;
      color: rgba(255, 255, 255, 0.9);
      font-size: ${Math.round(14 * c)}px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      outline: none;
      transition: all 0.2s ease;
      white-space: pre;
      letter-spacing: normal;
      word-spacing: normal;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
    `;

    // Focus effects per input
    inputElement.addEventListener('focus', () => {
      inputElement.style.borderColor = 'rgba(255, 255, 255, 0.4)';
      inputElement.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.1)';
      inputElement.style.background = 'rgba(255, 255, 255, 0.15)';
    });

    inputElement.addEventListener('blur', () => {
      inputElement.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      inputElement.style.boxShadow = 'none';
      inputElement.style.background = 'rgba(255, 255, 255, 0.1)';
    });

    // Pulsante invio
    const sendButton = document.createElement('button');
    sendButton.textContent = '↑';
    sendButton.className = 'chat-send-button';
    sendButton.style.cssText = `
      padding: ${Math.round(8 * c)}px ${Math.round(12 * c)}px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: ${Math.round(12 * c)}px;
      color: rgba(255, 255, 255, 0.8);
      font-size: ${Math.round(14 * c)}px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;

    // Hover effects per send button
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

    inputContainer.appendChild(inputElement);
    inputContainer.appendChild(sendButton);

    // Assembla tutto
    container.appendChild(header);
    container.appendChild(messagesContainer);
    container.appendChild(inputContainer);

    return {
      container,
      header,
      messagesContainer,
      inputContainer,
      inputElement,
      toggleButton
    };
  }

  /**
   * Creates a message element
   */
  createMessageElement(message: ChatMessage, context?: any): HTMLElement {
    const c = this.dprCompensation;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.style.cssText = `
      margin-bottom: ${Math.round(2 * c)}px;
      padding: ${Math.round(1 * c)}px 0;
      color: rgba(255, 255, 255, 0.9);
      font-size: ${Math.round(14 * c)}px;
      line-height: 1.2;
      word-wrap: break-word;
    `;

    // Nome del giocatore o System
    const isAdmin = message.isAdministrator || false;
    if (message.type === 'user') {
      const playerName = message.sender || context?.playerNickname || 'Player';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${playerName}: `;
      nameSpan.style.cssText = `
        color: ${isAdmin ? 'rgba(255, 50, 50, 1)' : 'rgba(200, 200, 200, 0.9)'};
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
      color: ${isAdmin ? 'rgba(255, 50, 50, 1)' : (message.type === 'system' ? 'rgba(220, 53, 69, 0.9)' : 'rgba(255, 255, 255, 0.9)')};
    `;

    messageDiv.appendChild(textSpan);

    return messageDiv;
  }

  /**
   * Formats time for message display
   */
  formatTime(date: Date): string {
    return date.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
