import type { ChatMessage } from '../../ChatPanel';

/**
 * Manages chat messages array and display updates
 */
export class ChatMessageManager {
  private messages: ChatMessage[] = [];
  private maxMessages: number = 50;

  constructor(
    private readonly messagesContainer: HTMLElement,
    private readonly createMessageElement: (message: ChatMessage, context?: any) => HTMLElement,
    private readonly context?: any
  ) { }

  /**
   * Adds a message to the chat
   */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);

    // Limita il numero di messaggi
    if (this.messages.length > this.maxMessages) {
      this.messages.splice(0, this.messages.length - this.maxMessages);
    }

    this.updateMessagesDisplay();
  }

  /**
   * Adds a system message
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
   * Updates the messages display (optimized with DocumentFragment)
   */
  updateMessagesDisplay(): void {
    const fragment = document.createDocumentFragment();

    this.messages.forEach(message => {
      const messageElement = this.createMessageElement(message, this.context);
      fragment.appendChild(messageElement);
    });

    this.messagesContainer.innerHTML = '';
    this.messagesContainer.appendChild(fragment);
  }

  /**
   * Scrolls to bottom automatically
   */
  scrollToBottom(): void {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 10);
  }

  /**
   * Gets all messages
   */
  getMessages(): ChatMessage[] {
    return this.messages;
  }

  /**
   * Clears all messages
   */
  clear(): void {
    this.messages = [];
    this.messagesContainer.innerHTML = '';
  }
}
