import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Entity } from '../../../infrastructure/ecs/Entity';
import type { PlayerSystem } from '../../player/PlayerSystem';
import { DamageText } from '../../../entities/combat/DamageText';
import type { Shield } from '../../../entities/combat/Shield';

/**
 * Manages damage text creation and tracking
 */
export class CombatDamageManager {
  private activeLaserTexts: Map<number, number> = new Map(); // entityId -> count (for lasers)
  private activeMissileTexts: Map<number, number> = new Map(); // entityId -> count (for missiles)

  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem
  ) {}

  /**
   * Creates a damage text for a target entity
   */
  createDamageText(targetEntity: Entity, damage: number, isShieldDamage: boolean = false, isBoundsDamage: boolean = false, projectileType?: 'laser' | 'missile' | 'npc_laser'): void {
    if (damage <= 0) {
      return;
    }

    const targetEntityId = targetEntity.id;
    const isMissile = projectileType === 'missile';

    // Usa contatore separato per tipo di proiettile
    const activeMap = isMissile ? this.activeMissileTexts : this.activeLaserTexts;
    const maxTexts = isMissile ? 2 : 3; // Missili: max 2, Laser: max 3

    // Controlla quanti testi sono già attivi per questa entità e tipo
    const activeCount = activeMap.get(targetEntityId) || 0;
    // Per danni bounds non applicare limiti - mostra sempre
    if (!isBoundsDamage && activeCount >= maxTexts) return;

    // Determina il colore e offset del testo
    const playerEntity = this.playerSystem.getPlayerEntity();
    const isPlayerDamage = playerEntity && targetEntityId === playerEntity.id;

    let textColor: string;
    let offsetY: number;
    let offsetX: number;

    if (isShieldDamage) {
      textColor = '#4444ff'; // Blu per shield
      offsetY = -30;
      offsetX = (Math.random() - 0.5) * 25; // ±12.5px
    } else if (projectileType === 'missile') {
      // Danno da missile: arancione, offset più alto per evitare sovrapposizioni
      textColor = '#ff8800';
      offsetY = -45; // Più in alto dei laser per evitare sovrapposizioni
      offsetX = (Math.random() - 0.5) * 20; // ±10px
    } else {
      // Tutti i danni HP (player o NPC) da laser usano il rosso
      textColor = '#ff4444';
      offsetY = -30; // Default, sarà aggiustato sotto
      offsetX = (Math.random() - 0.5) * 20; // ±10px
    }

    // Se abbiamo appena applicato danno shield, il prossimo danno HP va più in basso
    if (!isShieldDamage && this.hasRecentShieldDamage(targetEntity)) {
      offsetY = -15; // HP più in basso quando c'è stato danno shield
    }

    // Crea il testo di danno
    const damageTextEntity = this.ecs.createEntity();
    const damageText = new DamageText(damage, targetEntityId, offsetX, offsetY, textColor, 1000, projectileType);
    this.ecs.addComponent(damageTextEntity, DamageText, damageText);

    // Aggiorna il contatore appropriato
    activeMap.set(targetEntityId, activeCount + 1);
  }

  /**
   * Controlla se l'entità ha subito danno shield recentemente
   */
  private hasRecentShieldDamage(targetEntity: Entity): boolean {
    // Per ora semplificato - controlla se ha uno shield attivo con danni recenti
    // In futuro potrebbe usare un timestamp più sofisticato
    const shield = this.ecs.getComponent(targetEntity, Shield);
    return !!(shield && (shield.isActive() ?? false) && shield.current < shield.max);
  }

  /**
   * Decrementa il contatore dei testi di danno attivi per un'entità
   * Chiamato dal DamageTextSystem quando un testo scade
   */
  decrementDamageTextCount(targetEntityId: number, projectileType?: 'laser' | 'missile' | 'npc_laser'): void {
    const activeMap = projectileType === 'missile' ? this.activeMissileTexts : this.activeLaserTexts;
    const currentCount = activeMap.get(targetEntityId) || 0;
    if (currentCount > 0) {
      activeMap.set(targetEntityId, currentCount - 1);
      // Rimuovi la chiave se il contatore arriva a 0
      if (currentCount - 1 === 0) {
        activeMap.delete(targetEntityId);
      }
    }
  }

  /**
   * Clears damage text tracking (for cleanup)
   */
  clear(): void {
    this.activeLaserTexts.clear();
    this.activeMissileTexts.clear();
  }
}
