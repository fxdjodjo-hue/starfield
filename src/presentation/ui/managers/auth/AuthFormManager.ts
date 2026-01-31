import { AuthState } from './AuthState';

/**
 * Manages form creation and rendering (login, register)
 * Modern, minimal design with smooth animations
 */
export class AuthFormManager {
  private readonly authContainer: HTMLElement;
  private readonly getCurrentState: () => AuthState;
  private readonly isProcessing: () => boolean;
  private readonly handleLogin: (email: string, password: string, button: HTMLButtonElement) => Promise<void>;
  private readonly handleRegister: (email: string, password: string, confirmPassword: string, nickname: string, button: HTMLButtonElement) => Promise<void>;
  private readonly setState: (state: AuthState) => void;
  private readonly onPlayClickSound?: () => void;
  private feedbackElement?: HTMLDivElement;

  constructor(
    authContainer: HTMLElement,
    getCurrentState: () => AuthState,
    isProcessing: () => boolean,
    handleLogin: (email: string, password: string, button: HTMLButtonElement) => Promise<void>,
    handleRegister: (email: string, password: string, confirmPassword: string, nickname: string, button: HTMLButtonElement) => Promise<void>,
    setState: (state: AuthState) => void,
    showButtonLoading: (button: HTMLButtonElement, show: boolean) => void,
    onPlayClickSound?: () => void
  ) {
    this.authContainer = authContainer;
    this.getCurrentState = getCurrentState;
    this.isProcessing = isProcessing;
    this.handleLogin = handleLogin;
    this.handleRegister = handleRegister;
    this.setState = setState;
    this.onPlayClickSound = onPlayClickSound;
  }

  /**
   * Renderizza il form di autenticazione appropriato
   */
  renderForm(): void {
    // Rimuovi form esistente
    this.authContainer.innerHTML = '';
    this.feedbackElement = undefined;

    // Form container - trasparente, flotta sul video
    const formContainer = document.createElement('div');
    formContainer.className = 'auth-form-card';
    formContainer.style.cssText = `
      background: transparent;
      padding: 48px 40px;
      min-width: 320px;
      max-width: 380px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      position: relative;
      opacity: 0;
      transform: translateY(20px);
      animation: cardAppear 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
    `;

    // Titolo
    const title = document.createElement('h2');
    title.style.cssText = `
      color: rgba(255, 255, 255, 0.95);
      font-size: 24px;
      margin: 0 0 8px 0;
      text-align: center;
      font-weight: 900;
      letter-spacing: 4px;
    `;

    // Sottotitolo
    const subtitle = document.createElement('p');
    subtitle.style.cssText = `
      color: rgba(255, 255, 255, 0.4);
      font-size: 11px;
      margin: 0 0 32px 0;
      text-align: center;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
    `;

    const currentState = this.getCurrentState();

    if (currentState === AuthState.LOGIN) {
      // Logo only
      const logoContainer = document.createElement('div');
      logoContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 32px;
      `;

      const logo = document.createElement('img');
      logo.src = 'assets/logo/starspacelogo.png';
      logo.alt = 'Starspace';
      logo.style.cssText = `
        width: 140px;
        height: auto;
        filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.2));
      `;

      logoContainer.appendChild(logo);

      formContainer.appendChild(logoContainer);
      formContainer.appendChild(this.createLoginForm());

      // Link per registrazione
      const registerLink = document.createElement('p');
      registerLink.className = 'auth-switch-link';
      registerLink.innerHTML = `Don't have an account? <a href="#" id="switch-to-register">Sign up</a>`;
      registerLink.style.cssText = `
        color: rgba(255, 255, 255, 0.4);
        font-size: 13px;
        margin: 24px 0 0 0;
        text-align: center;
        font-weight: 300;
      `;
      formContainer.appendChild(registerLink);

