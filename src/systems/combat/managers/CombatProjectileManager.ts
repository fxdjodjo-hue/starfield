import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Entity } from '../../../infrastructure/ecs/Entity';
import type { PlayerSystem } from '../../player/PlayerSystem';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { Damage } from '../../../entities/combat/Damage';
import { Projectile } from '../../../entities/combat/Projectile';
import { ProjectileFactory } from '../../../core/domain/ProjectileFactory';
import { GAME_CONSTANTS } from '../../../config/GameConstants';
import { calculateDirection } from '../../../utils/MathUtils';
import { Npc } from '../../../entities/ai/Npc';
import { MissileManager } from './MissileManager';
import { IDGenerator } from '../../../core/utils/IDGenerator';

/**
 * Manages projectile creation and attack execution
 * Simplified: no rhythmic patterns, just linear trajectories
 */
export class CombatProjectileManager {
  private missileManager: MissileManager;

  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem,
    private readonly getClientNetworkSystem: () => ClientNetworkSystem | null
  ) {
    // Initialize missile manager
    this.missileManager = new MissileManager(
      this.ecs,
      this.playerSystem,
      this.getClientNetworkSystem
    );
  }

  /**
   * Creates a single projectile (used by anyone)
   */
  createSingleProjectile(attackerEntity: Entity, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: Entity, directionX: number, directionY: number): void {
    this.createProjectileAt(attackerEntity, attackerTransform, attackerDamage.damage, directionX, directionY, targetEntity);
    attackerDamage.performAttack(Date.now());
  }

  /**
   * Creates a single projectile at a specific position and direction
   */
  createProjectileAt(attackerEntity: Entity, attackerTransform: Transform, damage: number, directionX: number, directionY: number, targetEntity: Entity): void {
    const projectileId = IDGenerator.generateProjectileId(attackerEntity.id.toString());

    // Calculate spawn position with simple offset
    const spawnX = attackerTransform.x + directionX * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET;
    const spawnY = attackerTransform.y + directionY * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET;

    // Create single projectile using ProjectileFactory
    const projectileEntity = ProjectileFactory.createLaser(
      this.ecs,
      damage,
      spawnX,
      spawnY,
      attackerTransform.x + directionX * 1000, // Far target for direction
      attackerTransform.y + directionY * 1000,
      attackerEntity.id,
      targetEntity.id,
      `owner_${attackerEntity.id}`,
      undefined, // No animated sprite needed for simple projectiles
      attackerTransform.rotation
    );

    // Set projectile ID
    const projectileComponent = this.ecs.getComponent(projectileEntity, Projectile);
    if (projectileComponent) {
      (projectileComponent as any).id = projectileId;
    }
  }

  /**
   * Rotates attacker entity to face target
   */
  faceTarget(attackerTransform: Transform, targetTransform: Transform): void {
    const dx = targetTransform.x - attackerTransform.x;
    const dy = targetTransform.y - attackerTransform.y;
    const angle = Math.atan2(dy, dx);
    attackerTransform.rotation = angle;
  }

  /**
   * Rotates NPC to face player
   */
  facePlayer(npcTransform: Transform, npcEntity: Entity): void {
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
      .filter(entity => !this.ecs.hasComponent(entity, Npc));

    if (playerEntities.length === 0) return;

    const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
    if (!playerTransform) return;

    this.faceTarget(npcTransform, playerTransform);
  }
}