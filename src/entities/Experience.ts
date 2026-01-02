import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente Experience - gestisce i punti esperienza e il livello del giocatore
 * Include calcolo automatico del livello e progressione
 */
export class Experience extends Component {
  private _exp: number;
  private _level: number;
  private _expForNextLevel: number;
  private _totalExpEarned: number;

  constructor(initialExp: number = 0, initialLevel: number = 1) {
    super();
    this._totalExpEarned = initialExp;
    this._level = initialLevel;
    this._exp = this._totalExpEarned - this.getExpRequiredForLevel(this._level - 1);
    this._expForNextLevel = this.getExpRequiredForLevel(this._level);
  }

  /**
   * Ottiene l'esperienza corrente nel livello attuale
   */
  get exp(): number {
    return this._exp;
  }

  /**
   * Ottiene il livello attuale
   */
  get level(): number {
    return this._level;
  }

  /**
   * Ottiene l'esperienza totale guadagnata
   */
  get totalExpEarned(): number {
    return this._totalExpEarned;
  }

  /**
   * Ottiene l'esperienza necessaria per il prossimo livello
   */
  get expForNextLevel(): number {
    return this._expForNextLevel;
  }

  /**
   * Ottiene la percentuale di completamento del livello attuale (0-100)
   */
  getLevelProgress(): number {
    const expInLevel = this._exp;
    const expNeeded = this._expForNextLevel - this.getExpRequiredForLevel(this._level - 1);
    return Math.min(100, (expInLevel / expNeeded) * 100);
  }

  /**
   * Aggiunge esperienza e gestisce automaticamente i level up
   */
  addExp(amount: number): boolean {
    if (amount <= 0) return false;

    this._totalExpEarned += amount;
    this._exp += amount;

    // Controlla se dobbiamo salire di livello
    let leveledUp = false;
    while (this._exp >= this._expForNextLevel - this.getExpRequiredForLevel(this._level - 1)) {
      this.levelUp();
      leveledUp = true;
    }

    return leveledUp; // Ritorna true se è salito di livello
  }

  /**
   * Gestisce il level up
   */
  private levelUp(): void {
    this._level++;
    // Ricompensa exp residua per il nuovo livello
    const previousLevelExp = this.getExpRequiredForLevel(this._level - 1);
    this._exp = this._totalExpEarned - previousLevelExp;
    this._expForNextLevel = this.getExpRequiredForLevel(this._level);
  }

  /**
   * Calcola l'esperienza totale richiesta per raggiungere un livello specifico
   * Formula: livello^2 * 100 (scalabile e prevedibile)
   */
  private getExpRequiredForLevel(level: number): number {
    if (level <= 0) return 0;
    return level * level * 100; // Formula: level² * 100
  }

  /**
   * Imposta direttamente il livello (per debug o caricamento)
   */
  setLevel(level: number): void {
    if (level < 1) level = 1;
    this._level = level;
    this._expForNextLevel = this.getExpRequiredForLevel(level);
    // Ricalcola exp basato sul nuovo livello
    this._exp = this._totalExpEarned - this.getExpRequiredForLevel(level - 1);
  }

  /**
   * Formatta l'esperienza per display
   */
  formatForDisplay(): string {
    return `${this._exp}/${this._expForNextLevel - this.getExpRequiredForLevel(this._level - 1)}`;
  }
}
