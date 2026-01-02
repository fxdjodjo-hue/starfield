import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente Honor - gestisce i punti onore e ranking competitivo del giocatore
 * L'onore determina il grado militare basato sulla posizione relativa nel ranking globale
 */
export class Honor extends Component {
  private _honor: number;
  private _honorRank: string;
  private _isAdministrator: boolean = false;
  private _isOutlaw: boolean = false;

  // Ranghi militari completi basati su punti honor
  private static readonly MILITARY_RANKS = [
    { name: 'Chief General', minHonor: 50000 },
    { name: 'General', minHonor: 25000 },
    { name: 'Basic General', minHonor: 15000 },
    { name: 'Chief Colonel', minHonor: 10000 },
    { name: 'Colonel', minHonor: 7500 },
    { name: 'Basic Colonel', minHonor: 5000 },
    { name: 'Chief Major', minHonor: 3500 },
    { name: 'Major', minHonor: 2500 },
    { name: 'Basic Major', minHonor: 1500 },
    { name: 'Chief Captain', minHonor: 1000 },
    { name: 'Captain', minHonor: 750 },
    { name: 'Basic Captain', minHonor: 500 },
    { name: 'Chief Lieutenant', minHonor: 350 },
    { name: 'Lieutenant', minHonor: 250 },
    { name: 'Basic Lieutenant', minHonor: 150 },
    { name: 'Chief Sergeant', minHonor: 100 },
    { name: 'Sergeant', minHonor: 75 },
    { name: 'Basic Sergeant', minHonor: 50 },
    { name: 'Chief Space Pilot', minHonor: 25 },
    { name: 'Space Pilot', minHonor: 10 },
    { name: 'Basic Space Pilot', minHonor: 5 },
    { name: 'Recruit', minHonor: 0 }  // Honor >= 0 (default per nuovi giocatori)
  ];

  constructor(initialHonor: number = 0) {
    super();
    this._honor = initialHonor; // Può essere negativo per Outlaw
    this._honorRank = this.calculateRank();
  }

  /**
   * Ottiene i punti onore attuali
   */
  get honor(): number {
    return this._honor;
  }

  /**
   * Ottiene il rango attuale basato sul ranking
   */
  get honorRank(): string {
    return this._honorRank;
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
    this._honorRank = this.calculateRank(); // Ricalcola il rango
  }

  /**
   * Aggiorna lo status di Outlaw basato sui punti onore
   */
  updateOutlawStatus(): void {
    this._isOutlaw = this._honor <= -500;
    this._honorRank = this.calculateRank(); // Ricalcola il rango
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
   * Calcola il rango attuale basato sulla posizione nel ranking
   */
  private calculateRank(): string {
    // Ranghi speciali hanno priorità
    if (this._isAdministrator) {
      return 'Administrator';
    }

    if (this._isOutlaw) {
      return 'Outlaw';
    }

    // Trova il rango appropriato basato sui punti honor
    for (const rank of Honor.MILITARY_RANKS) {
      if (this._honor >= rank.minHonor) {
        return rank.name;
      }
    }

    // Default: Recruit per honor negativo o molto basso
    return 'Recruit';
  }

  /**
   * Ottiene il prossimo rango disponibile
   */
  getNextRank(): string | null {
    const currentRankIndex = Honor.MILITARY_RANKS.findIndex(rank => rank.name === this._honorRank);
    if (currentRankIndex === -1 || currentRankIndex === Honor.MILITARY_RANKS.length - 1) {
      return null; // Nessun rango successivo
    }
    return Honor.MILITARY_RANKS[currentRankIndex + 1].name;
  }

  /**
   * Ottiene tutti i ranghi militari disponibili
   */
  static getAllRanks(): Array<{name: string, minHonor: number}> {
    return [...Honor.MILITARY_RANKS];
  }
}
