import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente Cosmos - gestisce i Cosmos del giocatore
 * I Cosmos sono una valuta speciale/ premium
 */
export class Cosmos extends Component {
  private _cosmos: number;
  private _maxCosmos: number;

  constructor(initialCosmos: number = 0, maxCosmos: number = 99999) {
    super();
    this._cosmos = Math.max(0, initialCosmos); // Non permettere valori negativi
    this._maxCosmos = maxCosmos;
  }

  /**
   * Ottiene la quantità attuale di Cosmos
   */
  get cosmos(): number {
    return this._cosmos;
  }

  /**
   * Ottiene il limite massimo di Cosmos
   */
  get maxCosmos(): number {
    return this._maxCosmos;
  }

  /**
   * Aggiunge Cosmos (con controllo overflow)
   */
  addCosmos(amount: number): number {
    if (amount <= 0) return 0;

    const oldAmount = this._cosmos;
    this._cosmos = Math.min(this._maxCosmos, this._cosmos + amount);
    const added = this._cosmos - oldAmount;

    return added; // Ritorna quanti sono stati effettivamente aggiunti
  }

  /**
   * Rimuove Cosmos (con controllo underflow)
   */
  removeCosmos(amount: number): number {
    if (amount <= 0) return 0;

    const oldAmount = this._cosmos;
    this._cosmos = Math.max(0, this._cosmos - amount);
    const removed = oldAmount - this._cosmos;

    return removed; // Ritorna quanti sono stati effettivamente rimossi
  }

  /**
   * Imposta direttamente la quantità di Cosmos
   */
  setCosmos(amount: number): void {
    this._cosmos = Math.max(0, Math.min(this._maxCosmos, amount));
  }

  /**
   * Controlla se il giocatore può permettersi un acquisto
   */
  canAfford(cost: number): boolean {
    return this._cosmos >= cost;
  }

  /**
   * Ottiene la percentuale di riempimento (per UI)
   */
  getFillPercentage(): number {
    return (this._cosmos / this._maxCosmos) * 100;
  }

  /**
   * Formatta i Cosmos per display (con separatori)
   */
  formatForDisplay(): string {
    return this._cosmos.toLocaleString();
  }
}