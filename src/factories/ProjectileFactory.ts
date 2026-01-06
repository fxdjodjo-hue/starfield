import { ECS } from '../infrastructure/ecs/ECS';
import { Entity } from '../infrastructure/ecs/Entity';
import { Transform } from '../entities/spatial/Transform';
import { Projectile } from '../entities/combat/Projectile';
import { GAME_CONSTANTS } from '../config/GameConstants';
import { calculateDirection } from '../utils/MathUtils';

/**
 * Factory per creare proiettili senza duplicazioni
 */
export class ProjectileFactory {
  /**
   * Crea un proiettile con tutti i componenti necessari
   */
  static createProjectile(
    ecs: ECS,
    damage: number,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    ownerId: number,
    targetId: number,
    playerId?: string
  ): Entity {
    // Calcola direzione usando utility centralizzata
    const { direction } = calculateDirection(startX, startY, targetX, targetY);

    // Applica offset dalla posizione di partenza
    const spawnX = startX + direction.x * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET;
    const spawnY = startY + direction.y * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET;

    // Crea entità proiettile
    const entity = ecs.createEntity();

    // Componente Transform
    const transform = new Transform(spawnX, spawnY, 0, 1, 1);
    ecs.addComponent(entity, Transform, transform);

    // Componente Projectile
    const projectile = new Projectile(
      damage,
      GAME_CONSTANTS.PROJECTILE.SPEED,
      direction.x,
      direction.y,
      ownerId,
      targetId,
      GAME_CONSTANTS.PROJECTILE.LIFETIME,
      playerId
    );
    ecs.addComponent(entity, Projectile, projectile);

    return entity;
  }

  /**
   * Crea un proiettile da parametri esistenti (per retrocompatibilità)
   */
  static createProjectileFromParams(
    ecs: ECS,
    damage: number,
    speed: number,
    directionX: number,
    directionY: number,
    startX: number,
    startY: number,
    ownerId: number,
    targetId: number,
    lifetime?: number,
    playerId?: string
  ): Entity {
    const entity = ecs.createEntity();

    const transform = new Transform(startX, startY, 0, 1, 1);
    ecs.addComponent(entity, Transform, transform);

    const projectile = new Projectile(
      damage,
      speed,
      directionX,
      directionY,
      ownerId,
      targetId,
      lifetime || GAME_CONSTANTS.PROJECTILE.LIFETIME,
      playerId
    );
    ecs.addComponent(entity, Projectile, projectile);

    return entity;
  }
}
