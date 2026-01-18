import { ECS } from '../../../infrastructure/ecs/ECS';
import { Honor } from '../../../entities/currency/Honor';
import { SkillPoints } from '../../../entities/currency/SkillPoints';
import { PlayerRole } from '../../../entities/player/PlayerRole';

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

  /**
   * Gets player Skill Points component
   */
  getPlayerSkillPoints(): SkillPoints | null {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return null;
    return this.ecs.getComponent(playerEntity, SkillPoints) || null;
  }

  // ===== HONOR METHODS =====

  /**
   * Imposta lo status di Administrator
   */
  setPlayerAdministrator(isAdmin: boolean): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;
    const playerRole = this.ecs.getComponent(playerEntity, PlayerRole);
    if (playerRole) {
      playerRole.setAdministrator(isAdmin);
    }
  }

  /**
   * Aggiunge punti onore (per ricompense NPC)
   */
  addHonor(amount: number, reason: string = 'unknown'): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      const oldAmount = honor.honor;
      honor.addHonor(amount);
      const newAmount = honor.honor;
      const change = newAmount - oldAmount;

      // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
      if (change !== 0 && reason !== 'server_update') {
        const currentRank = this.getRankSystem()?.calculateCurrentRank() || 'Recruit';
        this.onHonorChanged?.(newAmount, change, currentRank);
      }
    }
  }

  /**
   * Aggiunge punti onore locali (per achievements)
   */
  addLocalHonor(amount: number, reason: string = 'achievement'): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      honor.addHonor(amount);
    }
  }

  /**
   * Rimuove punti onore locali (per penalità)
   */
  removeLocalHonor(amount: number, reason: string = 'penalty'): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      honor.removeHonor(amount);
    }
  }

  /**
   * IMPOSTA direttamente l'Honor del giocatore (Server Authoritative)
   */
  setHonor(amount: number, reason: string = 'server_update'): void {
    const honor = this.getPlayerHonor();
    if (!honor) return;

    const oldAmount = honor.honor;
    const targetAmount = Math.max(0, amount);

    if (targetAmount > oldAmount) {
      honor.addHonor(targetAmount - oldAmount);
    } else if (targetAmount < oldAmount) {
      honor.removeHonor(oldAmount - targetAmount);
    }

    const change = honor.honor - oldAmount;

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
    const currentRank = this.getRankSystem()?.calculateCurrentRank() || 'Recruit';
    this.onHonorChanged?.(honor.honor, change, currentRank);
  }

  /**
   * Imposta RecentHonor nel RankSystem (media mobile honor ultimi 30 giorni)
   */
  setRecentHonor(recentHonor: number): void {
    const rankSystem = this.getRankSystem();
    if (rankSystem && typeof rankSystem.setRecentHonor === 'function') {
      rankSystem.setRecentHonor(recentHonor);
      
      // Ricalcola il rank e notifica il cambio (se necessario)
      const newRank = rankSystem?.calculateCurrentRank() || 'Recruit';
      if (this.onHonorChanged) {
        const honor = this.getPlayerHonor();
        // Notifica il cambio di rank (senza cambiare l'honor stesso)
        this.onHonorChanged?.(honor?.honor || 0, 0, newRank);
      }
    }
  }

  // ===== SKILL POINTS METHODS =====

  /**
   * Aggiunge SkillPoints al giocatore (per gestione futura - specializzazioni, abilità)
   * Attualmente non utilizzato nel leveling automatico
   */
  addSkillPoints(amount: number, reason: string = 'unknown'): number {
    const skillPoints = this.getPlayerSkillPoints();
    if (!skillPoints) return 0;

    const oldAmount = skillPoints.current;
    skillPoints.addPoints(amount);
    const newAmount = skillPoints.current;
    const added = newAmount - oldAmount;

    // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
    if (added > 0 && reason !== 'server_update') {
      this.onSkillPointsChanged?.(newAmount, added);
    }

    return added;
  }

  /**
   * IMPOSTA direttamente i SkillPoints del giocatore (Server Authoritative)
   * Per gestione futura - specializzazioni e abilità avanzate
   */
  setSkillPoints(amount: number, reason: string = 'server_update'): void {
    const skillPoints = this.getPlayerSkillPoints();
    if (!skillPoints) return;

    const oldAmount = skillPoints.skillPoints;
    skillPoints.setPoints(Math.max(0, amount)); // Usa il metodo esistente

    const change = skillPoints.skillPoints - oldAmount;

    // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
    if (reason !== 'server_update') {
      this.onSkillPointsChanged?.(skillPoints.skillPoints, change);
    }
  }
}
