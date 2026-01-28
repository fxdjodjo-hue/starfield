import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Entity } from '../../../infrastructure/ecs/Entity';
import type { PlayerSystem } from '../../player/PlayerSystem';
import { DamageText } from '../../../entities/combat/DamageText';
import { Shield } from '../../../entities/combat/Shield';

/**
 * Manages damage text creation and tracking
 */
export class CombatDamageManager {
  private activeLaserTexts: Map<number, number> = new Map(); // entityId -> count
  private activeMissileTexts: Map<number, number> = new Map(); // entityId -> count

  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem
  ) { }

  /**
   * Creates a damage text for a target entity
   */
  createDamageText(targetEntity: Entity, damage: number, isShieldDamage: boolean = false, isBoundsDamage: boolean = false, projectileType?: 'laser' | 'npc_laser' | 'missile'): void {
    if (damage <= 0) {
      return;
    }

    const targetEntityId = targetEntity.id;

    // Usa contatore per testi di danno attivi
    const activeMap = projectileType === 'missile' ? this.activeMissileTexts : this.activeLaserTexts;
    const maxTexts = 3; // Max 3 testi di danno

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
    } else {
      // Tutti i danni HP usano il rosso
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
  decrementDamageTextCount(targetEntityId: number, projectileType?: 'laser' | 'npc_laser' | 'missile'): void {
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
