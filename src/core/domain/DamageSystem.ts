/**
 * DamageSystem - Sistema centralizzato per gestione danni
 * Unifica tutta la logica di danno shield→health per NPC, Player e Proiettili
 */

import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { ComponentHelper } from '../data/ComponentHelper';
import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';

export interface DamageResult {
  appliedDamage: number;
  shieldDamage: number;
  healthDamage: number;
  isDead: boolean;
  newHealth: number;
  newShield: number;
}

export interface DamageContext {
  attackerId?: string;
  defenderId?: string;
  damageSource?: string;
  isCritical?: boolean;
  bypassShield?: boolean;
}

export class DamageSystem {
  /**
   * Applica danno a un'entità (logica unificata shield→health)
   * Sostituisce tutte le implementazioni duplicate di damageNpc, damagePlayer
   */
  static applyDamage(
    ecs: ECS,
    entity: Entity,
    damage: number,
    context?: DamageContext
  ): DamageResult {
    try {
      let remainingDamage = Math.max(0, damage);
      let shieldDamage = 0;
      let healthDamage = 0;

      // 1. Applica danno allo scudo prima (se presente e non bypassato)
      if (!context?.bypassShield) {
        const shieldStats = ComponentHelper.getShieldStats(ecs, entity);
        if (shieldStats && shieldStats.current > 0) {
          shieldDamage = Math.min(remainingDamage, shieldStats.current);
          const newShield = Math.max(0, shieldStats.current - shieldDamage);
          remainingDamage -= shieldDamage;

          ComponentHelper.updateShield(ecs, entity, newShield);
        }
      }

      // 2. Applica danno rimanente alla salute
      const healthStats = ComponentHelper.getHealthStats(ecs, entity);
      if (healthStats) {
        healthDamage = remainingDamage;
        const newHealth = Math.max(0, healthStats.current - healthDamage);
        const isDead = newHealth <= 0;

        ComponentHelper.updateHealth(ecs, entity, newHealth);

        // Log del danno applicato
        const attackerInfo = context?.attackerId ? ` from ${context.attackerId}` : '';
        const damageSource = context?.damageSource ? ` (${context.damageSource})` : '';

        LoggerWrapper.combat(
          `Entity ${entity.id} damaged${attackerInfo}${damageSource}: ` +
          `${healthStats.current}/${healthStats.max} HP, ` +
          `applied: ${damage} (shield: ${shieldDamage}, health: ${healthDamage}), ` +
          `remaining: ${newHealth}/${healthStats.max}${isDead ? ' [DEAD]' : ''}`,
          {
            attackerId: context?.attackerId,
            defenderId: String(entity.id),
            damage: damage,
            shieldDamage: shieldDamage,
            healthDamage: healthDamage,
            remainingHealth: newHealth,
            isDead: isDead,
            damageSource: context?.damageSource
          }
        );

        return {
          appliedDamage: damage,
          shieldDamage: shieldDamage,
          healthDamage: healthDamage,
          isDead: isDead,
          newHealth: newHealth,
          newShield: ComponentHelper.getShieldStats(ecs, entity)?.current || 0
        };
      }

      // Nessun componente Health trovato
      LoggerWrapper.error(LogCategory.COMBAT, `Cannot apply damage to entity ${entity.id}: no Health component`, undefined, {
        entityId: entity.id,
        damage: damage,
        context: context
      });

      return {
        appliedDamage: 0,
        shieldDamage: 0,
        healthDamage: 0,
        isDead: false,
        newHealth: 0,
        newShield: 0
      };

    } catch (error) {
      LoggerWrapper.error(LogCategory.COMBAT, `Failed to apply damage to entity ${entity.id}`, error as Error, {
        entityId: entity.id,
        damage: damage,
        context: context
      });

      return {
        appliedDamage: 0,
        shieldDamage: 0,
        healthDamage: 0,
        isDead: false,
        newHealth: 0,
        newShield: 0
      };
    }
  }

