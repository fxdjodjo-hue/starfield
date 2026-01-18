import { supabase } from '../../../../lib/supabase';
import { getApiBaseUrl } from '../../../../config/NetworkConfig';
import type { GameContext } from '../../../../infrastructure/engine/GameContext';
import { AuthState } from './AuthState';
import { AlphaDisclaimerModal } from './AlphaDisclaimerModal';

/**
 * Manages Supabase authentication (login, registration, sessions)
 */
export class AuthSessionManager {
  private onAuthenticatedCallback?: () => void;
  private readonly context: GameContext;
  private readonly setState: (state: AuthState) => void;
  private readonly updateLoadingText: (text: string) => void;
  private readonly showError: (message: string) => void;
  private readonly showSuccess: (message: string) => void;
  private readonly setJustLoggedIn: (loggedIn: boolean) => void;
  private readonly setProcessing: (processing: boolean) => void;
  private readonly showButtonLoading: (button: HTMLButtonElement, show: boolean) => void;
  private readonly isValidEmail: (email: string) => boolean;
  private readonly getFriendlyErrorMessage: (error: any) => string;
  private disclaimerModal: AlphaDisclaimerModal;

  constructor(
    context: GameContext,
    setState: (state: AuthState) => void,
    updateLoadingText: (text: string) => void,
    showError: (message: string) => void,
    showSuccess: (message: string) => void,
    setJustLoggedIn: (loggedIn: boolean) => void,
    setProcessing: (processing: boolean) => void,
    showButtonLoading: (button: HTMLButtonElement, show: boolean) => void,
    isValidEmail: (email: string) => boolean,
    getFriendlyErrorMessage: (error: any) => string,
    onAuthenticated?: () => void
  ) {
    this.context = context;
    this.setState = setState;
    this.updateLoadingText = updateLoadingText;
    this.showError = showError;
    this.showSuccess = showSuccess;
    this.setJustLoggedIn = setJustLoggedIn;
    this.setProcessing = setProcessing;
    this.showButtonLoading = showButtonLoading;
    this.isValidEmail = isValidEmail;
    this.getFriendlyErrorMessage = getFriendlyErrorMessage;
    this.onAuthenticatedCallback = onAuthenticated;
    this.disclaimerModal = new AlphaDisclaimerModal();
  }

  /**
   * Updates the authenticated callback
   */
  setOnAuthenticated(callback: () => void): void {
    this.onAuthenticatedCallback = callback;
  }

  /**
   * Salta il controllo della sessione esistente - sempre mostra login form
   */
  async checkExistingSession(): Promise<void> {
    this.setState(AuthState.LOGIN);
  }

  /**
   * Gestisce il login
   */
  async handleLogin(email: string, password: string, button: HTMLButtonElement): Promise<void> {
    // Validazione input
    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showError('Please enter a valid email address');
      return;
    }

