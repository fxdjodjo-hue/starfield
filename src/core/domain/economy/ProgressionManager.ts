import { ECS } from '../../../infrastructure/ecs/ECS';
import { Experience } from '../../../entities/currency/Experience';

/**
 * Manages Experience and Level progression
 */
export class ProgressionManager {
  constructor(
    private readonly ecs: ECS,
    private readonly getPlayerEntity: () => any,
    private readonly onExperienceChanged?: (newAmount: number, change: number, leveledUp: boolean) => void
  ) {}

  /**
   * Gets player Experience component
   */
  getPlayerExperience(): Experience | null {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return null;
    return this.ecs.getComponent(playerEntity, Experience) || null;
  }

  // ===== EXPERIENCE METHODS =====

  /**
   * Aggiunge Experience Points al giocatore
   */
  addExperience(amount: number, reason: string = 'unknown'): boolean {
    const experience = this.getPlayerExperience();
    if (!experience) return false;

    const oldLevel = experience.level;

    // Skill points ora riservati per usi futuri (specializzazioni, abilità, ecc.)
    const leveledUp = experience.addExp(amount);

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
    this.onExperienceChanged?.(experience.totalExpEarned, amount, leveledUp);

    return leveledUp;
  }

  /**
   * Ottiene il livello attuale del giocatore
   */
  getPlayerLevel(): number {
    const experience = this.getPlayerExperience();
    return experience ? experience.level : 1;
  }

  /**
   * IMPOSTA direttamente l'Experience del giocatore (Server Authoritative)
   */
  setExperience(totalExp: number, reason: string = 'server_update'): void {
    const experience = this.getPlayerExperience();
    if (!experience) {
      return;
    }

    const oldTotalExp = experience.totalExpEarned;
    const targetTotalExp = Math.max(0, totalExp);

    // Usa setTotalExp per impostare direttamente l'esperienza totale (server authoritative)
    if (typeof experience.setTotalExp === 'function') {
      experience.setTotalExp(targetTotalExp);
    } else {
      // Fallback: calcola la differenza e usa addExp per raggiungere il target
      if (targetTotalExp > oldTotalExp) {
        experience.addExp(targetTotalExp - oldTotalExp);
      } else if (targetTotalExp < oldTotalExp) {
        // Per rimuovere esperienza, dovrei implementare un metodo removeExp
        // Per ora, assumiamo che l'esperienza solo aumenti nel server authoritative
      }
    }

    const change = experience.totalExpEarned - oldTotalExp;
    const leveledUp = experience.level > Math.floor(oldTotalExp / 100) + 1;

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
    this.onExperienceChanged?.(experience.totalExpEarned, change, leveledUp);
  }
}
