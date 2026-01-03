import { Component } from '../infrastructure/ecs/Component';

/**
 * Componente SkillPoints - gestisce i punti abilità del giocatore
 * I punti abilità vengono guadagnati livellando e possono essere spesi per migliorare abilità
 */
export class SkillPoints extends Component {
  private _current: number;
  private _totalEarned: number; // Tiene traccia di quanti ne sono stati guadagnati in totale

  constructor(current: number = 0, totalEarned: number = 0) {
    super();
    this._current = current;
    this._totalEarned = totalEarned;
  }

  // Getters
  get current(): number {
    return this._current;
  }

  get totalEarned(): number {
    return this._totalEarned;
  }

  // Methods
  /**
   * Aggiunge punti abilità (quando il giocatore sale di livello)
   */
  addPoints(amount: number): void {
    if (amount > 0) {
      this._current += amount;
      this._totalEarned += amount;
    }
  }

  /**
   * Rimuove punti abilità (quando vengono spesi per abilità)
   */
  spendPoints(amount: number): boolean {
    if (amount > 0 && this._current >= amount) {
      this._current -= amount;
      return true;
    }
    return false;
  }

  /**
   * Resetta i punti abilità correnti (per test o reset)
   */
  reset(): void {
    this._current = 0;
  }

  /**
   * Imposta direttamente il numero di punti abilità
   */
  setPoints(amount: number): void {
    if (amount >= 0) {
      this._current = amount;
      if (amount > this._totalEarned) {
        this._totalEarned = amount;
      }
    }
  }
}
