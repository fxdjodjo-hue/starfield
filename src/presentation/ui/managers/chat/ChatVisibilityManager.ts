/**
 * Manages chat panel visibility and animations
 */
export class ChatVisibilityManager {
  private _isVisible: boolean = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly header: HTMLElement,
    private readonly messagesContainer: HTMLElement,
    private readonly inputContainer: HTMLElement,
    private readonly inputElement: HTMLInputElement,
    private readonly toggleButton: HTMLElement,
    private readonly targetHeight: number
  ) {
    // Initialize in hidden state
    this.messagesContainer.style.display = 'none';
    this.inputContainer.style.display = 'none';
    this.toggleButton.textContent = '+';

    // Force container height to header height
    // Since header might not be rendered yet, we use a safe estimation or try to read it
    // But since we are in constructor, offsetHeight might be 0 if not attached.
    // However, ChatUIRenderer created it with styles.
    // Let's set it to valid collapsed height.
    // Using header.offsetHeight is risky if 0.
    // But wait, ChatUIRenderer sets styles. 
    // Let's try to set it to 'auto' or a calculated value if possible.
    // We don't have header height here easily without DOM. 
    // But we can reset height to 'auto' temporarily or just trust reset later.
    // Actually, setting height to '50px' (approx) or letting it wrap content is best.
    this.container.style.height = 'auto'; // Collapse to header
  }

  /**
   * Shows the chat with expansion animation
   */
  show(): void {
    if (this._isVisible) return;

    this._isVisible = true;
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }

    this.container.style.display = 'flex';

    const currentHeight = this.container.offsetHeight;
    this.container.style.height = currentHeight + 'px';
    this.container.style.transition = 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

    setTimeout(() => {
      this.container.style.height = this.targetHeight + 'px';
    }, 10);

    setTimeout(() => {
      this.messagesContainer.style.display = 'flex';
      this.inputContainer.style.display = 'flex';
      this.toggleButton.textContent = '-';
      this.container.style.transition = '';
    }, 410);

    setTimeout(() => {
      this.inputElement.focus();
    }, 420);
  }

  /**
   * Hides the chat (only messages and input, keeps header)
   */
  hide(): void {
    if (!this._isVisible) return;

    this._isVisible = false;
    this.messagesContainer.style.display = 'none';
    this.inputContainer.style.display = 'none';
    this.toggleButton.textContent = '+';
    this.inputElement.blur();
  }

  /**
   * Hides the chat with compression animation
   */
  hideWithAnimation(): void {
    if (!this._isVisible) return;

    const currentHeight = this.container.offsetHeight;
    const headerHeight = this.header.offsetHeight;

    this.container.style.height = currentHeight + 'px';
    this.container.style.transition = 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

    setTimeout(() => {
      this.container.style.height = headerHeight + 'px';
      this.messagesContainer.style.display = 'none';
      this.inputContainer.style.display = 'none';
    }, 10);

    setTimeout(() => {
      this._isVisible = false;
      this.toggleButton.textContent = '+';
      this.inputElement.blur();
      this.container.style.height = headerHeight + 'px';
      this.container.style.transition = '';
    }, 410);
  }

  /**
   * Checks if chat is visible
   */
  isVisible(): boolean {
    return this._isVisible;
  }
}
