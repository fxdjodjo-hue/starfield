import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente Honor - gestisce i punti onore e ranking competitivo del giocatore
 * L'onore determina il grado militare basato sulla posizione relativa nel ranking globale
 */
export class Honor extends Component {
  private _honor: number;
  private _isAdministrator: boolean = false;
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
   * Verifica se il giocatore è un Administrator
   */
  get isAdministrator(): boolean {
    return this._isAdministrator;
  }

  /**
   * Verifica se il giocatore è un Outlaw
   */
  get isOutlaw(): boolean {
    return this._isOutlaw;
  }


  /**
   * Imposta lo status di Administrator
   */
  setAdministrator(isAdmin: boolean): void {
    this._isAdministrator = isAdmin;
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

  /**
   * Ottiene il grado/rank attuale basato sui punti onore
   */
  getRank(): string {
    if (this._isAdministrator) {
      return "Administrator";
    }

    if (this._isOutlaw) {
      return "Outlaw";
    }

    // Rank system basato sui punti onore
    if (this._honor >= 10000) return "Chief General";
    if (this._honor >= 7500) return "General";
    if (this._honor >= 5000) return "Basic General";
    if (this._honor >= 3500) return "Chief Colonel";
    if (this._honor >= 2500) return "Colonel";
    if (this._honor >= 1500) return "Basic Colonel";
    if (this._honor >= 1000) return "Chief Major";
    if (this._honor >= 750) return "Major";
    if (this._honor >= 500) return "Basic Major";
    if (this._honor >= 350) return "Chief Captain";
    if (this._honor >= 250) return "Captain";
    if (this._honor >= 150) return "Basic Captain";
    if (this._honor >= 100) return "Chief Lieutenant";
    if (this._honor >= 75) return "Lieutenant";
    if (this._honor >= 50) return "Basic Lieutenant";
    if (this._honor >= 35) return "Chief Sergeant";
    if (this._honor >= 25) return "Sergeant";
    if (this._honor >= 15) return "Basic Sergeant";
    if (this._honor >= 10) return "Chief Space Pilot";
    if (this._honor >= 5) return "Space Pilot";
    if (this._honor >= 0) return "Basic Space Pilot";

    return "Civilian";
  }

}