  /**
   * Applica danno da proiettile (con logica homing se applicabile)
   */
  static applyProjectileDamage(
    ecs: ECS,
    entity: Entity,
    projectileDamage: number,
    projectileId: string,
    attackerId?: string
  ): DamageResult {
    return this.applyDamage(ecs, entity, projectileDamage, {
      attackerId: attackerId,
      damageSource: `projectile_${projectileId}`
    });
  }

  /**
   * Applica danno da combattimento diretto
   */
  static applyCombatDamage(
    ecs: ECS,
    entity: Entity,
    damage: number,
    attackerId: string,
    isCritical: boolean = false
  ): DamageResult {
    return this.applyDamage(ecs, entity, damage, {
      attackerId: attackerId,
      damageSource: 'combat',
      isCritical: isCritical
    });
  }

  /**
   * Applica danno ambientale (bypass shield)
   */
  static applyEnvironmentalDamage(
    ecs: ECS,
    entity: Entity,
    damage: number,
    source: string = 'environment'
  ): DamageResult {
    return this.applyDamage(ecs, entity, damage, {
      damageSource: source,
      bypassShield: true
    });
  }


  /**
   * Verifica se un'entità può ricevere danno
   */
  static canTakeDamage(ecs: ECS, entity: Entity): boolean {
    try {
      const healthStats = ComponentHelper.getHealthStats(ecs, entity);
      return healthStats !== null && healthStats.current > 0;
    } catch (error) {
      LoggerWrapper.error(LogCategory.COMBAT, `Failed to check if entity can take damage`, error as Error, {
        entityId: entity.id
      });
      return false;
    }
  }

  /**
   * Ottiene statistiche di salute complete di un'entità
   */
  static getHealthStatus(ecs: ECS, entity: Entity): {
    currentHealth: number;
    maxHealth: number;
    currentShield: number;
    maxShield: number;
    healthPercentage: number;
    shieldPercentage: number;
    isAlive: boolean;
  } | null {
    try {
      const healthStats = ComponentHelper.getHealthStats(ecs, entity);
      const shieldStats = ComponentHelper.getShieldStats(ecs, entity);

      if (!healthStats) return null;

      const currentShield = shieldStats?.current || 0;
      const maxShield = shieldStats?.max || 0;

      return {
        currentHealth: healthStats.current,
        maxHealth: healthStats.max,
        currentShield: currentShield,
        maxShield: maxShield,
        healthPercentage: healthStats.max > 0 ? (healthStats.current / healthStats.max) * 100 : 0,
        shieldPercentage: maxShield > 0 ? (currentShield / maxShield) * 100 : 0,
        isAlive: healthStats.current > 0
      };
    } catch (error) {
      LoggerWrapper.error(LogCategory.COMBAT, `Failed to get health status`, error as Error, {
        entityId: entity.id
      });
      return null;
    }
  }

  /**
   * Ripara un'entità (ripristina salute/scudo)
   */
  static repairEntity(
    ecs: ECS,
    entity: Entity,
    healthAmount: number = 0,
    shieldAmount: number = 0
  ): boolean {
    try {
      let repaired = false;

      if (healthAmount > 0) {
        const healthStats = ComponentHelper.getHealthStats(ecs, entity);
        if (healthStats) {
          const newHealth = Math.min(healthStats.max, healthStats.current + healthAmount);
          ComponentHelper.updateHealth(ecs, entity, newHealth);
          repaired = true;
        }
      }

      if (shieldAmount > 0) {
        const shieldStats = ComponentHelper.getShieldStats(ecs, entity);
        if (shieldStats) {
          const newShield = Math.min(shieldStats.max, shieldStats.current + shieldAmount);
          ComponentHelper.updateShield(ecs, entity, newShield);
          repaired = true;
        }
      }

      if (repaired) {
        LoggerWrapper.combat(`Entity ${entity.id} repaired: +${healthAmount} HP, +${shieldAmount} Shield`, {
          entityId: entity.id,
          healthRepaired: healthAmount,
          shieldRepaired: shieldAmount
        });
      }

      return repaired;
    } catch (error) {
      LoggerWrapper.error(LogCategory.COMBAT, `Failed to repair entity ${entity.id}`, error as Error, {
        entityId: entity.id,
        healthAmount: healthAmount,
        shieldAmount: shieldAmount
      });
      return false;
    }
  }
}