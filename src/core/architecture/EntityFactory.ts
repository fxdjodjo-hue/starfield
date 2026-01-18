/**
 * EntityFactory migliorato - Factory centralizzata con metodi helper comuni
 * Estende e migliora EntityFactory esistente con pattern consolidati
 */

import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { PlayerStats } from '../../entities/player/PlayerStats';
import { PlayerUpgrades } from '../../entities/player/PlayerUpgrades';
import { SkillPoints } from '../../entities/currency/SkillPoints';
import { Credits } from '../../entities/currency/Credits';
import { Cosmos } from '../../entities/currency/Cosmos';
import { Experience } from '../../entities/currency/Experience';
import { Honor } from '../../entities/currency/Honor';
import { ActiveQuest } from '../../entities/quest/ActiveQuest';
import { ComponentHelper } from '../data/ComponentHelper';
import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';
import { InputValidator } from '../utils/InputValidator';

export interface BaseEntityConfig {
  position?: { x: number; y: number; rotation?: number };
  velocity?: { x: number; y: number };
  sprite?: Sprite | AnimatedSprite;
  interpolation?: boolean;
}

export interface CombatEntityConfig {
  health?: { current: number; max: number } | number;
  shield?: { current: number; max: number } | number;
  damage?: { value: number; range?: number; cooldown?: number } | number;
}

export interface ProgressionEntityConfig {
  stats?: { kills?: number; deaths?: number; missionsCompleted?: number; playTime?: number };
  upgrades?: { hpUpgrades?: number; shieldUpgrades?: number; speedUpgrades?: number; damageUpgrades?: number };
  skillPoints?: number;
  credits?: number;
  cosmos?: number;
  experience?: number;
  honor?: number;
}

export interface FullEntityConfig extends BaseEntityConfig, CombatEntityConfig, ProgressionEntityConfig {
  quests?: boolean; // Se abilitare sistema quest
}

export class EntityFactory {
  constructor(private ecs: ECS) {}

