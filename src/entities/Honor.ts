import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente Honor - gestisce i punti onore del giocatore
 * L'onore rappresenta la reputazione e può sbloccare contenuti speciali
 */
export class Honor extends Component {
  private _honor: number;
  private _honorRank: string;
  private _maxHonor: number;

  // Ranghi di onore basati sui punti
  private static readonly HONOR_RANKS = [
    { name: 'Recruit', minHonor: 0 },
    { name: 'Scout', minHonor: 100 },
    { name: 'Guardian', minHonor: 500 },
    { name: 'Warrior', minHonor: 1000 },
    { name: 'Champion', minHonor: 2000 },
    { name: 'Legend', minHonor: 5000 },
    { name: 'Myth', minHonor: 10000 }
  ];

  constructor(initialHonor: number = 0, maxHonor: number = 99999) {
    super();
    this._honor = Math.max(0, initialHonor);
    this._maxHonor = maxHonor;
    this._honorRank = this.calculateRank();
  }

  /**
   * Ottiene i punti onore attuali
   */
  get honor(): number {
    return this._honor;
  }

  /**
   * Ottiene il rango attuale
   */
  get honorRank(): string {
    return this._honorRank;
  }

  /**
   * Ottiene l'onore massimo
   */
  get maxHonor(): number {
    return this._maxHonor;
  }

  /**
   * Aggiunge punti onore (con controllo overflow)
   */
  addHonor(amount: number): string | null {
    if (amount <= 0) return null;

    const oldRank = this._honorRank;
    this._honor = Math.min(this._maxHonor, this._honor + amount);
    this._honorRank = this.calculateRank();

    // Ritorna il nuovo rango se è cambiato, altrimenti null
    return this._honorRank !== oldRank ? this._honorRank : null;
  }

  /**
   * Rimuove punti onore (con controllo underflow)
   */
  removeHonor(amount: number): string | null {
    if (amount <= 0) return null;

    const oldRank = this._honorRank;
    this._honor = Math.max(0, this._honor - amount);
    this._honorRank = this.calculateRank();

    // Ritorna il nuovo rango se è cambiato (declassamento), altrimenti null
    return this._honorRank !== oldRank ? this._honorRank : null;
  }

  /**
   * Calcola il rango attuale basato sui punti onore
   */
  private calculateRank(): string {
    for (let i = Honor.HONOR_RANKS.length - 1; i >= 0; i--) {
      if (this._honor >= Honor.HONOR_RANKS[i].minHonor) {
        return Honor.HONOR_RANKS[i].name;
      }
    }
    return Honor.HONOR_RANKS[0].name; // Default: Recruit
  }

  /**
   * Ottiene il progresso verso il prossimo rango (0-100)
   */
  getRankProgress(): number {
    const currentRankIndex = Honor.HONOR_RANKS.findIndex(rank => rank.name === this._honorRank);
    if (currentRankIndex === -1 || currentRankIndex === Honor.HONOR_RANKS.length - 1) {
      return 100; // Massimo rango raggiunto
    }

    const currentRankMin = Honor.HONOR_RANKS[currentRankIndex].minHonor;
    const nextRankMin = Honor.HONOR_RANKS[currentRankIndex + 1].minHonor;
    const progress = (this._honor - currentRankMin) / (nextRankMin - currentRankMin);

    return Math.min(100, Math.max(0, progress * 100));
  }

  /**
   * Ottiene il prossimo rango disponibile
   */
  getNextRank(): string | null {
    const currentRankIndex = Honor.HONOR_RANKS.findIndex(rank => rank.name === this._honorRank);
    if (currentRankIndex === -1 || currentRankIndex === Honor.HONOR_RANKS.length - 1) {
      return null; // Nessun rango successivo
    }
    return Honor.HONOR_RANKS[currentRankIndex + 1].name;
  }

  /**
   * Formatta l'onore per display
   */
  formatForDisplay(): string {
    return this._honor.toLocaleString();
  }

  /**
   * Ottiene tutti i ranghi disponibili
   */
  static getAllRanks(): Array<{name: string, minHonor: number}> {
    return [...Honor.HONOR_RANKS];
  }
}
