import { Component } from '../../infrastructure/ecs/Component';

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
   * Ottiene l'esperienza necessaria per il livello attuale
   */
  get expForCurrentLevel(): number {
    const currentLevelExp = this.getExpRequiredForLevel(this._level - 1);
    const nextLevelExp = this.getExpRequiredForLevel(this._level);
    return nextLevelExp - currentLevelExp;
  }

  /**
   * Ottiene la percentuale di completamento del livello attuale (0-100)
   */
  getLevelProgress(): number {
    const expInLevel = this._exp;
    const expNeededForLevel = this.expForCurrentLevel;
    return Math.min(100, (expInLevel / expNeededForLevel) * 100);
  }

  /**
   * Aggiunge esperienza e gestisce automaticamente i level up
   */
  addExp(amount: number, onLevelUp?: (newLevel: number) => void): boolean {
    if (amount <= 0) return false;

    this._totalExpEarned += amount;

    // Controlla se dobbiamo salire di livello
    let leveledUp = false;
    while (this._totalExpEarned >= this.getExpRequiredForLevel(this._level + 1)) {
      this.levelUp();
      leveledUp = true;
      // Notifica il level up se è stata fornita una callback
      if (onLevelUp) {
        onLevelUp(this._level);
      }
    }

    // Aggiorna l'exp nel livello corrente dopo eventuali level up
    this._exp = this._totalExpEarned - this.getExpRequiredForLevel(this._level - 1);

    return leveledUp; // Ritorna true se è salito di livello
  }

  /**
   * Gestisce il level up
   */
  private levelUp(): void {
    this._level++;
    this._expForNextLevel = this.getExpRequiredForLevel(this._level);
  }

  /**
   * Calcola l'esperienza totale richiesta per raggiungere un livello specifico
   * Utilizza i valori specifici forniti per una progressione bilanciata
   */
  private getExpRequiredForLevel(level: number): number {
    if (level <= 1) return 0;

    // Valori specifici per ogni livello (exp cumulativa)
    const levelRequirements: { [key: number]: number } = {
      2: 10000,
      3: 30000,     // 10000 + 20000
      4: 70000,     // 30000 + 40000
      5: 150000,    // 70000 + 80000
      6: 310000,    // 150000 + 160000
      7: 630000,    // 310000 + 320000
      8: 1270000,   // 630000 + 640000
      9: 2550000,   // 1270000 + 1280000
      10: 5110000,  // 2550000 + 2560000
      11: 10230000, // 5110000 + 5120000
      12: 20470000, // 10230000 + 10240000
      13: 40950000, // 20470000 + 20480000
      14: 81910000, // 40950000 + 40960000
      15: 163910000,// 81910000 + 82000000
      16: 327750000,// 163910000 + 163840000
      17: 655430000,// 327750000 + 327680000
      18: 1310790000,// 655430000 + 655360000
      19: 2621710000,// 1310790000 + 1310720000
      20: 5243410000,// 2621710000 + 2621440000
      21: 10487010000,// 5243410000 + 5242880000
      22: 20973860000,// 10487010000 + 10485760000
      23: 41951120000,// 20973860000 + 20971520000
      24: 83902400000,// 41951120000 + 41943040000
      25: 167808800000,// 83902400000 + 83886080000
      26: 335621600000,// 167808800000 + 167772160000
      27: 671248000000,// 335621600000 + 335544320000
      28: 1342496000000,// 671248000000 + 671088640000
      29: 2685000000000,// 1342496000000 + 1342177280000
      30: 5369700000000,// 2685000000000 + 2684354560000
      31: 10739200000000,// 5369700000000 + 5368709120000
      32: 21478400000000,// 10739200000000 + 10737418240000
      33: 42956800000000,// 21478400000000 + 21474836480000
      34: 85913600000000,// 42956800000000 + 42949672960000
      35: 171827200000000,// 85913600000000 + 85899345920000
      36: 343654400000000,// 171827200000000 + 171798691840000
      37: 687308800000000,// 343654400000000 + 343597383680000
      38: 1374617600000000,// 687308800000000 + 687194767360000
      39: 2749235200000000,// 1374617600000000 + 1374389534720000
      40: 5498470400000000,// 2749235200000000 + 2748779069440000
      41: 10996940800000000,// 5498470400000000 + 5497558138880000
      42: 21993881600000000,// 10996940800000000 + 21990232555520000
      43: 43987763200000000,// 21993881600000000 + 21990465111040000
      44: 87975526400000000 // 43987763200000000 + 43987763200000000
    };

    return levelRequirements[level] || 0;
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
    return `${this._exp}/${this.expForCurrentLevel}`;
  }
}
