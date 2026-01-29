import type { CurrencyManager } from './CurrencyManager';
import type { ProgressionManager } from './ProgressionManager';
import type { HonorManager } from './HonorManager';

/**
 * Manages complete economy status queries
 */
export class EconomyStatusManager {
  constructor(
    private readonly currencyManager: CurrencyManager,
    private readonly progressionManager: ProgressionManager,
    private readonly honorManager: HonorManager,
    private readonly getRankSystem: () => any
  ) { }

  /**
   * Ottiene lo stato economico completo del giocatore
   */
  getPlayerEconomyStatus(): {
    credits: number;
    cosmos: number;
    level: number;
    experience: number;
    expForNextLevel: number;
    honor: number;
    honorRank: string;
  } | null {
    const credits = this.currencyManager.getPlayerCredits();
    const cosmos = this.currencyManager.getPlayerCosmos();
    const experience = this.progressionManager.getPlayerExperience();
    const honor = this.honorManager.getPlayerHonor();

    if (!credits || !cosmos || !experience || !honor) return null;

    const result = {
      credits: credits.credits,
      cosmos: cosmos.cosmos,
      level: experience.level,
      experience: experience.totalExpEarned,
      expForNextLevel: experience.expForCurrentLevel,
      honor: honor.honor,
      honorRank: this.getRankSystem()?.calculateCurrentRank() || 'Recruit'
    };

    return result;
  }
}
