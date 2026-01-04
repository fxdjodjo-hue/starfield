import type { GameContext } from '../../infrastructure/engine/GameContext';
import { getFormattedVersion } from '../../utils/config/Version';
import { auth } from '../../lib/supabase';

/**
 * Schermata iniziale del gioco Starfield
 * Gestisce input nickname e avvio partita
 */
export class StartScreen {
  private context: GameContext;
  private canvas: HTMLCanvasElement;
  private onPlayCallback?: (nickname: string) => void;

  // Elementi DOM
  private nicknameInput!: HTMLInputElement;
  private playButton!: HTMLButtonElement;
  private titleElement!: HTMLDivElement;
  private versionElement!: HTMLDivElement;
  private headerContainer!: HTMLDivElement;
  private container!: HTMLDivElement;

  // Stato
  private isCreatingUser: boolean = false;

  constructor(context: GameContext) {
    this.context = context;
    this.canvas = context.canvas;

    // Crea elementi DOM
    this.createUI();
  }

  /**
   * Crea l'interfaccia utente DOM
   */
  private createUI(): void {
    // Container principale
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #000011 0%, #001122 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: Arial, sans-serif;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
    `;

    // Titolo
    this.titleElement = document.createElement('h1');
    this.titleElement.textContent = 'STARFIELD';
    this.titleElement.style.cssText = `
      color: #00ff88;
      font-size: 48px;
      margin: 0;
      text-shadow: 0 0 20px #00ff88;
      letter-spacing: 4px;
      text-align: center;
      width: 100%;
    `;

    // Versione
    this.versionElement = document.createElement('div');
    this.versionElement.textContent = `Version ${getFormattedVersion()}`;
    this.versionElement.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
      font-family: monospace;
      letter-spacing: 1px;
      text-align: center;
      width: 100%;
    `;

    // Container header per titolo e versione
    this.headerContainer = document.createElement('div');
    this.headerContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-top: 80px;
      margin-bottom: 30px;
      width: 100%;
    `;

    // Container form
    const formContainer = document.createElement('div');
    formContainer.style.cssText = `
      background: rgba(0, 255, 136, 0.1);
      padding: 30px;
      border-radius: 10px;
      border: 2px solid #00ff88;
      box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
      min-width: 300px;
      max-width: 400px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
    `;

    // Label nickname
    const label = document.createElement('label');
    label.textContent = 'Enter your nickname:';
    label.style.cssText = `
      color: #ffffff;
      display: block;
      margin-bottom: 10px;
      font-size: 16px;
      text-align: center;
      width: 100%;
    `;

    // Input nickname
    this.nicknameInput = document.createElement('input');
    this.nicknameInput.type = 'text';
    this.nicknameInput.placeholder = 'Your nickname...';
    this.nicknameInput.maxLength = 20;
    this.nicknameInput.style.cssText = `
      width: 100%;
      padding: 12px;
      margin-bottom: 20px;
      border: 2px solid #0088ff;
      border-radius: 5px;
      background: rgba(0, 0, 0, 0.5);
      color: #ffffff;
      font-size: 16px;
      box-sizing: border-box;
    `;

    // Pulsante play
    this.playButton = document.createElement('button');
    this.playButton.textContent = 'START';
    this.playButton.style.cssText = `
      width: 100%;
      padding: 15px;
      background: linear-gradient(45deg, #00ff88, #0088ff);
      border: none;
      border-radius: 5px;
      color: #000011;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
    `;

    // Eventi
    this.playButton.addEventListener('click', () => this.handlePlay());
    this.nicknameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handlePlay();
      }
    });

    // Hover effect
    this.playButton.addEventListener('mouseenter', () => {
      this.playButton.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.5)';
    });

    this.playButton.addEventListener('mouseleave', () => {
      this.playButton.style.boxShadow = 'none';
    });

    // Assembla elementi
    formContainer.appendChild(label);
    formContainer.appendChild(this.nicknameInput);
    formContainer.appendChild(this.playButton);

    // Assembla header (titolo + versione centrati insieme)
    this.headerContainer.appendChild(this.titleElement);
    this.headerContainer.appendChild(this.versionElement);

    this.container.appendChild(this.headerContainer);
    this.container.appendChild(formContainer);

    // Aggiungi al DOM
    document.body.appendChild(this.container);
  }

  /**
   * Gestisce il click sul pulsante play
   */
  private async handlePlay(): Promise<void> {
    const nickname = this.nicknameInput.value.trim();

    if (nickname.length === 0) {
      // Mostra errore
      this.nicknameInput.style.borderColor = '#ff4444';
      this.nicknameInput.placeholder = 'Enter a nickname!';
      setTimeout(() => {
        this.nicknameInput.style.borderColor = '#0088ff';
        this.nicknameInput.placeholder = 'Your nickname...';
      }, 2000);
      return;
    }

    if (this.isCreatingUser) {
      return; // Evita multiple richieste
    }

    // Mostra loading
    this.isCreatingUser = true;
    this.playButton.textContent = 'Creating Account...';
    this.playButton.disabled = true;
    this.nicknameInput.disabled = true;

    console.log('👤 [StartScreen] Creando utente per nickname:', nickname);

    try {
      // Crea utente con Supabase Auth (email temporanea per demo)
      const tempEmail = `${nickname.toLowerCase()}@starfield.local`;
      const tempPassword = 'password123'; // Per demo - in produzione usare password sicura

      const { data: authData, error: authError } = await auth.signUp(tempEmail, tempPassword, nickname);

      if (authError) {
        console.error('❌ [StartScreen] Errore creazione utente:', authError.message);

        // Mostra errore
        this.nicknameInput.style.borderColor = '#ff4444';
        this.nicknameInput.placeholder = 'Error creating account!';

        // Reset UI
        this.playButton.textContent = 'START GAME';
        this.playButton.disabled = false;
        this.nicknameInput.disabled = false;
        this.isCreatingUser = false;

        return;
      }

      console.log('✅ [StartScreen] Utente creato con successo:', authData.user?.id);

      // Salva dati nel context
      this.context.playerNickname = nickname;
      this.context.playerId = authData.user?.id || '';

      // Chiama callback
      this.onPlayCallback?.(nickname);

    } catch (error) {
      console.error('❌ [StartScreen] Errore critico:', error);

      // Mostra errore generico
      this.nicknameInput.style.borderColor = '#ff4444';
      this.nicknameInput.placeholder = 'Connection error!';

      // Reset UI
      this.playButton.textContent = 'START GAME';
      this.playButton.disabled = false;
      this.nicknameInput.disabled = false;
      this.isCreatingUser = false;
    }
  }

  /**
   * Imposta il callback per quando si preme play
   */
  setOnPlayCallback(callback: (nickname: string) => void): void {
    this.onPlayCallback = callback;
  }

  /**
   * Nasconde l'interfaccia utente (senza rimuoverla dal DOM)
   */
  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Mostra l'interfaccia utente
   */
  show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }

  /**
   * Rimuove l'interfaccia dal DOM
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  /**
   * Restituisce il nickname corrente
   */
  getNickname(): string {
    return this.nicknameInput.value;
  }
}
