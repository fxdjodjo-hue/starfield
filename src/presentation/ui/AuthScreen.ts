import type { GameContext } from '../../infrastructure/engine/GameContext';

// Modular architecture managers
import { AuthState } from './managers/auth/AuthState';
import { AuthValidationManager } from './managers/auth/AuthValidationManager';
import { AuthUIRenderer } from './managers/auth/AuthUIRenderer';
import { AuthStateManager } from './managers/auth/AuthStateManager';
import { AuthFormManager } from './managers/auth/AuthFormManager';
import { AuthSessionManager } from './managers/auth/AuthSessionManager';
import { AuthInitializationManager } from './managers/auth/AuthInitializationManager';

/**
 * Schermata di autenticazione per MMO
 * Gestisce login, registrazione e gestione sessioni
 * Uses modular architecture with separate managers for different responsibilities
 */
export class AuthScreen {
  private context: GameContext;
  private canvas: HTMLCanvasElement;
  private onAuthenticated?: () => void;

  // Modular architecture managers (lazy initialization)
  private initManager!: AuthInitializationManager;
  private validationManager!: AuthValidationManager;
  private formManager!: AuthFormManager;
  private stateManager!: AuthStateManager;
  private sessionManager!: AuthSessionManager;
  private managersInitialized: boolean = false;

  constructor(context: GameContext) {
    this.context = context;
    this.canvas = context.canvas;

    // Initialize managers immediately (UI needs to be created in constructor)
    this.initializeManagers();
    
    // Initialize after managers are ready (async, but constructor can't be async)
    this.init().catch(console.error);
  }

  /**
   * Initializes managers with dependency injection
   */
  private initializeManagers(): void {
    try {
      if (this.managersInitialized) return;

      // Initialize initialization manager first (creates UI)
      this.initManager = new AuthInitializationManager();

      // Get containers from init manager
      const container = this.initManager.getContainer();
      const loadingContainer = this.initManager.getLoadingContainer();
      const authContainer = this.initManager.getAuthContainer();

      // Initialize validation manager (independent)
      this.validationManager = new AuthValidationManager(authContainer);

      // Create a temporary form manager reference for state manager
      let formManagerRef: AuthFormManager | null = null;

      // Initialize state manager (needs form manager callback)
      this.stateManager = new AuthStateManager(
        container,
        loadingContainer,
        authContainer,
        () => formManagerRef?.renderForm() || null,
        () => this.initManager.showDiscordIcon(),
        () => this.initManager.hideDiscordIcon()
      );

      // Initialize session manager
      this.sessionManager = new AuthSessionManager(
        this.context,
        (state) => this.stateManager.setState(state),
        (text) => this.initManager.updateLoadingText(text),
        (message) => this.validationManager.showError(message),
        (message) => this.validationManager.showSuccess(message),
        (loggedIn) => this.stateManager.setJustLoggedIn(loggedIn),
        (processing) => this.stateManager.setProcessing(processing),
        (button, show) => formManagerRef?.showButtonLoading(button, show),
        (email) => this.validationManager.isValidEmail(email),
        (error) => this.validationManager.getFriendlyErrorMessage(error),
        this.onAuthenticated
      );

      // Initialize form manager (needs state and session managers)
      this.formManager = new AuthFormManager(
        authContainer,
        () => this.stateManager.getCurrentState(),
        () => this.stateManager.isProcessingRequest(),
        (email, password, button) => this.sessionManager.handleLogin(email, password, button),
        (email, password, confirmPassword, nickname, button) => this.sessionManager.handleRegister(email, password, confirmPassword, nickname, button),
        (state) => this.stateManager.setState(state),
        (button, show) => this.formManager.showButtonLoading(button, show)
      );

      // Set form manager reference
      formManagerRef = this.formManager;

      this.managersInitialized = true;
    } catch (error) {
      console.error('UI Error in AuthScreen.initializeManagers():', error);
      // Non bloccare l'esecuzione, continua con fallback minimo
    }
  }

  /**
   * Inizializza la schermata
   */
  private async init(): Promise<void> {
    try {
      this.initializeManagers();

      const hasJustLoggedIn = this.stateManager.hasJustLoggedIn();
      await this.initManager.initialize(this.sessionManager, hasJustLoggedIn);
    } catch (error) {
      console.error('UI Error in AuthScreen.init():', error);
      // Non bloccare l'esecuzione, continua senza inizializzazione completa
    }
  }

  /**
   * Imposta callback per quando l'utente è autenticato
   */
  setOnAuthenticated(callback: () => void): void {
    this.onAuthenticated = callback;
    if (this.managersInitialized && this.sessionManager) {
      // Update session manager with new callback
      this.sessionManager.setOnAuthenticated(callback);
    }
  }

  /**
   * Aggiorna il testo di loading
   */
  updateLoadingText(text: string): void {
    this.initializeManagers();
    this.initManager.updateLoadingText(text);
  }

  /**
   * Mostra un errore critico di connessione al server
   */
  showConnectionError(message: string, onRetry?: () => void): void {
    this.initializeManagers();

    // Cambia lo stato in error (o usa loading come fallback)
    if (this.stateManager && typeof this.stateManager.setState === 'function') {
      this.stateManager.setState('error'); // Se esiste lo stato error
    }

    // Aggiorna il testo con il messaggio di errore
    this.initManager.updateLoadingText(message);

    // Se fornito un callback di retry, mostra un pulsante o messaggio
    if (onRetry) {
      // Per ora usa alert come fallback, in futuro si può migliorare con un pulsante
      setTimeout(() => {
        if (confirm(message + '\n\nClick OK to refresh the page.')) {
          onRetry();
        }
      }, 100);
    } else {
      // Fallback senza retry
      setTimeout(() => {
        alert(message);
      }, 100);
    }
  }

  /**
   * Nasconde la schermata (chiamato quando i dati sono pronti)
   */
  hide(): void {
    this.initializeManagers();
    this.initManager.hide();
  }

  /**
   * Distrugge la schermata
   */
  destroy(): void {
    if (this.managersInitialized) {
      this.initManager.destroy();
    }
  }

  /**
   * Ottiene il nickname (se disponibile)
   */
  getNickname(): string {
    // Per ora restituiamo un valore di default, il nickname sarà gestito dal profilo utente
    return 'Player';
  }

  // ========== REMOVED METHODS - Now in managers ==========
  // All private methods have been extracted to managers:
  // - setState() -> AuthStateManager.setState()
  // - updateUI() -> AuthStateManager.updateUI()
  // - createUI() -> AuthUIRenderer.createUI()
  // - renderAuthForm() -> AuthFormManager.renderForm()
  // - createLoginForm() -> AuthFormManager.createLoginForm()
  // - createRegisterForm() -> AuthFormManager.createRegisterForm()
  // - handleLogin() -> AuthSessionManager.handleLogin()
  // - handleRegister() -> AuthSessionManager.handleRegister()
  // - checkExistingSession() -> AuthSessionManager.checkExistingSession()
  // - notifyAuthenticated() -> AuthSessionManager.notifyAuthenticated()
  // - isValidEmail() -> AuthValidationManager.isValidEmail()
  // - getFriendlyErrorMessage() -> AuthValidationManager.getFriendlyErrorMessage()
  // - showError() -> AuthValidationManager.showError()
  // - showSuccess() -> AuthValidationManager.showSuccess()
  // - showButtonLoading() -> AuthFormManager.showButtonLoading()
  // - addGlobalStyles() -> AuthUIRenderer.addGlobalStyles()
  // - createStarsBackground() -> AuthUIRenderer.createStarsBackground()
  // - init() -> AuthInitializationManager.initialize()
}
