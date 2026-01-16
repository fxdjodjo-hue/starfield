import { AuthState } from './AuthState';

/**
 * Manages form creation and rendering (login, register)
 */
export class AuthFormManager {
  private readonly authContainer: HTMLElement;
  private readonly getCurrentState: () => AuthState;
  private readonly isProcessing: () => boolean;
  private readonly handleLogin: (email: string, password: string, button: HTMLButtonElement) => Promise<void>;
  private readonly handleRegister: (email: string, password: string, confirmPassword: string, nickname: string, button: HTMLButtonElement) => Promise<void>;
  private readonly setState: (state: AuthState) => void;

  constructor(
    authContainer: HTMLElement,
    getCurrentState: () => AuthState,
    isProcessing: () => boolean,
    handleLogin: (email: string, password: string, button: HTMLButtonElement) => Promise<void>,
    handleRegister: (email: string, password: string, confirmPassword: string, nickname: string, button: HTMLButtonElement) => Promise<void>,
    setState: (state: AuthState) => void,
    showButtonLoading: (button: HTMLButtonElement, show: boolean) => void
  ) {
    this.authContainer = authContainer;
    this.getCurrentState = getCurrentState;
    this.isProcessing = isProcessing;
    this.handleLogin = handleLogin;
    this.handleRegister = handleRegister;
    this.setState = setState;
    // showButtonLoading parameter is unused - class has its own method
  }

  /**
   * Renderizza il form di autenticazione appropriato
   */
  renderForm(): void {
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

    const currentState = this.getCurrentState();

    if (currentState === AuthState.LOGIN) {
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

    } else if (currentState === AuthState.REGISTER) {
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
  createLoginForm(): HTMLDivElement {
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
    passwordInput.style.cssText = emailInput.style.cssText;
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
      if (!this.isProcessing()) {
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
      if (!this.isProcessing()) {
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
  createRegisterForm(): HTMLDivElement {
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
      if (!this.isProcessing()) {
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
      if (!this.isProcessing()) {
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
   * Mostra/nasconde loading sul pulsante
   */
  showButtonLoading(button: HTMLButtonElement, show: boolean): void {
    const buttonText = button.querySelector('.button-text') as HTMLElement;
    const spinner = button.querySelector('.loading-spinner') as HTMLElement;

    if (show) {
      button.disabled = true;
      button.style.cursor = 'not-allowed';
      if (buttonText) buttonText.style.display = 'none';
      if (spinner) spinner.style.display = 'block';
    } else {
      button.disabled = false;
      button.style.cursor = 'pointer';
      if (buttonText) buttonText.style.display = 'block';
      if (spinner) spinner.style.display = 'none';
    }
  }
}
