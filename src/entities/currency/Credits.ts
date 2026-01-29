import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente Credits - gestisce i Credits del giocatore
 * I Credits sono la valuta principale per acquisti e upgrade
 */
export class Credits extends Component {
  private _credits: number;
  private _maxCredits: number;

  constructor(initialCredits: number = 0, maxCredits: number = 999999999) {
    super();
    this._credits = Math.max(0, initialCredits); // Non permettere valori negativi
    this._maxCredits = maxCredits;
  }

  /**
   * Ottiene la quantità attuale di Credits
   */
  get credits(): number {
    return this._credits;
  }

  /**
   * Ottiene il limite massimo di Credits
   */
  get maxCredits(): number {
    return this._maxCredits;
  }

  /**
   * Aggiunge Credits (con controllo overflow)
   */
  addCredits(amount: number): number {
    if (amount <= 0) return 0;

    const oldAmount = this._credits;
    this._credits = Math.min(this._maxCredits, this._credits + amount);
    const added = this._credits - oldAmount;

    return added; // Ritorna quanti sono stati effettivamente aggiunti
  }

  /**
   * Rimuove Credits (con controllo underflow)
   */
  removeCredits(amount: number): number {
    if (amount <= 0) return 0;

    const oldAmount = this._credits;
    this._credits = Math.max(0, this._credits - amount);
    const removed = oldAmount - this._credits;

    return removed; // Ritorna quanti sono stati effettivamente rimossi
  }

  /**
   * Imposta direttamente la quantità di Credits
   */
  setCredits(amount: number): void {
    this._credits = Math.max(0, Math.min(this._maxCredits, amount));
  }

  /**
   * Controlla se il giocatore può permettersi un acquisto
   */
  canAfford(cost: number): boolean {
    return this._credits >= cost;
  }

  /**
   * Ottiene la percentuale di riempimento (per UI)
   */
  getFillPercentage(): number {
    return (this._credits / this._maxCredits) * 100;
  }

  /**
   * Formatta i Credits per display (con separatori)
   */
  formatForDisplay(): string {
    return this._credits.toLocaleString();
  }
}