import { ECS } from '../../../infrastructure/ecs/ECS';
import { Honor } from '../../../entities/currency/Honor';
import { SkillPoints } from '../../../entities/currency/SkillPoints';

/**
 * Manages Honor, Rank, and Skill Points
 */
export class HonorManager {
  constructor(
    private readonly ecs: ECS,
    private readonly getPlayerEntity: () => any,
    private readonly getRankSystem: () => any,
    private readonly onHonorChanged?: (newAmount: number, change: number, newRank?: string) => void,
    private readonly onSkillPointsChanged?: (newAmount: number, change: number) => void
  ) {}

  /**
   * Gets player Honor component
   */
  getPlayerHonor(): Honor | null {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return null;
    return this.ecs.getComponent(playerEntity, Honor) || null;
  }

  // TODO: Extract Honor methods
  // TODO: Extract Skill Points methods
  // TODO: Extract Rank methods
}
