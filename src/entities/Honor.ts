import { Component } from '/src/infrastructure/ecs/Component';

/**
 * Componente Honor - gestisce i punti onore e ranking competitivo del giocatore
 * L'onore determina il grado militare basato sulla posizione relativa nel ranking globale
 */
export class Honor extends Component {
  private _honor: number;
  private _honorRank: string;
  private _rankingPosition: number = 0; // Posizione nel ranking globale (1 = primo)
  private _totalPlayers: number = 1; // Totale giocatori attivi

  // Ranghi militari basati su proporzione di giocatori (online competitivo)
  private static readonly MILITARY_RANKS = [
    { name: 'Chief General', maxProportion: 0.01 },      // Top 1% - 1 player per compagnia
    { name: 'General', maxProportion: 0.02 },            // Top 2%
    { name: 'Basic General', maxProportion: 0.03 },      // Top 3%
    { name: 'Chief Colonel', maxProportion: 0.05 },      // Top 5%
    { name: 'Colonel', maxProportion: 0.20 },            // Top 20%
    { name: 'Basic Colonel', maxProportion: 0.25 },      // Top 25%
    { name: 'Chief Major', maxProportion: 0.265 },       // Top 26.5%
    { name: 'Major', maxProportion: 0.285 },             // Top 28.5%
    { name: 'Basic Major', maxProportion: 0.31 },        // Top 31%
    { name: 'Chief Captain', maxProportion: 0.34 },      // Top 34%
    { name: 'Captain', maxProportion: 0.375 },           // Top 37.5%
    { name: 'Basic Captain', maxProportion: 0.415 },     // Top 41.5%
    { name: 'Chief Lieutenant', maxProportion: 0.46 },   // Top 46%
    { name: 'Lieutenant', maxProportion: 0.51 },         // Top 51%
    { name: 'Basic Lieutenant', maxProportion: 0.57 },   // Top 57%
    { name: 'Chief Sergeant', maxProportion: 0.64 },     // Top 64%
    { name: 'Sergeant', maxProportion: 0.72 },           // Top 72%
    { name: 'Basic Sergeant', maxProportion: 0.81 },     // Top 81%
    { name: 'Chief Space Pilot', maxProportion: 0.91 },  // Top 91%
    { name: 'Space Pilot', maxProportion: 1.0 },         // Top 100%
    { name: 'Basic Space Pilot', maxProportion: 1.0 }    // Top 100%
  ];

  // Ranghi speciali (non basati su proporzione)
  private _isAdministrator: boolean = false;
  private _isOutlaw: boolean = false;

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
   * Ottiene la posizione nel ranking globale
   */
  get rankingPosition(): number {
    return this._rankingPosition;
  }

  /**
   * Ottiene il totale dei giocatori attivi
   */
  get totalPlayers(): number {
    return this._totalPlayers;
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
   * Aggiorna la posizione nel ranking globale
   */
  updateRankingPosition(position: number, totalPlayers: number): string | null {
    const oldRank = this._honorRank;
    this._rankingPosition = Math.max(1, position);
    this._totalPlayers = Math.max(1, totalPlayers);
    this._honorRank = this.calculateRank();

    // Ritorna il nuovo rango se è cambiato, altrimenti null
    return this._honorRank !== oldRank ? this._honorRank : null;
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

    // Calcola la proporzione (posizione / totale giocatori)
    const proportion = this._rankingPosition / this._totalPlayers;

    // DEBUG: mostra i valori di calcolo
    console.log(`DEBUG Rank calc: position=${this._rankingPosition}, totalPlayers=${this._totalPlayers}, proportion=${proportion.toFixed(3)}`);

    // Trova il rango appropriato basato sulla proporzione
    for (const rank of Honor.MILITARY_RANKS) {
      if (proportion <= rank.maxProportion) {
        console.log(`DEBUG Rank assigned: ${rank.name} (proportion ${proportion.toFixed(3)} <= ${rank.maxProportion})`);
        return rank.name;
      }
    }

    // Default: ultimo rango disponibile
    const defaultRank = Honor.MILITARY_RANKS[Honor.MILITARY_RANKS.length - 1].name;
    console.log(`DEBUG Rank assigned: ${defaultRank} (default)`);
    return defaultRank;
  }

  /**
   * Ottiene la posizione percentuale nel ranking globale (0-100)
   */
  getRankingPercentage(): number {
    if (this._totalPlayers <= 1) return 100;
    return ((this._totalPlayers - this._rankingPosition + 1) / this._totalPlayers) * 100;
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
   * Formatta l'onore e ranking per display
   */
  formatForDisplay(): string {
    return `${this._rankingPosition}/${this._totalPlayers}`;
  }

  /**
   * Ottiene tutti i ranghi militari disponibili
   */
  static getAllRanks(): Array<{name: string, maxProportion: number}> {
    return [...Honor.MILITARY_RANKS];
  }
}
