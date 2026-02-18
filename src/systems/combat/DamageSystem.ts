import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { DamageText } from '../../entities/combat/DamageText';
import { Transform } from '../../entities/spatial/Transform';

/**
 * Sistema dedicato alla gestione dei danni e degli effetti visivi
 * Responsabilità: Creazione testi danno, gestione contatori testi danno
 * Segue il principio Single Responsibility
 */
export class DamageSystem extends BaseSystem {
  private activeLaserTexts: Map<number, number> = new Map(); // entityId -> count

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Crea un testo di danno (chiamato da altri sistemi quando applicano danno)
   */
  createDamageText(targetEntity: Entity | null, damage: number, isShieldDamage: boolean = false, isBoundsDamage: boolean = false, projectileType?: 'laser' | 'pet_laser' | 'npc_laser' | 'missile' | 'lb1' | 'lb2' | 'lb3' | 'm1' | 'm2' | 'm3', initialX?: number, initialY?: number): void {
    if (damage <= 0) {
      return;
    }

    // Se l'entità è nulla ma abbiamo le coordinate, usiamo quelle
    // Altrimenti cerchiamo di ottenere le coordinate dal transform dell'entità
    let worldX = initialX || 0;
    let worldY = initialY || 0;
    let targetEntityId = targetEntity ? targetEntity.id : -1;

    if (targetEntity && (!initialX || !initialY)) {
      const transform = this.ecs.getComponent(targetEntity, Transform) as Transform;
      if (transform) {
        worldX = transform.x;
        worldY = transform.y;
      }
    }

    // Usa contatore per testi di danno attivi
    const activeMap = this.activeLaserTexts;
    const maxTexts = 3; // Max 3 testi di danno

    // Controlla quanti testi sono già attivi per questa entità e tipo
    const activeCount = activeMap.get(targetEntityId) || 0;
    // Per danni bounds non applicare limiti - mostra sempre
    if (!isBoundsDamage && activeCount >= maxTexts) return;

    // Determina il colore e offset del testo
    const playerEntity = this.ecs.getPlayerEntity();
    const isPlayerDamage = playerEntity && targetEntityId === playerEntity.id;

    let textColor: string;
    let offsetY: number;
    let offsetX: number;

    if (isShieldDamage) {
      textColor = '#4444ff'; // Blu per shield
      offsetY = -30;
      offsetX = (Math.random() - 0.5) * 25; // ±12.5px
      offsetY = -30;
      offsetX = (Math.random() - 0.5) * 25; // ±12.5px
    } else {
      // Robust missile check (supports m1, m2, m3, missile)
      const isMissile = projectileType === 'missile' ||
        (typeof projectileType === 'string' && projectileType.startsWith('m'));

      if (isMissile) {
        // Danni Missili in Arancione
        textColor = '#FFA500'; // Orange
        offsetY = -40; // Leggermente più in alto
        offsetX = (Math.random() - 0.5) * 30; // Più dispersione per missili
      } else {
        // Tutti i danni HP usano il rosso (laser standard)
        textColor = '#ff4444';
        offsetY = -30; // Default, sarà aggiustato sotto
        offsetX = (Math.random() - 0.5) * 20; // ±10px
      }
    }

    // Se abbiamo appena applicato danno shield, il prossimo danno HP va più in basso
    if (targetEntity && !isShieldDamage && this.hasRecentShieldDamage(targetEntity)) {
      offsetY = -15; // HP più in basso quando c'è stato danno shield
    }

    // Crea il testo di danno
    const damageTextEntity = this.ecs.createEntity();
    const damageText = new DamageText(damage, targetEntityId, offsetX, offsetY, textColor, 1000, projectileType, worldX, worldY);
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
  public decrementDamageTextCount(targetEntityId: number, projectileType?: 'laser' | 'pet_laser' | 'npc_laser' | 'missile' | 'lb1' | 'lb2' | 'lb3' | 'm1' | 'm2' | 'm3'): void {
    const activeMap = this.activeLaserTexts;
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
   * Aggiornamento periodico (implementazione dell'interfaccia System)
   */
  update(deltaTime: number): void {
    // DamageSystem non ha aggiornamenti periodici,
    // ma deve implementare l'interfaccia System
  }

  /**
   * Cleanup delle risorse per prevenire memory leaks
   */
  public destroy(): void {
    this.activeLaserTexts.clear();
  }
}
