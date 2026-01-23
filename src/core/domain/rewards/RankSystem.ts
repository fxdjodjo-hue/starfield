import { System as BaseSystem } from '../../../infrastructure/ecs/System';
import { ECS } from '../../../infrastructure/ecs/ECS';
import { Experience } from '../../../entities/currency/Experience';
import { Honor } from '../../../entities/currency/Honor';
import { PlayerRole } from '../../../entities/player/PlayerRole';

/**
 * Sistema Rank - gestisce il calcolo dei gradi militari
 * Formula semplificata: RankingPoints = exp + (RecentHonor × 2)
 * Il rank può salire o scendere in base al comportamento recente
 */
export class RankSystem extends BaseSystem {
  private playerEntity: any = null;
  private recentHonor: number | null = null; // Media mobile honor ultimi 30 giorni (dal server)

  // Moltiplicatore per RecentHonor (configurabile tra 1.5-3)
  private readonly honorMultiplier: number = 2;

  // Ranghi militari completi basati su punti ranking (exp + honor)
  private static readonly MILITARY_RANKS = [
    { name: 'Chief General', minPoints: 100000 },
    { name: 'General', minPoints: 75000 },
    { name: 'Basic General', minPoints: 50000 },
    { name: 'Chief Colonel', minPoints: 35000 },
    { name: 'Colonel', minPoints: 25000 },
    { name: 'Basic Colonel', minPoints: 15000 },
    { name: 'Chief Major', minPoints: 10000 },
    { name: 'Major', minPoints: 7500 },
    { name: 'Basic Major', minPoints: 5000 },
    { name: 'Chief Captain', minPoints: 3500 },
    { name: 'Captain', minPoints: 2500 },
    { name: 'Basic Captain', minPoints: 1500 },
    { name: 'Chief Lieutenant', minPoints: 1000 },
    { name: 'Lieutenant', minPoints: 750 },
    { name: 'Basic Lieutenant', minPoints: 500 },
    { name: 'Chief Sergeant', minPoints: 350 },
    { name: 'Sergeant', minPoints: 250 },
    { name: 'Basic Sergeant', minPoints: 150 },
    { name: 'Chief Space Pilot', minPoints: 100 },
    { name: 'Space Pilot', minPoints: 50 },
    { name: 'Basic Space Pilot', minPoints: 25 },
    { name: 'Recruit', minPoints: 0 }
  ];

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta l'entità player
   */
  setPlayerEntity(entity: any): void {
    this.playerEntity = entity;
  }

  /**
   * Imposta RecentHonor (media mobile honor ultimi 30 giorni dal server)
   */
  setRecentHonor(recentHonor: number): void {
    this.recentHonor = recentHonor;
  }

  /**
   * Calcola i punti ranking totali usando formula semplificata
   * RankingPoints = exp + (RecentHonor × multiplier)
   * 
   * Per ora usa honor corrente come RecentHonor.
   * TODO: Implementare tracking storico per calcolare media mobile degli ultimi N giorni
   */
  calculateRankingPoints(): number {
    if (!this.playerEntity) return 0;

    const experience = this.ecs.getComponent(this.playerEntity, Experience);
    const honor = this.ecs.getComponent(this.playerEntity, Honor);

    if (!experience || !honor) return 0;

    // Formula semplificata: exp + (RecentHonor × 2)
    // - Exp: progressione permanente (base principale)
    // - RecentHonor × 2: peso moderato, premia comportamento recente
    // 
    // Usa RecentHonor dal server se disponibile, altrimenti fallback a honor corrente
    const recentHonorValue = this.recentHonor !== null ? this.recentHonor : honor.honor;
    const points = experience.totalExpEarned + (recentHonorValue * this.honorMultiplier);

    // Limite minimo: nessuno scende sotto la propria EXP
    // Honor penalizza solo sopra la base
    return Math.max(points, experience.totalExpEarned);
  }


  /**
   * Calcola il rank attuale basato sui punti ranking
   */
  calculateCurrentRank(): string {
    if (!this.playerEntity) return 'Recruit';

    const playerRole = this.ecs.getComponent(this.playerEntity, PlayerRole);
    const honor = this.ecs.getComponent(this.playerEntity, Honor);

    // Ranghi speciali hanno priorità
    if (playerRole?.isAdministrator) {
      return 'Administrator';
    }

    if (honor?.isOutlaw) {
      return 'Outlaw';
    }

    const rankingPoints = this.calculateRankingPoints();

    // Trova il rank appropriato basato sui punti ranking
    for (const rank of RankSystem.MILITARY_RANKS) {
      if (rankingPoints >= rank.minPoints) {
        return rank.name;
      }
    }

    // Default: Recruit
    return 'Recruit';
  }

  /**
   * Ottiene il prossimo rank disponibile
   */
  getNextRank(): string | null {
    const currentRank = this.calculateCurrentRank();
    const currentRankIndex = RankSystem.MILITARY_RANKS.findIndex(rank => rank.name === currentRank);

    if (currentRankIndex === -1 || currentRankIndex === 0) {
      return null; // È già al rank massimo o non trovato
    }

    return RankSystem.MILITARY_RANKS[currentRankIndex - 1].name;
  }

  /**
   * Ottiene tutti i ranghi disponibili
   */
  static getAllRanks(): Array<{ name: string, minPoints: number }> {
    return [...RankSystem.MILITARY_RANKS];
  }

  update(deltaTime: number): void {
    // Il sistema rank non ha aggiornamenti automatici
  }
}