    this.setProcessing(true);
    this.showButtonLoading(button, true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        
        // Segna che abbiamo appena fatto login per evitare controlli di sessione
        this.setJustLoggedIn(true);

        // Imposta ID e nickname nel context
        this.context.authId = data.user.id;
        this.context.localClientId = data.user.id;
        this.context.playerNickname = data.user.user_metadata?.display_name ||
                                     data.user.user_metadata?.username ||
                                     'Player'; // Fallback

        
        // NON chiamare setState(VERIFIED) qui - notifyAuthenticated() gestirà lo stato
        // Il container deve rimanere visibile per mostrare lo spinner
        
        this.notifyAuthenticated();
      }
    } catch (error: any) {
      console.error('❌ [AuthScreen] Login failed:', error);
      this.showError(this.getFriendlyErrorMessage(error));
    } finally {
      this.setProcessing(false);
      this.showButtonLoading(button, false);
    }
  }

  /**
   * Gestisce la registrazione
   */
  async handleRegister(email: string, password: string, confirmPassword: string, nickname: string, button: HTMLButtonElement): Promise<void> {
    // Validazione input
    if (!email || !password || !nickname) {
      this.showError('Please fill in all fields');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showError('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      this.showError('Password must be at least 6 characters');
      return;
    }

    if (nickname.length < 2) {
      this.showError('Nickname must be at least 2 characters');
      return;
    }

    this.setProcessing(true);
    this.showButtonLoading(button, true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: nickname,
            display_name: nickname
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        // CREA PROFILO NEL DATABASE - OBBLIGATORIO, NON OPZIONALE
        try {
          const { data: profileData, error: profileError } = await import('../../../../lib/supabase').then(m => m.gameAPI.createPlayerProfile(nickname));

          if (profileError) {
            console.error('❌ [AuthScreen] CRITICAL: Failed to create player profile:', profileError);
            this.showError('Account created but profile creation failed. Cannot proceed.');
            return;
          }

          if (!profileData || !profileData.success) {
            console.error('❌ [AuthScreen] CRITICAL: Profile creation returned error:', profileData?.error_message);
            this.showError('Profile creation failed: ' + (profileData?.error_message || 'Unknown error'));
            return;
          }

          // Verifica intelligente che il profilo sia disponibile (max 3 tentativi, backoff)
          let profileVerified = false;
          let attempts = 0;
          const maxAttempts = 3;

          while (!profileVerified && attempts < maxAttempts) {
            attempts++;
            try {
              // Quick verification call - usa endpoint esistente
              const response = await fetch(`${getApiBaseUrl()}/api/player-data/` + data.user.id, {
                headers: {
                  'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                }
              });

              if (response.ok) {
                profileVerified = true;
              } else {
                // Attesa progressiva: 100ms, 200ms, 300ms
                await new Promise(resolve => setTimeout(resolve, attempts * 100));
              }
            } catch (error) {
              // Profile check attempt failed - continue with backoff
              await new Promise(resolve => setTimeout(resolve, attempts * 100));
            }
          }

          if (!profileVerified) {
            // Profile verification timed out, proceeding anyway
          }

        } catch (profileError) {
          console.error('❌ [AuthScreen] CRITICAL: Exception during profile creation:', profileError);
          this.showError('Critical error during profile creation. Cannot proceed.');
          return;
        }

        // SOLO DOPO AVER CREATO IL PROFILO - permettiamo di giocare
        this.setJustLoggedIn(true);

        // Imposta ID e nickname nel context
        this.context.authId = data.user.id;
        this.context.localClientId = data.user.id;
        this.context.playerNickname = nickname; // Usiamo il nickname dal form

        if (data.user.email_confirmed_at) {
          // Email già confermata automaticamente
          // Mostra popup disclaimer prima di procedere
          this.showAlphaDisclaimer(() => {
            this.notifyAuthenticated();
          });
        } else {
          // Email da confermare
          this.showSuccess('Registration successful! Please check your email to confirm your account.');
        }
      }
    } catch (error: any) {
      console.error('❌ [AuthScreen] Registration failed:', error);
      this.showError(this.getFriendlyErrorMessage(error));
    } finally {
      this.setProcessing(false);
      this.showButtonLoading(button, false);
    }
  }

  /**
   * Mostra il popup disclaimer alpha
   */
  private showAlphaDisclaimer(onAccept: () => void): void {
    this.disclaimerModal.show(onAccept);
  }

  /**
   * Notifica che l'utente è stato autenticato
   * Mostra lo spinner e passa al gioco (PlayState aspetterà i dati)
   */
  notifyAuthenticated(): void {
    
    // Mostra lo spinner di loading
    this.setState(AuthState.LOADING);
    this.updateLoadingText('Connecting to server...');

    // Passa al gioco - PlayState aspetterà che i dati siano pronti
    if (this.onAuthenticatedCallback) {
      this.onAuthenticatedCallback();
    } else {
      console.warn('[AuthScreen] onAuthenticated callback non impostato!');
    }
  }
}
