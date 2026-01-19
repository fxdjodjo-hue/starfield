/**
 * EntityStateSystem - Sistema centralizzato per aggiornamenti stato entità
 * Unifica tutti gli aggiornamenti di posizione, health, shield, behavior per entità remote
 */

import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { ComponentHelper } from '../data/ComponentHelper';
import { InputValidator } from '../utils/InputValidator';
import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';
import { Npc } from '../../entities/ai/Npc';
import { DamageTaken } from '../../entities/combat/DamageTaken';

export interface PositionUpdate {
  x?: number;
  y?: number;
  rotation?: number;
}

export interface HealthUpdate {
  current?: number;
  max?: number;
}

export interface ShieldUpdate {
  current?: number;
  max?: number;
}

export interface BehaviorUpdate {
  behavior?: string;
  targetId?: string;
  state?: string;
}

export interface EntityStateUpdate {
  position?: PositionUpdate;
  health?: HealthUpdate;
  shield?: ShieldUpdate;
  behavior?: BehaviorUpdate;
  velocity?: { x: number; y: number };
}

export class EntityStateSystem {
  /**
   * Aggiorna lo stato completo di un'entità remota
   * Sostituisce updateRemoteNpc, updatePlayerStats, updateRemoteProjectile
   */
  static updateEntityState(
    ecs: ECS,
    entity: Entity,
    update: EntityStateUpdate,
    source: string = 'server'
  ): boolean {
    try {
      let hasChanges = false;

      // Aggiorna posizione con interpolazione se disponibile
      if (update.position) {
        hasChanges = this.updatePosition(ecs, entity, update.position, source) || hasChanges;
      }

      // Aggiorna salute
      if (update.health) {
        hasChanges = this.updateHealth(ecs, entity, update.health, source) || hasChanges;
      }

      // Aggiorna scudo
      if (update.shield) {
        hasChanges = this.updateShield(ecs, entity, update.shield, source) || hasChanges;
      }

      // Aggiorna comportamento (per NPC)
      if (update.behavior) {
        hasChanges = this.updateBehavior(ecs, entity, update.behavior, source) || hasChanges;
      }

      // Aggiorna velocità
      if (update.velocity) {
        hasChanges = this.updateVelocity(ecs, entity, update.velocity, source) || hasChanges;
      }

      if (hasChanges) {
        LoggerWrapper.ecs(`Entity ${entity.id} state updated from ${source}`, {
          entityId: entity.id,
          update: update,
          source: source
        });
      }

      return hasChanges;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to update entity ${entity.id} state`, error as Error, {
        entityId: entity.id,
        update: update,
        source: source
      });
      return false;
    }
  }

  /**
   * Aggiorna posizione con interpolazione
   */
  private static updatePosition(
    ecs: ECS,
    entity: Entity,
    position: PositionUpdate,
    source: string
  ): boolean {
    try {
      const currentPosition = ComponentHelper.getPosition(ecs, entity);
      if (!currentPosition) return false;

      const newX = position.x ?? currentPosition.x;
      const newY = position.y ?? currentPosition.y;
      const newRotation = position.rotation ?? ComponentHelper.getRotation(ecs, entity) ?? 0;

      // Aggiorna posizione base
      ComponentHelper.updatePosition(ecs, entity, newX, newY, newRotation);

      // Implementa interpolazione per movimenti fluidi (NPC e remote entities)
      const interpolationTarget = ecs.getComponent(entity, InterpolationTarget);
      if (interpolationTarget) {
        interpolationTarget.updateTarget(newX, newY, newRotation);
      }

      LoggerWrapper.ecs(`Entity ${entity.id} position updated: (${newX.toFixed(1)}, ${newY.toFixed(1)}) rot:${newRotation.toFixed(1)}`, {
        entityId: entity.id,
        position: { x: newX, y: newY, rotation: newRotation },
        source: source
      });

      return true;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to update position for entity ${entity.id}`, error as Error, {
        entityId: entity.id,
        position: position,
        source: source
      });
      return false;
    }
  }

  /**
   * Aggiorna salute
   */
  private static updateHealth(
    ecs: ECS,
    entity: Entity,
    health: HealthUpdate,
    source: string
  ): boolean {
    try {
      const currentHealth = ComponentHelper.getHealthStats(ecs, entity);
      if (!currentHealth) return false;

      const newCurrent = health.current ?? currentHealth.current;
      const newMax = health.max ?? currentHealth.max;

      ComponentHelper.updateHealth(ecs, entity, newCurrent, newMax);

      // Registra danno subito se la health è diminuita (per comportamenti AI reattivi)
      if (newCurrent < currentHealth.current) {
        let damageTaken = ecs.getComponent(entity, DamageTaken);
        if (!damageTaken) {
          damageTaken = new DamageTaken();
          ecs.addComponent(entity, DamageTaken, damageTaken);
          console.log(`[DAMAGE] Aggiunto componente DamageTaken all'entità ${entity.id} (health damage)`);
        }
        damageTaken.takeDamage(Date.now());
      }

      // Log solo se i valori sono effettivamente cambiati o se è un aggiornamento non-server
      if (newCurrent !== currentHealth.current || newMax !== currentHealth.max || source !== 'server') {
        LoggerWrapper.combat(`Entity ${entity.id} health updated: ${newCurrent}/${newMax}`, {
          entityId: entity.id,
          health: { current: newCurrent, max: newMax },
          source: source
        });
      }

      return true;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to update health for entity ${entity.id}`, error as Error, {
        entityId: entity.id,
        health: health,
        source: source
      });
      return false;
    }
  }

  /**
   * Aggiorna scudo
   */
  private static updateShield(
    ecs: ECS,
    entity: Entity,
    shield: ShieldUpdate,
    source: string
  ): boolean {
    try {
      const currentShield = ComponentHelper.getShieldStats(ecs, entity);
      if (!currentShield) return false;

      const newCurrent = shield.current ?? currentShield.current;
      const newMax = shield.max ?? currentShield.max;

      ComponentHelper.updateShield(ecs, entity, newCurrent, newMax);

      // Registra danno subito se lo shield è diminuito (per comportamenti AI reattivi)
      if (newCurrent < currentShield.current) {
        let damageTaken = ecs.getComponent(entity, DamageTaken);
        if (!damageTaken) {
          damageTaken = new DamageTaken();
          ecs.addComponent(entity, DamageTaken, damageTaken);
          console.log(`[DAMAGE] Aggiunto componente DamageTaken all'entità ${entity.id} (shield damage)`);
        }
        damageTaken.takeDamage(Date.now());
      }

      // Log solo se i valori sono effettivamente cambiati o se è un aggiornamento non-server
      if (newCurrent !== currentShield.current || newMax !== currentShield.max || source !== 'server') {
        LoggerWrapper.combat(`Entity ${entity.id} shield updated: ${newCurrent}/${newMax}`, {
          entityId: entity.id,
          shield: { current: newCurrent, max: newMax },
          source: source
        });
      }

      return true;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to update shield for entity ${entity.id}`, error as Error, {
        entityId: entity.id,
        shield: shield,
        source: source
      });
      return false;
    }
  }

  /**
   * Aggiorna comportamento (per NPC)
   */
  private static updateBehavior(
    ecs: ECS,
    entity: Entity,
    behavior: BehaviorUpdate,
    source: string
  ): boolean {
    try {
      const npcComponent = ecs.getComponent(entity, Npc);
      if (npcComponent && behavior.behavior) {
        // Salva il comportamento precedente per il log
        const oldBehavior = npcComponent.behavior;

        // Aggiorna il comportamento dell'NPC
        npcComponent.setBehavior(behavior.behavior);

        LoggerWrapper.ai(`Entity ${entity.id} behavior updated to ${behavior.behavior}`, {
          entityId: entity.id,
          oldBehavior: oldBehavior,
          newBehavior: behavior.behavior,
          source: source
        });

        return true;
      }

      LoggerWrapper.ai(`Entity ${entity.id} behavior update skipped - no Npc component or behavior`, {
        entityId: entity.id,
        behavior: behavior.behavior || 'undefined',
        source: source
      });

      return false;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to update behavior for entity ${entity.id}`, error as Error, {
        entityId: entity.id,
        behavior: behavior,
        source: source
      });
      return false;
    }
  }

  /**
   * Aggiorna velocità
   */
  private static updateVelocity(
    ecs: ECS,
    entity: Entity,
    velocity: { x: number; y: number },
    source: string
  ): boolean {
    try {
      // TODO: Implementare quando avremo il componente Velocity
      // const velocityComponent = ecs.getComponent(entity, Velocity);
      // if (velocityComponent) {
      //   velocityComponent.x = velocity.x;
      //   velocityComponent.y = velocity.y;
      // }

      LoggerWrapper.ecs(`Entity ${entity.id} velocity updated: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)})`, {
        entityId: entity.id,
        velocity: velocity,
        source: source
      });

      return true;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to update velocity for entity ${entity.id}`, error as Error, {
        entityId: entity.id,
        velocity: velocity,
        source: source
      });
      return false;
    }
  }

  /**
   * Sincronizza stato completo da server (per join/initial sync)
   */
  static syncEntityState(
    ecs: ECS,
    entity: Entity,
    fullState: {
      position: { x: number; y: number; rotation: number };
      health: { current: number; max: number };
      shield: { current: number; max: number };
      behavior?: string;
      velocity?: { x: number; y: number };
    }
  ): boolean {
    try {
      const update: EntityStateUpdate = {
        position: fullState.position,
        health: fullState.health,
        shield: fullState.shield,
        velocity: fullState.velocity,
        behavior: fullState.behavior ? { behavior: fullState.behavior } : undefined
      };

      const success = this.updateEntityState(ecs, entity, update, 'server_sync');

      if (success) {
        LoggerWrapper.ecs(`Entity ${entity.id} full state synchronized`, {
          entityId: entity.id,
          fullState: fullState
        });
      }

      return success;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to sync entity ${entity.id} state`, error as Error, {
        entityId: entity.id,
        fullState: fullState
      });
      return false;
    }
  }

  /**
   * Valida aggiornamenti di stato prima dell'applicazione
   */
  static validateStateUpdate(update: EntityStateUpdate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (update.position) {
      if (update.position.x !== undefined || update.position.y !== undefined) {
        const positionValidation = InputValidator.validatePosition(
          update.position.x,
          update.position.y,
          update.position.rotation
        );
        if (!positionValidation.isValid) {
          errors.push(`Invalid position: ${positionValidation.error}`);
        }
      }
    }

    if (update.health) {
      if (update.health.current !== undefined && (isNaN(update.health.current) || update.health.current < 0)) {
        errors.push('Invalid health.current');
      }
      if (update.health.max !== undefined && (isNaN(update.health.max) || update.health.max <= 0)) {
        errors.push('Invalid health.max');
      }
    }

    if (update.shield) {
      if (update.shield.current !== undefined && (isNaN(update.shield.current) || update.shield.current < 0)) {
        errors.push('Invalid shield.current');
      }
      if (update.shield.max !== undefined && (isNaN(update.shield.max) || update.shield.max < 0)) {
        errors.push('Invalid shield.max');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}