import { AuthState } from './AuthState';

/**
 * Manages authentication state and UI transitions
 */
export class AuthStateManager {
  private currentState: AuthState = AuthState.LOADING;
  private isProcessing: boolean = false;
  private justLoggedIn: boolean = false;
  private readonly container: HTMLElement;
  private readonly loadingContainer: HTMLElement;
  private readonly authContainer: HTMLElement;
  private readonly renderAuthForm: (() => void) | null;
  private readonly showDiscordIcon?: () => void;
  private readonly hideDiscordIcon?: () => void;

  constructor(
    container: HTMLElement,
    loadingContainer: HTMLElement,
    authContainer: HTMLElement,
    renderAuthForm: (() => void) | null,
    showDiscordIcon?: () => void,
    hideDiscordIcon?: () => void
  ) {
    this.container = container;
    this.loadingContainer = loadingContainer;
    this.authContainer = authContainer;
    this.renderAuthForm = renderAuthForm;
    this.showDiscordIcon = showDiscordIcon;
    this.hideDiscordIcon = hideDiscordIcon;
  }

  /**
   * Imposta lo stato corrente e aggiorna UI
   */
  setState(state: AuthState): void {
    this.currentState = state;
    this.updateUI();
  }

  /**
   * Aggiorna l'interfaccia in base allo stato corrente
   */
  private updateUI(): void {
    
    // Nascondi tutti i container
    this.loadingContainer.style.display = 'none';
    this.authContainer.style.display = 'none';

    // Mostra il container appropriato
    switch (this.currentState) {
      case AuthState.LOADING:
        this.loadingContainer.style.display = 'flex';
        // Nascondi icona Discord durante il caricamento
        if (this.hideDiscordIcon) {
          this.hideDiscordIcon();
        }
        break;
      case AuthState.LOGIN:
      case AuthState.REGISTER:
      case AuthState.FORGOT_PASSWORD:
        this.authContainer.style.display = 'flex';
        // Mostra icona Discord solo durante login/register
        if (this.showDiscordIcon) {
          this.showDiscordIcon();
        }
        if (this.renderAuthForm) {
          this.renderAuthForm();
        }
        break;
      case AuthState.VERIFIED:
        // Giocatore autenticato, nascondi tutto
        this.container.style.display = 'none';
        // Nascondi icona Discord quando autenticato
        if (this.hideDiscordIcon) {
          this.hideDiscordIcon();
        }
        break;
    }
    
  }

  /**
   * Gets the current state
   */
  getCurrentState(): AuthState {
    return this.currentState;
  }

  /**
   * Checks if processing
   */
  isProcessingRequest(): boolean {
    return this.isProcessing;
  }

  /**
   * Sets processing state
   */
  setProcessing(processing: boolean): void {
    this.isProcessing = processing;
  }

  /**
   * Checks if just logged in
   */
  hasJustLoggedIn(): boolean {
    return this.justLoggedIn;
  }

  /**
   * Sets just logged in flag
   */
  setJustLoggedIn(loggedIn: boolean): void {
    this.justLoggedIn = loggedIn;
  }
}
