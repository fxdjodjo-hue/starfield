/**
 * ProjectileFactory - Factory centralizzata per tutti i tipi di proiettili
 * Estende e unifica il ProjectileFactory esistente con tutti i sistemi di creazione
 */

import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Projectile } from '../../entities/combat/Projectile';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { MathUtils } from '../utils/MathUtils';
import { IDGenerator } from '../utils/IDGenerator';
import { InputValidator } from '../utils/InputValidator';
import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';

export interface ProjectileConfig {
  damage: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  ownerId: number;
  targetId: number;
  playerId?: string;
  animatedSprite?: AnimatedSprite;
  shipRotation?: number;
  projectileType?: 'laser' | 'missile';
  isRemote?: boolean; // Per proiettili ricevuti dal server
  velocity?: { x: number; y: number }; // Per remote projectiles
  speed?: number; // Override velocità
  lifetime?: number; // Override lifetime
}

export class ProjectileFactory {
  /**
   * Crea un proiettile completo con tutti i componenti necessari
   * Unifica createProjectile, createSingleProjectile, createProjectileAt
   */
  static create(ecs: ECS, config: ProjectileConfig): Entity {
    try {
      const projectileId = IDGenerator.generateProjectileId(String(config.ownerId));

      // Calcola direzione e posizione di spawn
      const { direction, distance } = MathUtils.calculateDirection(
        config.startX, config.startY, config.targetX, config.targetY
      );

      let spawnX: number;
      let spawnY: number;

      // Calcola punto di spawn basato su nave o offset fisso
      if (config.animatedSprite && config.shipRotation !== undefined) {
        // Usa punto di spawn dalla nave (punta anteriore)
        const spawnPoint = config.animatedSprite.getWeaponSpawnPointWorld(
          config.startX, config.startY, config.shipRotation, 0.4
        );
        spawnX = spawnPoint.x;
        spawnY = spawnPoint.y;
      } else {
        // Fallback: offset fisso dalla posizione di partenza
        const offset = GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET;
        spawnX = config.startX + direction.x * offset;
        spawnY = config.startY + direction.y * offset;
      }

      // Crea entità proiettile
      const entity = ecs.createEntity();

      // Componente Transform
      const transform = new Transform(spawnX, spawnY, 0, 1, 1);
      ecs.addComponent(entity, Transform, transform);

      // Componente Velocity (se fornito da server o calcolato)
      if (config.velocity) {
        ecs.addComponent(entity, Velocity, new Velocity(config.velocity.x, config.velocity.y, 0));
      } else {
        const projectileSpeed = config.speed ||
          (config.projectileType === 'missile' ? GAME_CONSTANTS.MISSILE.SPEED : GAME_CONSTANTS.PROJECTILE.SPEED);
        ecs.addComponent(entity, Velocity, new Velocity(
          direction.x * projectileSpeed,
          direction.y * projectileSpeed,
          0
        ));
      }

      // Componente Projectile
      const projectileLifetime = config.lifetime ||
        (config.projectileType === 'missile' ? GAME_CONSTANTS.MISSILE.LIFETIME : GAME_CONSTANTS.PROJECTILE.LIFETIME);

      // Per missili, usa danno dummy lato client - il danno reale è calcolato dal server
      const projectileDamage = (config.projectileType === 'missile' && !config.isRemote) ? 0 : config.damage;

      const projectile = new Projectile(
        projectileDamage,
        config.speed || GAME_CONSTANTS.PROJECTILE.SPEED,
        direction.x,
        direction.y,
        config.ownerId,
        config.targetId,
        projectileLifetime,
        config.playerId,
        config.projectileType || 'laser'
      );
      ecs.addComponent(entity, Projectile, projectile);

      // Per proiettili remoti, aggiungi interpolazione per movimento fluido
      if (config.isRemote) {
        ecs.addComponent(entity, InterpolationTarget, new InterpolationTarget(spawnX, spawnY, 0));
      }

      // Assegna ID al componente projectile per riferimento
      (projectile as any).id = projectileId;

      LoggerWrapper.combat(`Projectile ${projectileId} created: type=${config.projectileType}, damage=${projectileDamage}`, {
        projectileId: projectileId,
        ownerId: config.ownerId,
        targetId: config.targetId,
        position: { x: spawnX, y: spawnY },
        projectileType: config.projectileType,
        isRemote: config.isRemote
      });

      return entity;

    } catch (error) {
      LoggerWrapper.error(LogCategory.COMBAT, 'Failed to create projectile', error as Error, {
        config: config
      });
      throw error;
    }
  }