  /**
   * Crea un'entità con configurazione completa (metodo helper principale)
   */
  createEntity(config: FullEntityConfig): Entity {
    try {
      const entity = this.ecs.createEntity();

      // Aggiungi componenti base
      if (config.position) {
        this.addSpatialComponents(entity, config.position, config.velocity, config.sprite, config.interpolation);
      }

      // Aggiungi componenti di combattimento
      if (config.health || config.shield || config.damage) {
        this.addCombatComponents(entity, {
          health: config.health,
          shield: config.shield,
          damage: config.damage
        });
      }

      // Aggiungi componenti di progresso
      if (config.stats || config.upgrades || config.skillPoints !== undefined ||
          config.credits !== undefined || config.cosmos !== undefined ||
          config.experience !== undefined || config.honor !== undefined) {
        this.addProgressionComponents(entity, {
          stats: config.stats,
          upgrades: config.upgrades,
          skillPoints: config.skillPoints,
          credits: config.credits,
          cosmos: config.cosmos,
          experience: config.experience,
          honor: config.honor
        });
      }

      // Sistema quest se richiesto
      if (config.quests) {
        this.addQuestComponents(entity);
      }

      LoggerWrapper.ecs('Entity created with full configuration', {
        entityId: entity.id,
        hasSpatial: !!config.position,
        hasCombat: !!(config.health || config.shield || config.damage),
        hasProgression: !!(config.stats || config.upgrades || config.skillPoints !== undefined)
      });

      return entity;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, 'Failed to create entity with full configuration', error as Error, {
        config
      });
      throw error;
    }
  }

  /**
   * Aggiunge componenti spaziali (Transform, Velocity, Sprite, Interpolation)
   * Metodo helper comune per tutte le entità
   */
  addSpatialComponents(
    entity: Entity,
    position: { x: number; y: number; rotation?: number },
    velocity?: { x: number; y: number },
    sprite?: Sprite | AnimatedSprite,
    enableInterpolation: boolean = true
  ): void {
    try {
      // Validazione input
      const positionValidation = InputValidator.validateCoordinates(position.x, position.y);
      if (!positionValidation.isValid) {
        throw new Error(`Invalid position: ${positionValidation.error}`);
      }

      // Transform component (sempre presente)
      const rotation = position.rotation || 0;
      this.ecs.addComponent(entity, Transform, new Transform(
        position.x, position.y, rotation, 1, 1
      ));

      // Velocity component (opzionale)
      if (velocity) {
        const velocityValidation = InputValidator.validateVelocity(velocity.x, velocity.y);
        if (!velocityValidation.isValid) {
          LoggerWrapper.warn(LogCategory.ECS, `Invalid velocity for entity ${entity.id}, using zero velocity`, {
            entityId: entity.id,
            velocity,
            error: velocityValidation.error
          });
        } else {
          this.ecs.addComponent(entity, Velocity, new Velocity(velocity.x, velocity.y, 0));
        }
      }

      // Sprite/AnimatedSprite component (opzionale)
      if (sprite) {
        if (sprite instanceof AnimatedSprite) {
          this.ecs.addComponent(entity, AnimatedSprite, sprite);
        } else {
          this.ecs.addComponent(entity, Sprite, sprite);
        }
      }

      // Interpolation component (per movimenti fluidi)
      if (enableInterpolation) {
        this.ecs.addComponent(entity, InterpolationTarget, new InterpolationTarget(
          position.x, position.y, rotation
        ));
      }

      LoggerWrapper.ecs('Spatial components added to entity', {
        entityId: entity.id,
        position: { x: position.x, y: position.y, rotation },
        hasVelocity: !!velocity,
        hasSprite: !!sprite,
        hasInterpolation: enableInterpolation
      });
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, 'Failed to add spatial components', error as Error, {
        entityId: entity.id,
        position,
        velocity,
        hasSprite: !!sprite
      });
      throw error;
    }
  }

  /**
   * Aggiunge componenti di combattimento (Health, Shield, Damage)
   * Metodo helper comune per entità combattenti
   */
  addCombatComponents(entity: Entity, config: CombatEntityConfig): void {
    try {
      // Health component
      if (config.health !== undefined) {
        const healthValue = typeof config.health === 'number' ? config.health : config.health.current;
        const healthMax = typeof config.health === 'number' ? config.health : config.health.max;

        const healthValidation = InputValidator.validateStat(healthValue, 'health', 100000);
        const maxHealthValidation = InputValidator.validateStat(healthMax, 'maxHealth', 100000);

        if (!healthValidation.isValid || !maxHealthValidation.isValid) {
          throw new Error(`Invalid health config: ${healthValidation.error || maxHealthValidation.error}`);
        }

        this.ecs.addComponent(entity, Health, new Health(healthValue, healthMax));
      }

      // Shield component
      if (config.shield !== undefined) {
        const shieldValue = typeof config.shield === 'number' ? config.shield : config.shield.current;
        const shieldMax = typeof config.shield === 'number' ? config.shield : config.shield.max;

        const shieldValidation = InputValidator.validateStat(shieldValue, 'shield', 100000);
        const maxShieldValidation = InputValidator.validateStat(shieldMax, 'maxShield', 100000);

        if (!shieldValidation.isValid || !maxShieldValidation.isValid) {
          throw new Error(`Invalid shield config: ${shieldValidation.error || maxShieldValidation.error}`);
        }

        this.ecs.addComponent(entity, Shield, new Shield(shieldValue, shieldMax));
      }

      // Damage component
      if (config.damage !== undefined) {
        const damageValue = typeof config.damage === 'number' ? config.damage : config.damage.value;
        const range = typeof config.damage === 'object' ? config.damage.range : undefined;
        const cooldown = typeof config.damage === 'object' ? config.damage.cooldown : undefined;

        const damageValidation = InputValidator.validateStat(damageValue, 'damage', 10000);
        if (!damageValidation.isValid) {
          throw new Error(`Invalid damage config: ${damageValidation.error}`);
        }

        this.ecs.addComponent(entity, Damage, new Damage(
          damageValue,
          range || 0,
          cooldown || 1000
        ));
      }

      LoggerWrapper.ecs('Combat components added to entity', {
        entityId: entity.id,
        hasHealth: config.health !== undefined,
        hasShield: config.shield !== undefined,
        hasDamage: config.damage !== undefined
      });
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, 'Failed to add combat components', error as Error, {
        entityId: entity.id,
        config
      });
      throw error;
    }
  }

  /**
   * Aggiunge componenti di progresso (stats, upgrades, risorse)
   * Metodo helper per entità con sistema di progresso
   */
  addProgressionComponents(entity: Entity, config: ProgressionEntityConfig): void {
    try {
      // PlayerStats component
      if (config.stats) {
        this.ecs.addComponent(entity, PlayerStats, new PlayerStats(
          config.stats.kills || 0,
          config.stats.deaths || 0,
          config.stats.missionsCompleted || 0,
          config.stats.playTime || 0
        ));
      }

      // PlayerUpgrades component
      if (config.upgrades) {
        const upgrades = new PlayerUpgrades();
        upgrades.setUpgrades(
          config.upgrades.hpUpgrades || 0,
          config.upgrades.shieldUpgrades || 0,
          config.upgrades.speedUpgrades || 0,
          config.upgrades.damageUpgrades || 0
        );
        this.ecs.addComponent(entity, PlayerUpgrades, upgrades);
      }

      // SkillPoints component
      if (config.skillPoints !== undefined) {
        const skillPointsValidation = InputValidator.validateStat(config.skillPoints, 'skillPoints', 10000);
        if (!skillPointsValidation.isValid) {
          LoggerWrapper.warn(LogCategory.ECS, `Invalid skillPoints for entity ${entity.id}`, {
            entityId: entity.id,
            skillPoints: config.skillPoints,
            error: skillPointsValidation.error
          });
        } else {
          this.ecs.addComponent(entity, SkillPoints, new SkillPoints(config.skillPoints));
        }
      }

      // Economic resources
      if (config.credits !== undefined) {
        const creditsValidation = InputValidator.validateStat(config.credits, 'credits', 10000000);
        if (creditsValidation.isValid) {
          this.ecs.addComponent(entity, Credits, new Credits(config.credits));
        }
      }

      if (config.cosmos !== undefined) {
        const cosmosValidation = InputValidator.validateStat(config.cosmos, 'cosmos', 10000000);
        if (cosmosValidation.isValid) {
          this.ecs.addComponent(entity, Cosmos, new Cosmos(config.cosmos));
        }
      }

      if (config.experience !== undefined) {
        const experienceValidation = InputValidator.validateStat(config.experience, 'experience', 10000000);
        if (experienceValidation.isValid) {
          this.ecs.addComponent(entity, Experience, new Experience(config.experience));
        }
      }

      if (config.honor !== undefined) {
        const honorValidation = InputValidator.validateStat(config.honor, 'honor', 10000000);
        if (honorValidation.isValid) {
          this.ecs.addComponent(entity, Honor, new Honor(config.honor));
        }
      }

      LoggerWrapper.ecs('Progression components added to entity', {
        entityId: entity.id,
        hasStats: !!config.stats,
        hasUpgrades: !!config.upgrades,
        hasSkillPoints: config.skillPoints !== undefined,
        resourceCount: [config.credits, config.cosmos, config.experience, config.honor].filter(r => r !== undefined).length
      });
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, 'Failed to add progression components', error as Error, {
        entityId: entity.id,
        config
      });
      throw error;
    }
  }

  /**
   * Aggiunge componenti quest
   */
  addQuestComponents(entity: Entity): void {
    try {
      this.ecs.addComponent(entity, ActiveQuest, new ActiveQuest());
      LoggerWrapper.ecs('Quest components added to entity', { entityId: entity.id });
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, 'Failed to add quest components', error as Error, {
        entityId: entity.id
      });
      throw error;
    }
  }

  /**
   * Crea un'entità semplice con solo componenti base
   */
  createSimpleEntity(
    x: number = 0,
    y: number = 0,
    rotation: number = 0
  ): Entity {
    return this.createEntity({
      position: { x, y, rotation }
    });
  }

  /**
   * Crea un'entità statica (senza velocity, per decorazioni)
   */
  createStaticEntity(
    x: number,
    y: number,
    sprite?: Sprite | AnimatedSprite
  ): Entity {
    return this.createEntity({
      position: { x, y, rotation: 0 },
      sprite,
      interpolation: false
    });
  }

  /**
   * Valida configurazione entità prima della creazione
   */
  validateEntityConfig(config: FullEntityConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.position) {
      const posValidation = InputValidator.validatePosition(
        config.position.x,
        config.position.y,
        config.position.rotation
      );
      if (!posValidation.isValid) {
        errors.push(`Position: ${posValidation.error}`);
      }
    }

    if (config.velocity) {
      const velValidation = InputValidator.validateVelocity(config.velocity.x, config.velocity.y);
      if (!velValidation.isValid) {
        errors.push(`Velocity: ${velValidation.error}`);
      }
    }

    // Validazione altre proprietà...

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clona un'entità esistente (shallow copy dei componenti)
   */
  cloneEntity(sourceEntity: Entity, offset?: { x: number; y: number }): Entity {
    try {
      const position = ComponentHelper.getPosition(this.ecs, sourceEntity);
      if (!position) {
        throw new Error('Source entity has no position');
      }

      const newX = offset ? position.x + offset.x : position.x;
      const newY = offset ? position.y + offset.y : position.y;

      // Per ora crea entità semplice, in futuro potrebbe copiare tutti i componenti
      const clonedEntity = this.createSimpleEntity(newX, newY);

      LoggerWrapper.ecs('Entity cloned', {
        sourceEntityId: sourceEntity.id,
        clonedEntityId: clonedEntity.id,
        offset
      });

      return clonedEntity;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, 'Failed to clone entity', error as Error, {
        sourceEntityId: sourceEntity.id,
        offset
      });
      throw error;
    }
  }
}