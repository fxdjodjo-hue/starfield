/**
 * Contesto globale del gioco - contiene dati condivisi tra stati
 * Centralizza configurazione e stato globale dell'applicazione
 */
export class GameContext {
  // Dati giocatore
  public playerNickname: string = '';

  // Configurazione gioco
  public canvas: HTMLCanvasElement;
  public gameContainer: HTMLElement;

  // Stati del gioco
  public currentState: GameState | null = null;

  constructor(canvas: HTMLCanvasElement, gameContainer: HTMLElement) {
    this.canvas = canvas;
    this.gameContainer = gameContainer;
  }

  /**
   * Imposta il nickname del giocatore
   */
  setPlayerNickname(nickname: string): void {
    if (this.validateNickname(nickname)) {
      this.playerNickname = nickname.trim();
    } else {
      throw new Error('Nickname non valido');
    }
  }

  /**
   * Valida il nickname secondo le regole del gioco
   */
  validateNickname(nickname: string): boolean {
    if (!nickname || nickname.trim().length === 0) return false;

    const trimmed = nickname.trim();

    // Controlli lunghezza
    if (trimmed.length < 3 || trimmed.length > 16) return false;

    // Solo lettere e numeri
    const validChars = /^[a-zA-Z0-9]+$/;
    return validChars.test(trimmed);
  }

  /**
   * Verifica se il giocatore ha un nickname valido
   */
  hasValidNickname(): boolean {
    return this.playerNickname.length >= 3 && this.playerNickname.length <= 16;
  }
}
