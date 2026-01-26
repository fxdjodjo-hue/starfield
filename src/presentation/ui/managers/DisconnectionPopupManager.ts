import { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';

/**
 * DisconnectionPopupManager - Handles the "Connection Lost" popup
 * Provides options to Reconnect or Return to Main Menu
 */
export class DisconnectionPopupManager {
    private networkSystem: ClientNetworkSystem;
    private isVisible: boolean = false;

    // UI Elements
    private overlay: HTMLDivElement | null = null;
    private popup: HTMLDivElement | null = null;

    constructor(networkSystem: ClientNetworkSystem) {
        this.networkSystem = networkSystem;
        this.createUI();
    }

    /**
     * Creates the DOM elements for the popup
     */
    private createUI(): void {
        // 1. Overlay (Dark background)
        this.overlay = document.createElement('div');
        this.overlay.id = 'disconnection-overlay';
        this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(5px);
      display: none;
      z-index: 20000; /* Higher than death popup */
      justify-content: center;
      align-items: center;
      flex-direction: column;
    `;

        // 2. Popup Container
        this.popup = document.createElement('div');
        this.popup.style.cssText = `
      background-color: rgba(20, 25, 30, 0.95);
      border: 2px solid #ff4444;
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      box-shadow: 0 0 30px rgba(255, 68, 68, 0.3);
      max-width: 500px;
      width: 90%;
    `;

        // 3. Title
        const title = document.createElement('h2');
        title.textContent = 'CONNECTION LOST';
        title.style.cssText = `
      color: #ff4444;
      margin: 0 0 20px 0;
      font-size: 28px;
      font-family: monospace;
      letter-spacing: 2px;
      text-transform: uppercase;
    `;

        // 4. Message
        const message = document.createElement('p');
        message.textContent = 'Connection to the star server has been interrupted.';
        message.style.cssText = `
      color: #aaaaaa;
      margin: 0 0 30px 0;
      font-family: monospace;
      font-size: 16px;
      line-height: 1.5;
    `;



        // 6. Buttons Container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
      display: flex;
      gap: 20px;
      justify-content: center;
    `;

        // 7. Main Menu Button
        const menuButton = document.createElement('button');
        menuButton.textContent = 'RETURN TO MAIN MENU';
        this.setButtonStyle(menuButton, '#ff4444');
        menuButton.onclick = () => this.handleMainMenu();

        // Assemble
        buttonContainer.appendChild(menuButton);

        this.popup.appendChild(title);
        this.popup.appendChild(message);
        this.popup.appendChild(buttonContainer);
        this.overlay.appendChild(this.popup);
        document.body.appendChild(this.overlay);
    }

    /**
     * Helper for button styling
     */
    private setButtonStyle(button: HTMLButtonElement, color: string): void {
        button.style.cssText = `
      background-color: transparent;
      color: ${color};
      border: 2px solid ${color};
      border-radius: 6px;
      padding: 12px 24px;
      font-size: 16px;
      font-family: monospace;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 140px;
    `;

        button.onmouseover = () => {
            button.style.backgroundColor = color;
            button.style.color = '#000';
        };
        button.onmouseout = () => {
            button.style.backgroundColor = 'transparent';
            button.style.color = color;
        };
    }

    /**
   * Shows the disconnection popup
   */
    public show(): void {
        if (this.isVisible) return;

        if (this.overlay) {
            this.isVisible = true;
            this.overlay.style.display = 'flex';
        }
    }

    /**
     * Hides the popup
     */
    public hide(): void {
        if (!this.isVisible) return;

        if (this.overlay) {
            this.isVisible = false;
            this.overlay.style.display = 'none';
        }
    }

    /**
     * Handles Main Menu click
     */
    private handleMainMenu(): void {
        // Reload the page to return to login screen (simplest way to reset state)
        window.location.reload();
    }

    /**
     * Cleanup
     */
    public destroy(): void {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
    }
}
