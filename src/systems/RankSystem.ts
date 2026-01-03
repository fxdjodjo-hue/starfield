import { System as BaseSystem } from '../infrastructure/ecs/System';
import { ECS } from '../infrastructure/ecs/ECS';
import { Experience } from '../entities/Experience';
import { Honor } from '../entities/Honor';
import { PlayerStats } from '../entities/PlayerStats';

/**
 * Sistema Rank - gestisce il calcolo dei gradi militari
 * Il rank è calcolato in base a exp + honor del giocatore
 */
export class RankSystem extends BaseSystem {
  private playerEntity: any = null;

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
   * Calcola i punti ranking totali (exp + honor)
   */
  calculateRankingPoints(): number {
    if (!this.playerEntity) return 0;

    const experience = this.ecs.getComponent(this.playerEntity, Experience);
    const honor = this.ecs.getComponent(this.playerEntity, Honor);
    const playerStats = this.ecs.getComponent(this.playerEntity, PlayerStats);

    if (!experience || !honor || !playerStats) return 0;

    // Formula migliorata: exp totale + (honor * 1.5) + (livello * 30) + (kills / 10)
    // - Exp: base principale (100% del valore)
    // - Honor: bonus moderato per comportamento (×1.5)
    // - Level: vantaggio veterani significativo (×30)
    // - Kills: bonus efficienza minima (÷10)
    const points = experience.totalExpEarned + (honor.honor * 1.5) + (experience.level * 30) + (playerStats.kills / 10);

    return points;
  }

  /**
   * Calcola il rank attuale basato sui punti ranking
   */
  calculateCurrentRank(): string {
    if (!this.playerEntity) return 'Recruit';

    const honor = this.ecs.getComponent(this.playerEntity, Honor);

    // Ranghi speciali hanno priorità
    if (honor?.isAdministrator) {
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
  static getAllRanks(): Array<{name: string, minPoints: number}> {
    return [...RankSystem.MILITARY_RANKS];
  }

  update(deltaTime: number): void {
    // Il sistema rank non ha aggiornamenti automatici
  }
}