  /**
   * Crea proiettile laser semplice (sostituisce createSingleProjectile)
   */
  static createLaser(
    ecs: ECS,
    damage: number,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    ownerId: number,
    targetId: number,
    playerId?: string,
    animatedSprite?: AnimatedSprite,
    shipRotation?: number
  ): Entity {
    return this.create(ecs, {
      damage,
      startX,
      startY,
      targetX,
      targetY,
      ownerId,
      targetId,
      playerId,
      animatedSprite,
      shipRotation,
      projectileType: 'laser'
    });
  }

  /**
   * Crea missile (sostituisce createMissileAt)
   */
  static createMissile(
    ecs: ECS,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    ownerId: number,
    targetId: number,
    playerId?: string,
    animatedSprite?: AnimatedSprite,
    shipRotation?: number
  ): Entity {
    return this.create(ecs, {
      damage: 0, // Danno dummy lato client
      startX,
      startY,
      targetX,
      targetY,
      ownerId,
      targetId,
      playerId,
      animatedSprite,
      shipRotation,
      projectileType: 'missile'
    });
  }

  /**
   * Crea proiettile remoto ricevuto dal server (sostituisce addRemoteProjectile)
   */
  static createRemoteProjectile(
    ecs: ECS,
    projectileId: string,
    playerId: string,
    position: { x: number; y: number },
    velocity: { x: number; y: number },
    damage: number,
    projectileType: string = 'laser',
    targetId?: string | number,
    ownerId?: number,
    actualTargetId?: number
  ): Entity {
    // Calcola direzione dalla velocità
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    const directionX = speed > 0 ? velocity.x / speed : 0;
    const directionY = speed > 0 ? velocity.y / speed : 0;

    const entity = ecs.createEntity();

    // Componenti spaziali
    ecs.addComponent(entity, Transform, new Transform(position.x, position.y, 0));
    ecs.addComponent(entity, Velocity, new Velocity(velocity.x, velocity.y, 0));
    ecs.addComponent(entity, InterpolationTarget, new InterpolationTarget(position.x, position.y, 0));

    // Componente Projectile
    const projectile = new Projectile(
      damage,
      speed,
      directionX,
      directionY,
      ownerId || entity.id,
      actualTargetId || -1,
      GAME_CONSTANTS.PROJECTILE.LIFETIME,
      playerId,
      projectileType as 'laser' | 'missile'
    );
    ecs.addComponent(entity, Projectile, projectile);

    // Assegna ID
    (projectile as any).id = projectileId;

    LoggerWrapper.network(`Remote projectile ${projectileId} created`, {
      projectileId: projectileId,
      playerId: playerId,
      position: position,
      projectileType: projectileType
    });

    return entity;
  }

  /**
   * Crea proiettile in posizione e direzione specifica (sostituisce createProjectileAt)
   */
  static createAtPosition(
    ecs: ECS,
    damage: number,
    spawnX: number,
    spawnY: number,
    directionX: number,
    directionY: number,
    ownerId: number,
    targetId: number,
    playerId?: string,
    projectileType: 'laser' | 'missile' = 'laser'
  ): Entity {
    const projectileId = IDGenerator.generateProjectileId(String(ownerId));

    const entity = ecs.createEntity();

    // Componente Transform
    ecs.addComponent(entity, Transform, new Transform(spawnX, spawnY, 0, 1, 1));

    // Calcola velocità
    const speed = projectileType === 'missile' ? GAME_CONSTANTS.MISSILE.SPEED : GAME_CONSTANTS.PROJECTILE.SPEED;
    ecs.addComponent(entity, Velocity, new Velocity(
      directionX * speed,
      directionY * speed,
      0
    ));

    // Componente Projectile
    const lifetime = projectileType === 'missile' ? GAME_CONSTANTS.MISSILE.LIFETIME : GAME_CONSTANTS.PROJECTILE.LIFETIME;
    const projectileDamage = projectileType === 'missile' ? 0 : damage;

    const projectile = new Projectile(
      projectileDamage,
      speed,
      directionX,
      directionY,
      ownerId,
      targetId,
      lifetime,
      playerId,
      projectileType
    );
    ecs.addComponent(entity, Projectile, projectile);

    // Assegna ID
    (projectile as any).id = projectileId;

    return entity;
  }

  /**
   * Valida configurazione proiettile prima della creazione
   */
  static validateConfig(config: ProjectileConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.damage && config.damage !== 0) {
      errors.push('Damage is required');
    }

    const startPosValidation = InputValidator.validateCoordinates(config.startX, config.startY);
    if (!startPosValidation.isValid) {
      errors.push(`Invalid start position: ${startPosValidation.error}`);
    }

    const targetPosValidation = InputValidator.validateCoordinates(config.targetX, config.targetY);
    if (!targetPosValidation.isValid) {
      errors.push(`Invalid target position: ${targetPosValidation.error}`);
    }

    if (!config.ownerId && config.ownerId !== 0) {
      errors.push('OwnerId is required');
    }

    if (!config.targetId && config.targetId !== 0) {
      errors.push('TargetId is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}