      setTimeout(() => {
        const link = document.getElementById('switch-to-register');
        if (link) {
          link.style.cssText = 'color: rgba(255, 255, 255, 0.7); text-decoration: none; transition: color 0.2s;';
          link.addEventListener('mouseenter', () => {
            link.style.color = 'rgba(255, 255, 255, 0.9)';
          });
          link.addEventListener('mouseleave', () => {
            link.style.color = 'rgba(255, 255, 255, 0.7)';
          });
          link.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.onPlayClickSound) this.onPlayClickSound();
            this.setState(AuthState.REGISTER);
          });
        }
      }, 100);

    } else if (currentState === AuthState.REGISTER) {
      // Logo only
      const logoContainer = document.createElement('div');
      logoContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 32px;
      `;

      const logo = document.createElement('img');
      logo.src = 'assets/logo/starspacelogo.png';
      logo.alt = 'Starspace';
      logo.style.cssText = `
        width: 140px;
        height: auto;
        filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.2));
      `;

      logoContainer.appendChild(logo);

      formContainer.appendChild(logoContainer);
      formContainer.appendChild(this.createRegisterForm());

      // Link per login
      const loginLink = document.createElement('p');
      loginLink.className = 'auth-switch-link';
      loginLink.innerHTML = `Already have an account? <a href="#" id="switch-to-login">Sign in</a>`;
      loginLink.style.cssText = `
        color: rgba(255, 255, 255, 0.4);
        font-size: 13px;
        margin: 24px 0 0 0;
        text-align: center;
        font-weight: 300;
      `;
      formContainer.appendChild(loginLink);

      setTimeout(() => {
        const link = document.getElementById('switch-to-login');
        if (link) {
          link.style.cssText = 'color: rgba(255, 255, 255, 0.7); text-decoration: none; transition: color 0.2s;';
          link.addEventListener('mouseenter', () => {
            link.style.color = 'rgba(255, 255, 255, 0.9)';
          });
          link.addEventListener('mouseleave', () => {
            link.style.color = 'rgba(255, 255, 255, 0.7)';
          });
          link.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.onPlayClickSound) this.onPlayClickSound();
            this.setState(AuthState.LOGIN);
          });
        }
      }, 100);

    } else if (currentState === AuthState.FORGOT_PASSWORD) {
      title.textContent = 'FORGOT PASSWORD';
      subtitle.textContent = 'Password recovery';

      // Messaggio per aprire ticket su Discord
      const messageContainer = document.createElement('div');
      messageContainer.style.cssText = `
        width: 100%;
        text-align: center;
        margin: 20px 0;
      `;

      const messageText = document.createElement('p');
      messageText.textContent = 'To recover your password, please open a ticket on our Discord server.';
      messageText.style.cssText = `
        color: rgba(255, 255, 255, 0.7);
        font-size: 14px;
        margin: 0 0 24px 0;
        line-height: 1.6;
        font-weight: 300;
      `;

      const discordLink = document.createElement('a');
      discordLink.href = 'https://discord.gg/eCa927g2mm';
      discordLink.target = '_blank';
      discordLink.rel = 'noopener noreferrer';
      discordLink.textContent = 'Open Discord';
      discordLink.style.cssText = `
        display: inline-block;
        padding: 14px 32px;
        background: rgba(88, 101, 242, 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(88, 101, 242, 0.4);
        border-radius: 12px;
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        letter-spacing: 0.5px;
      `;

      discordLink.addEventListener('mouseenter', () => {
        discordLink.style.background = 'rgba(88, 101, 242, 0.3)';
        discordLink.style.borderColor = 'rgba(88, 101, 242, 0.6)';
        discordLink.style.transform = 'translateY(-2px)';
        discordLink.style.boxShadow = '0 6px 20px rgba(88, 101, 242, 0.3)';
      });

      discordLink.addEventListener('mouseleave', () => {
        discordLink.style.background = 'rgba(88, 101, 242, 0.2)';
        discordLink.style.borderColor = 'rgba(88, 101, 242, 0.4)';
        discordLink.style.transform = 'translateY(0)';
        discordLink.style.boxShadow = 'none';
      });

      messageContainer.appendChild(messageText);
      messageContainer.appendChild(discordLink);

      formContainer.appendChild(title);
      formContainer.appendChild(subtitle);
      formContainer.appendChild(messageContainer);

      // Link per tornare al login
      const backLink = document.createElement('p');
      backLink.className = 'auth-switch-link';
      backLink.innerHTML = `<a href="#" id="switch-to-login">Back to login</a>`;
      backLink.style.cssText = `
        color: rgba(255, 255, 255, 0.4);
        font-size: 13px;
        margin: 32px 0 0 0;
        text-align: center;
        font-weight: 300;
      `;
      formContainer.appendChild(backLink);

      setTimeout(() => {
        const link = document.getElementById('switch-to-login');
        if (link) {
          link.style.cssText = 'color: rgba(255, 255, 255, 0.7); text-decoration: none; transition: color 0.2s;';
          link.addEventListener('mouseenter', () => {
            link.style.color = 'rgba(255, 255, 255, 0.9)';
          });
          link.addEventListener('mouseleave', () => {
            link.style.color = 'rgba(255, 255, 255, 0.7)';
          });
          link.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.onPlayClickSound) this.onPlayClickSound();
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
  createLoginForm(): HTMLDivElement {
    const form = document.createElement('div');
    form.style.cssText = 'width: 100%;';

    // Email input
    const emailGroup = document.createElement('div');
    emailGroup.style.cssText = 'margin-bottom: 20px;';

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'Email';
    emailInput.required = true;

    // Tenta di recuperare l'ultima email usata dall'utente (se salvata localmente)
    import('../../../../lib/SupabaseClient').then(async ({ supabase }) => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.email) {
        emailInput.value = data.session.user.email;
      }
    });

    emailInput.style.cssText = this.getInputStyle();
    emailInput.addEventListener('focus', () => this.handleInputFocus(emailInput));
    emailInput.addEventListener('blur', () => this.handleInputBlur(emailInput));

    // Password input
    const passwordGroup = document.createElement('div');
    passwordGroup.style.cssText = 'margin-bottom: 28px;';

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Password';
    passwordInput.required = true;
    passwordInput.minLength = 6;
    passwordInput.style.cssText = this.getInputStyle();
    passwordInput.addEventListener('focus', () => this.handleInputFocus(passwordInput));
    passwordInput.addEventListener('blur', () => this.handleInputBlur(passwordInput));

    // Feedback container
    this.feedbackElement = document.createElement('div');
    this.feedbackElement.className = 'auth-feedback-message';
    this.feedbackElement.style.cssText = `
      font-size: 12px;
      margin: -20px 0 20px 0;
      padding: 12px;
      text-align: center;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      min-height: 0;
      border-radius: 2px;
    `;

    // Pulsante login - moderno e animato
    const loginButton = document.createElement('button');
    loginButton.className = 'auth-submit-button';
    loginButton.innerHTML = '<span class="button-text">LOGIN</span><div class="loading-spinner" style="display: none;"></div>';
    loginButton.style.cssText = this.getButtonStyle();

    // Eventi pulsante
    const handleSubmit = () => {
      this.handleLogin(emailInput.value, passwordInput.value, loginButton);
    };

    loginButton.addEventListener('click', handleSubmit);
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });

    // Animazioni hover e click
    this.setupButtonAnimations(loginButton);

    // Forgot password link
    const forgotLink = document.createElement('p');
    forgotLink.style.cssText = `
      text-align: center;
      margin: 16px 0 0 0;
    `;
    const forgotAnchor = document.createElement('a');
    forgotAnchor.href = '#';
    forgotAnchor.id = 'forgot-password';
    forgotAnchor.textContent = 'Forgot password?';
    forgotAnchor.style.cssText = `
      color: rgba(255, 255, 255, 0.4);
      text-decoration: none;
      font-size: 12px;
      font-weight: 300;
      transition: color 0.2s;
    `;
    forgotAnchor.addEventListener('mouseenter', () => {
      forgotAnchor.style.color = 'rgba(255, 255, 255, 0.7)';
    });
    forgotAnchor.addEventListener('mouseleave', () => {
      forgotAnchor.style.color = 'rgba(255, 255, 255, 0.4)';
    });
    forgotAnchor.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.onPlayClickSound) this.onPlayClickSound();
      this.setState(AuthState.FORGOT_PASSWORD);
    });
    forgotLink.appendChild(forgotAnchor);

    // Assembla form
    emailGroup.appendChild(emailInput);
    passwordGroup.appendChild(passwordInput);
    form.appendChild(emailGroup);
    form.appendChild(passwordGroup);
    form.appendChild(this.feedbackElement);
    form.appendChild(loginButton);
    form.appendChild(forgotLink);

    return form;
  }

  /**
   * Crea il form di registrazione
   */
  createRegisterForm(): HTMLDivElement {
    const form = document.createElement('div');
    form.style.cssText = 'width: 100%;';

    // Email
    const emailGroup = document.createElement('div');
    emailGroup.style.cssText = 'margin-bottom: 20px;';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'Email';
    emailInput.required = true;
    emailInput.style.cssText = this.getInputStyle();
    emailInput.addEventListener('focus', () => this.handleInputFocus(emailInput));
    emailInput.addEventListener('blur', () => this.handleInputBlur(emailInput));

    // Password
    const passwordGroup = document.createElement('div');
    passwordGroup.style.cssText = 'margin-bottom: 20px;';
    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.placeholder = 'Password';
    passwordInput.required = true;
    passwordInput.minLength = 6;
    passwordInput.style.cssText = this.getInputStyle();
    passwordInput.addEventListener('focus', () => this.handleInputFocus(passwordInput));
    passwordInput.addEventListener('blur', () => this.handleInputBlur(passwordInput));

    // Nickname
    const nicknameGroup = document.createElement('div');
    nicknameGroup.style.cssText = 'margin-bottom: 28px; position: relative;';
    const nicknameInput = document.createElement('input');
    nicknameInput.type = 'text';
    nicknameInput.placeholder = 'Nickname';
    nicknameInput.required = true;
    nicknameInput.minLength = 3;
    nicknameInput.maxLength = 20;
    nicknameInput.style.cssText = this.getInputStyle();

    // Warning message for nickname - Absolute positioning to avoid layout shift
    const nicknameWarning = document.createElement('p');
    nicknameWarning.textContent = 'Nickname cannot be changed once created';
    nicknameWarning.style.cssText = `
      color: rgba(255, 107, 107, 0.9);
      font-size: 11px;
      margin: 0;
      padding: 4px 0 0 4px;
      font-weight: 300;
      letter-spacing: 0.3px;
      opacity: 0;
      transform: translateY(-5px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
      position: absolute;
      top: 100%;
      left: 0;
      width: 100%;
    `;

    nicknameInput.addEventListener('focus', () => {
      this.handleInputFocus(nicknameInput);
      nicknameWarning.style.opacity = '1';
      nicknameWarning.style.transform = 'translateY(0)';
    });

    nicknameInput.addEventListener('blur', () => {
      this.handleInputBlur(nicknameInput);
      nicknameWarning.style.opacity = '0';
      nicknameWarning.style.transform = 'translateY(-5px)';
    });

    nicknameGroup.appendChild(nicknameInput);
    nicknameGroup.appendChild(nicknameWarning);

    // Feedback container
    this.feedbackElement = document.createElement('div');
    this.feedbackElement.className = 'auth-feedback-message';
    this.feedbackElement.style.cssText = `
      font-size: 12px;
      margin: -20px 0 20px 0;
      padding: 12px;
      text-align: center;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      min-height: 0;
      border-radius: 2px;
    `;

    // Pulsante register
    const registerButton = document.createElement('button');
    registerButton.className = 'auth-submit-button';
    registerButton.innerHTML = '<span class="button-text">REGISTER</span><div class="loading-spinner" style="display: none;"></div>';
    registerButton.style.cssText = this.getButtonStyle();

    const handleSubmit = () => {
      this.handleRegister(
        emailInput.value,
        passwordInput.value,
        passwordInput.value, // Usa password come confirm password
        nicknameInput.value,
        registerButton
      );
    };

    registerButton.addEventListener('click', handleSubmit);
    nicknameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });

    this.setupButtonAnimations(registerButton);

    // Assembla form
    emailGroup.appendChild(emailInput);
    passwordGroup.appendChild(passwordInput);
    nicknameGroup.appendChild(nicknameInput);
    form.appendChild(emailGroup);
    form.appendChild(passwordGroup);
    form.appendChild(nicknameGroup);
    form.appendChild(this.feedbackElement);
    form.appendChild(registerButton);

    return form;
  }

  /**
   * Stile base per input fields
   */
  private getInputStyle(): string {
    return `
      width: 100%;
      padding: 16px 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: #ffffff;
      font-size: 14px;
      font-family: 'Segoe UI', Tahoma, sans-serif;
      font-weight: 400;
      box-sizing: border-box;
      outline: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
  }

  /**
   * Stile base per pulsanti
   */
  private getButtonStyle(): string {
    return `
      width: 100%;
      padding: 16px 30px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 800;
      font-family: 'Segoe UI', Tahoma, sans-serif;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      letter-spacing: 2px;
      text-transform: uppercase;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    `;
  }

  /**
   * Gestisce focus su input
   */
  private handleInputFocus(input: HTMLInputElement): void {
    input.style.borderColor = 'rgba(255, 255, 255, 0.15)';
    input.style.background = 'rgba(0, 0, 0, 0.4)';
    input.style.transform = 'scale(1.01)';
  }

  /**
   * Gestisce blur su input
   */
  private handleInputBlur(input: HTMLInputElement): void {
    input.style.borderColor = 'rgba(255, 255, 255, 0.05)';
    input.style.background = 'rgba(0, 0, 0, 0.3)';
    input.style.transform = 'scale(1)';
  }

  /**
   * Configura animazioni per pulsanti
   */
  private setupButtonAnimations(button: HTMLButtonElement): void {
    // Hover
    button.addEventListener('mouseenter', () => {
      if (!this.isProcessing()) {
        button.style.transform = 'translateY(-2px) scale(1.01)';
        button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
        button.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        button.style.background = 'rgba(255, 255, 255, 0.08)';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!this.isProcessing()) {
        button.style.transform = 'translateY(0) scale(1)';
        button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        button.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        button.style.background = 'rgba(255, 255, 255, 0.05)';
      }
    });

    // Click
    button.addEventListener('mousedown', () => {
      if (!this.isProcessing()) {
        if (this.onPlayClickSound) this.onPlayClickSound();
        button.style.transform = 'translateY(0) scale(0.98)';
      }
    });

    button.addEventListener('mouseup', () => {
      if (!this.isProcessing()) {
        button.style.transform = 'translateY(-2px) scale(1.01)';
      }
    });
  }

  /**
   * Mostra messaggio di errore
   */
  showError(message: string): void {
    if (!this.feedbackElement) return;

    this.feedbackElement.textContent = message;
    this.feedbackElement.style.color = '#ff6b6b';
    this.feedbackElement.style.background = 'rgba(255, 68, 68, 0.1)';
    this.feedbackElement.style.border = '1px solid rgba(255, 68, 68, 0.2)';
    this.feedbackElement.style.opacity = '1';
    this.feedbackElement.style.transform = 'translateY(0)';
    this.feedbackElement.style.minHeight = 'auto';
  }

  /**
   * Mostra messaggio di successo
   */
  showSuccess(message: string): void {
    if (!this.feedbackElement) return;

    this.feedbackElement.textContent = message;
    this.feedbackElement.style.color = '#00ff88';
    this.feedbackElement.style.background = 'rgba(0, 255, 136, 0.1)';
    this.feedbackElement.style.border = '1px solid rgba(0, 255, 136, 0.2)';
    this.feedbackElement.style.opacity = '1';
    this.feedbackElement.style.transform = 'translateY(0)';
    this.feedbackElement.style.minHeight = 'auto';
  }

  /**
   * Nasconde feedback
   */
  hideFeedback(): void {
    if (this.feedbackElement) {
      this.feedbackElement.style.opacity = '0';
      this.feedbackElement.style.transform = 'translateY(-10px)';
      this.feedbackElement.style.minHeight = '0';
    }
  }

  /**
   * Mostra/nasconde loading sul pulsante
   */
  showButtonLoading(button: HTMLButtonElement, show: boolean): void {
    const buttonText = button.querySelector('.button-text') as HTMLElement;
    const spinner = button.querySelector('.loading-spinner') as HTMLElement;

    if (show) {
      button.disabled = true;
      button.style.cursor = 'not-allowed';
      button.style.opacity = '0.7';
      if (buttonText) buttonText.style.display = 'none';
      if (spinner) {
        spinner.style.display = 'block';
        spinner.style.cssText = `
          display: block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: rgba(255, 255, 255, 0.9);
          animation: spin 0.8s linear infinite;
        `;
      }
    } else {
      button.disabled = false;
      button.style.cursor = 'pointer';
      button.style.opacity = '1';
      if (buttonText) buttonText.style.display = 'block';
      if (spinner) spinner.style.display = 'none';
    }
  }
}
