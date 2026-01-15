import type { GameContext } from '../../infrastructure/engine/GameContext';
import { getFormattedVersion } from '../../utils/config/Version';
import { supabase } from '../../lib/supabase';

/**
 * Stati dell'autenticazione
 */
enum AuthState {
  LOADING = 'loading',         // Controllo sessione esistente
  LOGIN = 'login',            // Form login
  REGISTER = 'register',       // Form registrazione
  FORGOT_PASSWORD = 'forgot_password', // Recupero password
  VERIFIED = 'verified'        // Autenticato, può giocare
}

/**
 * Schermata di autenticazione per MMO
 * Gestisce login, registrazione e gestione sessioni
 */
export class AuthScreen {
  private context: GameContext;
  private canvas: HTMLCanvasElement;
  private onAuthenticated?: () => void;

  // Elementi DOM
  private container!: HTMLDivElement;
  private loadingContainer!: HTMLDivElement;
  private authContainer!: HTMLDivElement;
  private versionElement!: HTMLDivElement;

    // Stati
    private currentState: AuthState = AuthState.LOADING;
    private isProcessing: boolean = false;
    private justLoggedIn: boolean = false;

  constructor(context: GameContext) {
    this.context = context;
    this.canvas = context.canvas;

    // Aggiungi stili CSS globali
    this.addGlobalStyles();

    // Inizializza
    this.init();
  }

  /**
   * Inizializza la schermata
   */
  private async init(): Promise<void> {
    this.createUI();

    // Se abbiamo appena fatto login, salta il controllo della sessione esistente
    if (!this.justLoggedIn) {
      await this.checkExistingSession();
    } else {
      // NON chiamare setState(VERIFIED) - notifyAuthenticated() gestirà lo stato
      this.notifyAuthenticated();
    }
  }

  /**
   * Salta il controllo della sessione esistente - sempre mostra login form
   */
  private async checkExistingSession(): Promise<void> {
    this.setState(AuthState.LOGIN);
  }

  /**
   * Imposta lo stato corrente e aggiorna UI
   */
  private setState(state: AuthState): void {
    console.log(`[AuthScreen] setState(${state}) chiamato`);
    this.currentState = state;
    this.updateUI();
    console.log(`[AuthScreen] setState(${state}) completato`);
  }

  /**
   * Aggiorna l'interfaccia in base allo stato corrente
   */
  private updateUI(): void {
    console.log(`[AuthScreen] updateUI() chiamato, stato corrente: ${this.currentState}`);
    
    // Nascondi tutti i container
    this.loadingContainer.style.display = 'none';
    this.authContainer.style.display = 'none';

    // Mostra il container appropriato
    switch (this.currentState) {
      case AuthState.LOADING:
        console.log('[AuthScreen] Mostrando loadingContainer');
        this.loadingContainer.style.display = 'flex';
        break;
      case AuthState.LOGIN:
      case AuthState.REGISTER:
      case AuthState.FORGOT_PASSWORD:
        console.log('[AuthScreen] Mostrando authContainer');
        this.authContainer.style.display = 'flex';
        this.renderAuthForm();
        break;
      case AuthState.VERIFIED:
        // Giocatore autenticato, nascondi tutto
        console.log('[AuthScreen] Stato VERIFIED - nascondendo container');
        this.container.style.display = 'none';
        break;
    }
    
    console.log(`[AuthScreen] updateUI() completato, container.display: ${this.container.style.display}`);
  }

