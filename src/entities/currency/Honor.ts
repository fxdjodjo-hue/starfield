import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente Honor - gestisce i punti onore e ranking competitivo del giocatore
 * L'onore determina il grado militare basato sulla posizione relativa nel ranking globale
 */
export class Honor extends Component {
  private _honor: number;
  private _isOutlaw: boolean = false;

  constructor(initialHonor: number = 0) {
    super();
    this._honor = initialHonor; // Può essere negativo per Outlaw
    this.updateOutlawStatus();
  }

  /**
   * Ottiene i punti onore attuali
   */
  get honor(): number {
    return this._honor;
  }

  /**
   * Verifica se il giocatore è un Outlaw
   */
  get isOutlaw(): boolean {
    return this._isOutlaw;
  }

  /**
   * Aggiorna lo status di Outlaw basato sui punti onore
   */
  updateOutlawStatus(): void {
    this._isOutlaw = this._honor <= -500;
  }

  /**
   * Aggiunge punti onore (per achievements locali)
   */
  addHonor(amount: number): void {
    if (amount <= 0) return;
    this._honor += amount;
    this.updateOutlawStatus();
  }

  /**
   * Rimuove punti onore (per penalità)
   */
  removeHonor(amount: number): void {
    if (amount <= 0) return;
    this._honor -= amount;
    this.updateOutlawStatus();
  }


}
