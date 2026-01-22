/**
 * Stati dell'autenticazione
 */
export enum AuthState {
  LOADING = 'loading',         // Controllo sessione esistente
  LOGIN = 'login',            // Form login
  REGISTER = 'register',       // Form registrazione
  FORGOT_PASSWORD = 'forgot_password', // Recupero password
  VERIFIED = 'verified'        // Autenticato, può giocare
}