  /**
   * Crea l'interfaccia utente
   */
  private createUI(): void {
    // Container principale
    this.container = document.createElement('div');
    this.container.id = 'authscreen-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background:
        radial-gradient(circle at 20% 80%, rgba(20, 40, 80, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(40, 20, 60, 0.15) 0%, transparent 50%),
        linear-gradient(135deg, #000011 0%, #001122 50%, #000018 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    // Container loading
    this.loadingContainer = document.createElement('div');
    this.loadingContainer.style.cssText = `
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.9);
      text-align: center;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    const loadingTitle = document.createElement('h2');
    loadingTitle.textContent = 'STARFIELD MMO';
    loadingTitle.style.cssText = `
      color: #00ff88;
      font-size: 36px;
      margin: 0 0 20px 0;
      text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
      letter-spacing: 2px;
    `;

    const loadingText = document.createElement('p');
    loadingText.textContent = 'Loading...';
    loadingText.style.cssText = `
      font-size: 18px;
      margin: 20px 0;
      opacity: 0.8;
    `;

    const loadingSpinner = document.createElement('div');
    loadingSpinner.style.cssText = `
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      border-top-color: #00ff88;
      animation: spin 1s ease-in-out infinite;
      margin: 20px 0;
    `;

    this.loadingContainer.appendChild(loadingTitle);
    this.loadingContainer.appendChild(loadingText);
    this.loadingContainer.appendChild(loadingSpinner);

    // Container autenticazione
    this.authContainer = document.createElement('div');
    this.authContainer.style.cssText = `
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      max-width: 400px;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    // Versione
    this.versionElement = document.createElement('div');
    this.versionElement.className = 'authscreen-version';
    this.versionElement.textContent = `Version ${getFormattedVersion()}`;
    this.versionElement.style.cssText = `
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
      text-align: center;
      width: 100%;
      margin-top: 20px;
      opacity: 0;
    `;

    // Aggiungi stelle di sfondo
    this.createStarsBackground();

    // Assembla tutto
    this.container.appendChild(this.loadingContainer);
    this.container.appendChild(this.authContainer);
    this.container.appendChild(this.versionElement);

    // Aggiungi al DOM
    document.body.appendChild(this.container);
  }

  /**
   * Renderizza il form di autenticazione appropriato
   */
  private renderAuthForm(): void {
    // Rimuovi form esistente
    this.authContainer.innerHTML = '';

    const formContainer = document.createElement('div');
    formContainer.className = 'auth-form';
    formContainer.style.cssText = `
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 35px;
      border-radius: 25px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1),
        0 0 30px rgba(20, 40, 80, 0.15),
        0 0 50px rgba(40, 20, 60, 0.1);
      min-width: 320px;
      max-width: 420px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      opacity: 0;
      animation: fadeInUp 0.8s ease-out 0.2s both;
    `;

    // Titolo
    const title = document.createElement('h2');
    title.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      font-size: 28px;
      margin: 0 0 10px 0;
      text-align: center;
      letter-spacing: 1px;
    `;

    // Sottotitolo
    const subtitle = document.createElement('p');
    subtitle.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
      margin: 0 0 30px 0;
      text-align: center;
      line-height: 1.4;
    `;

    if (this.currentState === AuthState.LOGIN) {
      title.textContent = 'LOGIN';
      subtitle.textContent = 'Enter your credentials to continue';

      formContainer.appendChild(title);
      formContainer.appendChild(subtitle);
      formContainer.appendChild(this.createLoginForm());

      // Link per registrazione
      const registerLink = document.createElement('p');
      registerLink.innerHTML = `Don't have an account? <a href="#" id="switch-to-register" style="color: #00ff88; text-decoration: none;">Register here</a>`;
      registerLink.style.cssText = `
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
        margin: 20px 0 0 0;
        text-align: center;
      `;
      formContainer.appendChild(registerLink);

      // Event listener per switch a register
      setTimeout(() => {
        const link = document.getElementById('switch-to-register');
        if (link) {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            this.setState(AuthState.REGISTER);
          });
        }
      }, 100);

    } else if (this.currentState === AuthState.REGISTER) {
      title.textContent = 'REGISTER';
      subtitle.textContent = 'Create your account to join the MMO';

      formContainer.appendChild(title);
      formContainer.appendChild(subtitle);
      formContainer.appendChild(this.createRegisterForm());

      // Link per login
      const loginLink = document.createElement('p');
      loginLink.innerHTML = `Already have an account? <a href="#" id="switch-to-login" style="color: #00ff88; text-decoration: none;">Login here</a>`;
      loginLink.style.cssText = `
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
        margin: 20px 0 0 0;
        text-align: center;
      `;
      formContainer.appendChild(loginLink);

      // Event listener per switch a login
      setTimeout(() => {
        const link = document.getElementById('switch-to-login');
        if (link) {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            this.setState(AuthState.LOGIN);
          });
        }
      }, 100);
    }

    this.authContainer.appendChild(formContainer);
  }

  /**
   * Crea il form di login
   */
  private createLoginForm(): HTMLDivElement {
    const form = document.createElement('div');
    form.style.cssText = 'width: 100%;';

    // Email input
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'EMAIL';
    emailLabel.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1px;
    `;

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'your@email.com';
    emailInput.required = true;
    emailInput.style.cssText = `
      width: 100%;
      padding: 15px 20px;
      margin-bottom: 20px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 15px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: #ffffff;
      font-size: 16px;
      font-family: 'Segoe UI', sans-serif;
      box-sizing: border-box;
      outline: none;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    `;

    // Focus effects
    emailInput.addEventListener('focus', () => {
      emailInput.style.borderColor = 'rgba(40, 60, 100, 0.6)';
      emailInput.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 20px rgba(20, 40, 80, 0.3)';
    });

    emailInput.addEventListener('blur', () => {
      emailInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      emailInput.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1)';
    });

    // Password input
    const passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'PASSWORD';
    passwordLabel.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1px;
    `;

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Your password';
    passwordInput.required = true;
    passwordInput.minLength = 6;
    passwordInput.style.cssText = emailInput.style.cssText; // Stesso stile
    passwordInput.style.marginBottom = '30px';

    // Focus effects
    passwordInput.addEventListener('focus', () => {
      passwordInput.style.borderColor = 'rgba(40, 60, 100, 0.6)';
      passwordInput.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 20px rgba(20, 40, 80, 0.3)';
    });

    passwordInput.addEventListener('blur', () => {
      passwordInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      passwordInput.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1)';
    });

    // Pulsante login
    const loginButton = document.createElement('button');
    loginButton.innerHTML = '<span class="button-text">LOGIN</span><div class="loading-spinner" style="display: none;"></div>';
    loginButton.style.cssText = `
      width: 100%;
      padding: 18px 30px;
      background: linear-gradient(135deg, rgba(20, 40, 80, 0.25), rgba(40, 20, 60, 0.25));
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 15px;
      color: #ffffff;
      font-size: 16px;
      font-weight: 600;
      font-family: 'Segoe UI', sans-serif;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      letter-spacing: 1px;
      text-transform: uppercase;
      box-shadow:
        0 4px 15px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      position: relative;
      overflow: hidden;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;

    // Eventi pulsante
    loginButton.addEventListener('click', () => this.handleLogin(emailInput.value, passwordInput.value, loginButton));
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleLogin(emailInput.value, passwordInput.value, loginButton);
      }
    });

    // Hover effects
    loginButton.addEventListener('mouseenter', () => {
      if (!this.isProcessing) {
        loginButton.style.transform = 'translateY(-2px)';
        loginButton.style.boxShadow = `
          0 8px 25px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.2),
          0 0 30px rgba(20, 40, 80, 0.4),
          0 0 50px rgba(40, 20, 60, 0.3)
        `;
        loginButton.style.borderColor = 'rgba(40, 60, 100, 0.5)';
      }
    });

    loginButton.addEventListener('mouseleave', () => {
      if (!this.isProcessing) {
        loginButton.style.transform = 'translateY(0)';
        loginButton.style.boxShadow = `
          0 4px 15px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `;
        loginButton.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      }
    });

    // Forgot password link
    const forgotLink = document.createElement('p');
    forgotLink.innerHTML = `<a href="#" id="forgot-password" style="color: rgba(255, 255, 255, 0.5); text-decoration: none; font-size: 12px;">Forgot password?</a>`;
    forgotLink.style.cssText = 'text-align: center; margin: 10px 0;';

    // Assembla form
    form.appendChild(emailLabel);
    form.appendChild(emailInput);
    form.appendChild(passwordLabel);
    form.appendChild(passwordInput);
    form.appendChild(loginButton);
    form.appendChild(forgotLink);

    // Event listener per forgot password
    setTimeout(() => {
      const link = document.getElementById('forgot-password');
      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.setState(AuthState.FORGOT_PASSWORD);
        });
      }
    }, 100);

    return form;
  }

  /**
   * Crea il form di registrazione
   */
  private createRegisterForm(): HTMLDivElement {
    const form = document.createElement('div');
    form.style.cssText = 'width: 100%;';

    // Email input
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'EMAIL';
    emailLabel.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1px;
    `;

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'your@email.com';
    emailInput.required = true;
    emailInput.style.cssText = `
      width: 100%;
      padding: 15px 20px;
      margin-bottom: 20px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 15px;
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      color: #ffffff;
      font-size: 16px;
      font-family: 'Segoe UI', sans-serif;
      box-sizing: border-box;
      outline: none;
      transition: all 0.3s ease;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    `;

    // Password input
    const passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'PASSWORD';
    passwordLabel.style.cssText = emailLabel.style.cssText;

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Choose a strong password';
    passwordInput.required = true;
    passwordInput.minLength = 6;
    passwordInput.style.cssText = emailInput.style.cssText;

    // Confirm password input
    const confirmLabel = document.createElement('label');
    confirmLabel.textContent = 'CONFIRM PASSWORD';
    confirmLabel.style.cssText = emailLabel.style.cssText;

    const confirmInput = document.createElement('input');
    confirmInput.type = 'password';
    confirmInput.placeholder = 'Repeat your password';
    confirmInput.required = true;
    confirmInput.minLength = 6;
    confirmInput.style.cssText = emailInput.style.cssText;

    // Nickname input
    const nicknameLabel = document.createElement('label');
    nicknameLabel.textContent = 'NICKNAME';
    nicknameLabel.style.cssText = emailLabel.style.cssText;

    const nicknameInput = document.createElement('input');
    nicknameInput.type = 'text';
    nicknameInput.placeholder = 'Your display name';
    nicknameInput.required = true;
    nicknameInput.maxLength = 20;
    nicknameInput.style.cssText = emailInput.style.cssText;
    nicknameInput.style.marginBottom = '30px';

    // Focus effects per tutti gli input
    [emailInput, passwordInput, confirmInput, nicknameInput].forEach(input => {
      input.addEventListener('focus', () => {
        input.style.borderColor = 'rgba(40, 60, 100, 0.6)';
        input.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 20px rgba(20, 40, 80, 0.3)';
      });

      input.addEventListener('blur', () => {
        input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        input.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.1)';
      });
    });

    // Pulsante register
    const registerButton = document.createElement('button');
    registerButton.innerHTML = '<span class="button-text">REGISTER</span><div class="loading-spinner" style="display: none;"></div>';
    registerButton.style.cssText = `
      width: 100%;
      padding: 18px 30px;
      background: linear-gradient(135deg, rgba(0, 255, 136, 0.25), rgba(0, 136, 255, 0.25));
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 255, 136, 0.3);
      border-radius: 15px;
      color: #ffffff;
      font-size: 16px;
      font-weight: 600;
      font-family: 'Segoe UI', sans-serif;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      letter-spacing: 1px;
      text-transform: uppercase;
      box-shadow:
        0 4px 15px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      position: relative;
      overflow: hidden;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;

    // Eventi pulsante
    registerButton.addEventListener('click', () => this.handleRegister(
      emailInput.value,
      passwordInput.value,
      confirmInput.value,
      nicknameInput.value,
      registerButton
    ));

    // Hover effects
    registerButton.addEventListener('mouseenter', () => {
      if (!this.isProcessing) {
        registerButton.style.transform = 'translateY(-2px)';
        registerButton.style.boxShadow = `
          0 8px 25px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.2),
          0 0 30px rgba(0, 255, 136, 0.4),
          0 0 50px rgba(0, 136, 255, 0.3)
        `;
        registerButton.style.borderColor = 'rgba(0, 255, 136, 0.5)';
      }
    });

    registerButton.addEventListener('mouseleave', () => {
      if (!this.isProcessing) {
        registerButton.style.transform = 'translateY(0)';
        registerButton.style.boxShadow = `
          0 4px 15px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `;
        registerButton.style.borderColor = 'rgba(0, 255, 136, 0.3)';
      }
    });

    // Assembla form
    form.appendChild(emailLabel);
    form.appendChild(emailInput);
    form.appendChild(passwordLabel);
    form.appendChild(passwordInput);
    form.appendChild(confirmLabel);
    form.appendChild(confirmInput);
    form.appendChild(nicknameLabel);
    form.appendChild(nicknameInput);
    form.appendChild(registerButton);

    return form;
  }

  /**
   * Gestisce il login
   */
  private async handleLogin(email: string, password: string, button: HTMLButtonElement): Promise<void> {
    if (this.isProcessing) return;

    // Validazione input
    if (!email || !password) {
      this.showError('Please fill in all fields');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showError('Please enter a valid email address');
      return;
    }

    this.isProcessing = true;
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
        console.log('[AuthScreen] Login riuscito, user:', data.user.id);
        
        // Segna che abbiamo appena fatto login per evitare controlli di sessione
        this.justLoggedIn = true;

        // Imposta ID e nickname nel context
        this.context.authId = data.user.id;
        this.context.localClientId = data.user.id;
        this.context.playerNickname = data.user.user_metadata?.display_name ||
                                     data.user.user_metadata?.username ||
                                     'Player'; // Fallback

        console.log('[AuthScreen] Impostato authId:', this.context.authId);
        console.log('[AuthScreen] Impostato nickname:', this.context.playerNickname);
        
        // NON chiamare setState(VERIFIED) qui - notifyAuthenticated() gestirà lo stato
        // Il container deve rimanere visibile per mostrare lo spinner
        
        console.log('[AuthScreen] Chiamando notifyAuthenticated()...');
        this.notifyAuthenticated();
        console.log('[AuthScreen] notifyAuthenticated() completato');
      }
    } catch (error: any) {
      console.error('❌ [AuthScreen] Login failed:', error);
      this.showError(this.getFriendlyErrorMessage(error));
    } finally {
      this.isProcessing = false;
      this.showButtonLoading(button, false);
    }
  }

  /**
   * Gestisce la registrazione
   */
  private async handleRegister(email: string, password: string, confirmPassword: string, nickname: string, button: HTMLButtonElement): Promise<void> {
    if (this.isProcessing) return;

    // Validazione input
    if (!email || !password || !confirmPassword || !nickname) {
      this.showError('Please fill in all fields');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showError('Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      this.showError('Passwords do not match');
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

    this.isProcessing = true;
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
          const { data: profileData, error: profileError } = await import('../../lib/supabase').then(m => m.gameAPI.createPlayerProfile(nickname));

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
              const response = await fetch('http://localhost:3000/api/player-data/' + data.user.id, {
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
        this.justLoggedIn = true;

        // Imposta ID e nickname nel context
        this.context.authId = data.user.id;
        this.context.localClientId = data.user.id;
        this.context.playerNickname = nickname; // Usiamo il nickname dal form

        if (data.user.email_confirmed_at) {
          // Email già confermata automaticamente
          // NON chiamare setState(VERIFIED) - notifyAuthenticated() gestirà lo stato
          this.notifyAuthenticated();
        } else {
          // Email da confermare
          this.showSuccess('Registration successful! Please check your email to confirm your account.');
        }
      }
    } catch (error: any) {
      console.error('❌ [AuthScreen] Registration failed:', error);
      this.showError(this.getFriendlyErrorMessage(error));
    } finally {
      this.isProcessing = false;
      this.showButtonLoading(button, false);
    }
  }

  /**
   * Converte errori tecnici in messaggi user-friendly
   */
  private getFriendlyErrorMessage(error: any): string {
    const message = error.message || '';

    if (message.includes('Invalid login credentials')) {
      return 'Invalid email or password';
    }
    if (message.includes('User already registered')) {
      return 'An account with this email already exists';
    }
    if (message.includes('Password should be at least')) {
      return 'Password must be at least 6 characters';
    }
    if (message.includes('Unable to validate email address')) {
      return 'Please enter a valid email address';
    }
    if (message.includes('Email not confirmed')) {
      return 'Please check your email and confirm your account';
    }

    return 'An error occurred. Please try again.';
  }

  /**
   * Valida formato email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Mostra errore all'utente
   */
  private showError(message: string): void {
    // Rimuovi errori esistenti
    const existingError = document.querySelector('.auth-error');
    if (existingError) {
      existingError.remove();
    }

    // Crea nuovo messaggio errore
    const errorDiv = document.createElement('div');
    errorDiv.className = 'auth-error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      background: rgba(255, 0, 0, 0.1);
      border: 1px solid rgba(255, 0, 0, 0.3);
      border-radius: 10px;
      padding: 15px;
      margin: 15px 0;
      color: #ff6b6b;
      font-size: 14px;
      text-align: center;
      animation: fadeIn 0.3s ease-out;
    `;

    // Inserisci dopo il form
    const form = this.authContainer.querySelector('.auth-form');
    if (form) {
      form.appendChild(errorDiv);
    }

    // Rimuovi automaticamente dopo 5 secondi
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 5000);
  }

  /**
   * Mostra messaggio successo
   */
  private showSuccess(message: string): void {
    // Rimuovi messaggi esistenti
    const existingMessage = document.querySelector('.auth-success');
    if (existingMessage) {
      existingMessage.remove();
    }

    // Crea nuovo messaggio successo
    const successDiv = document.createElement('div');
    successDiv.className = 'auth-success';
    successDiv.textContent = message;
    successDiv.style.cssText = `
      background: rgba(0, 255, 136, 0.1);
      border: 1px solid rgba(0, 255, 136, 0.3);
      border-radius: 10px;
      padding: 15px;
      margin: 15px 0;
      color: #00ff88;
      font-size: 14px;
      text-align: center;
      animation: fadeIn 0.3s ease-out;
    `;

    // Inserisci dopo il form
    const form = this.authContainer.querySelector('.auth-form');
    if (form) {
      form.appendChild(successDiv);
    }

    // Rimuovi automaticamente dopo 8 secondi
    setTimeout(() => {
      if (successDiv.parentNode) {
        successDiv.remove();
      }
    }, 8000);
  }

  /**
   * Mostra/nasconde loading sul pulsante
   */
  private showButtonLoading(button: HTMLButtonElement, show: boolean): void {
    const buttonText = button.querySelector('.button-text') as HTMLElement;
    const spinner = button.querySelector('.loading-spinner') as HTMLElement;

    if (show) {
      button.disabled = true;
      button.style.cursor = 'not-allowed';
      buttonText.style.display = 'none';
      spinner.style.display = 'block';
    } else {
      button.disabled = false;
      button.style.cursor = 'pointer';
      buttonText.style.display = 'block';
      spinner.style.display = 'none';
    }
  }

  /**
   * Aggiunge stili CSS globali
   */
  private addGlobalStyles(): void {
    const existingStyle = document.getElementById('authscreen-styles');
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = 'authscreen-styles';
    style.textContent = `
      @keyframes fadeInUp {
        0% {
          opacity: 0;
          transform: translateY(30px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fadeIn {
        0% {
          opacity: 0;
        }
        100% {
          opacity: 1;
        }
      }

      @keyframes starTwinkle {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.2); }
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .star-particle {
        position: absolute;
        background: #ffffff;
        border-radius: 50%;
        pointer-events: none;
        animation: starTwinkle 4s ease-in-out infinite;
      }

      .star-particle:nth-child(odd) {
        animation-delay: -2s;
      }

      .star-particle:nth-child(3n) {
        animation-duration: 6s;
      }

      .authscreen-version {
        animation: fadeInUp 1.5s ease-out 1.5s both;
      }

      .loading-spinner {
        display: block;
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #ffffff;
        animation: spin 1s ease-in-out infinite;
        flex-shrink: 0;
      }

      /* Disabilita selezione testo in tutta la schermata */
      #authscreen-container * {
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
      }

      /* Permetti selezione solo per input fields */
      #authscreen-container input {
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Crea stelle di sfondo per atmosfera spaziale
   */
  private createStarsBackground(): void {
    const starCount = 50;

    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      star.className = 'star-particle';

      // Posizione casuale
      const x = Math.random() * 100;
      const y = Math.random() * 100;

      // Dimensione casuale (più piccole per essere rilassanti)
      const size = Math.random() * 2 + 1;

      star.style.cssText = `
        left: ${x}%;
        top: ${y}%;
        width: ${size}px;
        height: ${size}px;
        animation-delay: ${Math.random() * 4}s;
      `;

      this.container.appendChild(star);
    }
  }

  /**
   * Imposta callback per quando l'utente è autenticato
   */
  setOnAuthenticated(callback: () => void): void {
    this.onAuthenticated = callback;
  }

  /**
   * Notifica che l'utente è stato autenticato
   * Mostra lo spinner e passa al gioco (PlayState aspetterà i dati)
   */
  private notifyAuthenticated(): void {
    console.log('[AuthScreen] notifyAuthenticated() chiamato');
    
    // Assicurati che il container sia visibile prima di mostrare lo spinner
    if (this.container.style.display === 'none') {
      console.log('[AuthScreen] Container nascosto, mostrandolo...');
      this.container.style.display = 'flex';
    }
    
    // Mostra lo spinner di loading
    console.log('[AuthScreen] Cambiando stato a LOADING...');
    this.setState(AuthState.LOADING);
    this.updateLoadingText('Connecting to server...');
    console.log('[AuthScreen] Spinner mostrato, testo: "Connecting to server..."');

    // Passa al gioco - PlayState aspetterà che i dati siano pronti
    if (this.onAuthenticated) {
      console.log('[AuthScreen] Chiamando onAuthenticated callback...');
      this.onAuthenticated();
      console.log('[AuthScreen] onAuthenticated callback completato');
    } else {
      console.warn('[AuthScreen] onAuthenticated callback non impostato!');
    }
  }

  /**
   * Aggiorna il testo di loading
   */
  updateLoadingText(text: string): void {
    console.log(`[AuthScreen] updateLoadingText("${text}")`);
    const loadingText = this.loadingContainer.querySelector('p');
    if (loadingText) {
      loadingText.textContent = text;
      console.log(`[AuthScreen] Testo aggiornato con successo`);
    } else {
      console.warn('[AuthScreen] loadingText element non trovato!');
    }
  }

  /**
   * Nasconde la schermata (chiamato quando i dati sono pronti)
   */
  hide(): void {
    console.log('[AuthScreen] hide() chiamato - nascondendo schermata');
    this.container.style.display = 'none';
    console.log('[AuthScreen] Schermata nascosta');
  }

  /**
   * Distrugge la schermata
   */
  destroy(): void {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    // Rimuovi stili
    const style = document.getElementById('authscreen-styles');
    if (style) {
      style.remove();
    }
  }

  /**
   * Ottiene il nickname (se disponibile)
   */
  getNickname(): string {
    // Per ora restituiamo un valore di default, il nickname sarà gestito dal profilo utente
    return 'Player';
  }
}