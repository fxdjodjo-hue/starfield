/**
 * ProjectileFactory - Factory centralizzata per tutti i tipi di proiettili
 * Estende e unifica il ProjectileFactory esistente con tutti i sistemi di creazione
 */

import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Projectile } from '../../entities/combat/Projectile';
import { ProjectileVisualState, VisualFadeState } from '../../entities/combat/ProjectileVisualState';
import { RenderLayer } from '../../core/utils/rendering/RenderLayers';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { Sprite } from '../../entities/Sprite';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { MathUtils } from '../utils/MathUtils';
import { IDGenerator } from '../utils/IDGenerator';
import { InputValidator } from '../utils/InputValidator';
import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';
import { ProjectileLogger } from '../utils/ProjectileLogger';
import { AssetManager } from '../services/AssetManager';

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
  projectileType?: 'laser' | 'npc_laser';
  isRemote?: boolean; // Per proiettili ricevuti dal server
  velocity?: { x: number; y: number }; // Per remote projectiles
  speed?: number; // Override velocità
  lifetime?: number; // Override lifetime
  projectileId?: string; // ID specifico per remote projectiles
}

export class ProjectileFactory {
  /**
   * Crea un proiettile completo con tutti i componenti necessari
   * Unifica createProjectile, createSingleProjectile, createProjectileAt
   */
  static create(ecs: ECS, config: ProjectileConfig, assetManager?: AssetManager): Entity {
    console.log('[DEBUG_PROJECTILE] create() called with assetManager:', !!assetManager, 'config.isRemote:', config.isRemote);
    try {
      const projectileId = config.projectileId || IDGenerator.generateProjectileId(String(config.ownerId));

      // Calcola direzione e posizione di spawn
      const { direction, distance } = MathUtils.calculateDirection(
        config.startX, config.startY, config.targetX, config.targetY
      );

      LoggerWrapper.projectile('ProjectileFactory: calculated direction', {
        projectileId,
        start: { x: config.startX, y: config.startY },
        target: { x: config.targetX, y: config.targetY },
        direction,
        distance,
        targetId: config.targetId
      });

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
      const projectileRotation = config.shipRotation || 0;

      const transform = new Transform(spawnX, spawnY, projectileRotation, 1, 1);
      ecs.addComponent(entity, Transform, transform);

      // Componente Velocity (se fornito da server o calcolato)
      if (config.velocity) {
        ecs.addComponent(entity, Velocity, new Velocity(config.velocity.x, config.velocity.y, 0));
      } else {
        const projectileSpeed = config.speed ||
          (config.projectileType === 'laser' ? GAME_CONSTANTS.PROJECTILE.VISUAL_SPEED : // Laser visivi
            GAME_CONSTANTS.PROJECTILE.SPEED);
        ecs.addComponent(entity, Velocity, new Velocity(
          direction.x * projectileSpeed,
          direction.y * projectileSpeed,
          0
        ));
      }

      // Componente Projectile
      const projectileLifetime = config.lifetime || GAME_CONSTANTS.PROJECTILE.LIFETIME;

      const projectileDamage = config.damage;

      const projectile = new Projectile(
        projectileDamage,
        config.speed || GAME_CONSTANTS.PROJECTILE.SPEED,
        direction.x,
        direction.y,
        config.ownerId,
        config.targetId,
        projectileLifetime,
        config.playerId, // undefined per proiettili locali
        config.projectileType || 'laser'
      );
      ecs.addComponent(entity, Projectile, projectile);

      // Componente stato visivo - garantisce controllo esplicito su visibilità e layer
      const visualState = new ProjectileVisualState(
        true,  // active
        true,  // visible
        RenderLayer.PROJECTILES,  // layer
        1.0,  // alpha
        VisualFadeState.NONE,  // fadeState
        1.0   // fadeSpeed
      );
      ecs.addComponent(entity, ProjectileVisualState, visualState);

      // NOTA: I proiettili remoti NON usano InterpolationTarget perché si muovono 
      // autonomamente via Velocity. InterpolationTarget causerebbe il blocco del movimento
      // nel MovementSystem.

      // Per proiettili remoti laser, aggiungi componente Sprite per rendering visivo
      if (config.isRemote && (config.projectileType === 'laser' || config.projectileType === 'npc_laser')) {
        let image: HTMLImageElement | null = null;

        if (assetManager) {
          // Usa AssetManager per caricare l'immagine
          if (config.projectileType === 'laser') {
            // Laser del player
            image = assetManager.getOrLoadImage('assets/laser/laser1/laser1.png');
          } else {
            // Laser NPC - usa frigate come default
            image = assetManager.getOrLoadImage('assets/npc_ships/kronos/npc_frigate_projectile.png');
          }
        }

        console.log('[DEBUG_PROJECTILE] Adding Sprite component for remote projectile:', {
          projectileId: projectileId,
          projectileType: config.projectileType,
          hasAssetManager: !!assetManager,
          hasImage: !!image,
          imageSrc: image?.src,
          isRemote: config.isRemote
        });

        // Crea sprite con immagine caricata o null
        const sprite = new Sprite(image, 48, 12, 0, 0); // Dimensioni laser tipiche
        ecs.addComponent(entity, Sprite, sprite);

        console.log('[DEBUG_PROJECTILE] Sprite component added to entity:', entity.id);
      } else {
        console.log('[DEBUG_PROJECTILE] Not adding Sprite component:', {
          projectileId: projectileId,
          isRemote: config.isRemote,
          projectileType: config.projectileType
        });
      }

      // Assegna ID al componente projectile per riferimento
      (projectile as any).id = projectileId;

      // Logging centralizzato con ProjectileLogger
      ProjectileLogger.logCreation(projectileId, entity, 'ProjectileFactory', {
        position: { x: spawnX, y: spawnY },
        gameState: {
          damage: projectileDamage,
          speed: projectile.speed,
          lifetime: projectile.lifetime,
          ownerId: config.ownerId,
          targetId: config.targetId,
          projectileType: config.projectileType
        },
        visualState: {
          active: visualState.active,
          visible: visualState.visible,
          alpha: visualState.alpha,
          layer: visualState.layer,
          fadeState: visualState.fadeState
        }
      });

      // Projectile creation logging removed for production

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
      projectileType as 'laser' | 'npc_laser'
    );
    ecs.addComponent(entity, Projectile, projectile);

    // Componente stato visivo per proiettili remoti
    const visualState = new ProjectileVisualState(
      true,  // active
      true,  // visible
      RenderLayer.PROJECTILES,  // layer
      1.0,  // alpha
      VisualFadeState.NONE,  // fadeState
      1.0   // fadeSpeed
    );
    ecs.addComponent(entity, ProjectileVisualState, visualState);

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
   * Crea proiettile remoto con configurazione semplificata - UNIFICATO
   * Ora usa lo stesso flusso del create() normale
   */
  static createRemoteUnified(
    ecs: ECS,
    projectileId: string,
    playerId: string,
    position: { x: number; y: number },
    velocity: { x: number; y: number },
    damage: number,
    projectileType: string = 'laser',
    targetId?: string | number,
    ownerId?: number,
    assetManager?: AssetManager
  ): Entity {
    console.log('[DEBUG_PROJECTILE] createRemoteUnified called with assetManager:', !!assetManager);
    // Converti velocity in direction
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    const directionX = speed > 0 ? velocity.x / speed : 0;
    const directionY = speed > 0 ? velocity.y / speed : 0;

    // Converti targetId se necessario
    let numericTargetId = -1;
    if (targetId !== undefined && targetId !== null) {
      if (typeof targetId === 'string') {
        numericTargetId = parseInt(targetId, 10) || -1;
      } else {
        numericTargetId = targetId;
      }
    }

    const config: ProjectileConfig = {
      damage,
      startX: position.x,
      startY: position.y,
      targetX: position.x + directionX * 100, // Bersaglio fittizio per calcolo direzione
      targetY: position.y + directionY * 100,
      ownerId: ownerId || 0,
      targetId: numericTargetId,
      playerId,
      projectileType: projectileType as 'laser' | 'npc_laser',
      isRemote: true,
      velocity,
      speed,
      projectileId
    };

    return this.create(ecs, config, assetManager);
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
    projectileType: 'laser' | 'npc_laser' = 'laser'
  ): Entity {
    const projectileId = IDGenerator.generateProjectileId(String(ownerId));

    const entity = ecs.createEntity();

    // Componente Transform
    ecs.addComponent(entity, Transform, new Transform(spawnX, spawnY, 0, 1, 1));

    // Calcola velocità
    const speed = GAME_CONSTANTS.PROJECTILE.SPEED;
    ecs.addComponent(entity, Velocity, new Velocity(
      directionX * speed,
      directionY * speed,
      0
    ));

    // Componente Projectile
    const lifetime = GAME_CONSTANTS.PROJECTILE.LIFETIME;
    const projectileDamage = damage;

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

    // Componente stato visivo
    const visualState = new ProjectileVisualState(
      true,  // active
      true,  // visible
      RenderLayer.PROJECTILES,  // layer
      1.0,  // alpha
      VisualFadeState.NONE,  // fadeState
      1.0   // fadeSpeed
    );
    ecs.addComponent(entity, ProjectileVisualState, visualState);

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