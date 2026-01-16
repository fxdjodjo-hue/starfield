/**
 * Manages input validation and error/success message display
 */
export class AuthValidationManager {
  constructor(private readonly authContainer: HTMLElement) {}

  /**
   * Valida formato email
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Converte errori tecnici in messaggi user-friendly
   */
  getFriendlyErrorMessage(error: any): string {
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
   * Mostra errore all'utente
   */
  showError(message: string): void {
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
    const form = this.authContainer.querySelector('.auth-form-card') || this.authContainer.querySelector('.auth-form');
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
  showSuccess(message: string): void {
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
    const form = this.authContainer.querySelector('.auth-form-card') || this.authContainer.querySelector('.auth-form');
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
}
