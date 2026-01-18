import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Entity } from '../../../infrastructure/ecs/Entity';
import type { PlayerSystem } from '../../player/PlayerSystem';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import { Transform } from '../../../entities/spatial/Transform';
import { Damage } from '../../../entities/combat/Damage';
import { Projectile } from '../../../entities/combat/Projectile';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { ProjectileFactory } from '../../../factories/ProjectileFactory';
import { GAME_CONSTANTS } from '../../../config/GameConstants';
import { calculateDirection } from '../../../utils/MathUtils';
import { Npc } from '../../../entities/ai/Npc';

/**
 * Manages missile creation and cooldown for player
 * Similar to CombatProjectileManager but with different cooldown and projectile type
 */
export class MissileManager {
  private lastMissileFireTime: number = 0;
  private static readonly COOLDOWN = GAME_CONSTANTS.MISSILE.COOLDOWN; // 3 seconds

  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem,
    private readonly getClientNetworkSystem: () => ClientNetworkSystem | null
  ) {}

  /**
   * Counts active missiles for a player entity
   */
  private countActiveMissiles(playerEntityId: number): number {
    const allProjectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);
    let count = 0;

    for (const projectileEntity of allProjectiles) {
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);
      if (!projectile) continue;

      // Count only missiles (not lasers) owned by this player and still active
      if (projectile.ownerId === playerEntityId && projectile.lifetime > 0 && projectile.type === 'missile') {
        count++;
      }
    }

    return count;
  }

  /**
   * Resets missile cooldown (useful when starting new combat)
   */
  resetCooldown(): void {
    this.lastMissileFireTime = 0;
  }

  /**
   * Sets cooldown to full so first missile fires after full cooldown period
   */
  setCooldownToFull(): void {
    this.lastMissileFireTime = Date.now();
  }

  /**
   * Checks if missile can be fired (cooldown check)
   */
  canFireMissile(): boolean {
    const now = Date.now();
    const timeSinceLastFire = now - this.lastMissileFireTime;
    return timeSinceLastFire >= MissileManager.COOLDOWN;
  }

  /**
   * Gets remaining cooldown time in milliseconds
   */
  getRemainingCooldown(): number {
    const now = Date.now();
    const timeSinceLastFire = now - this.lastMissileFireTime;
    const remaining = MissileManager.COOLDOWN - timeSinceLastFire;
    return Math.max(0, remaining);
  }

  /**
   * Creates a missile from player to target
   * Returns true if missile was created, false if cooldown not ready
   */
  fireMissile(
    attackerEntity: Entity,
    attackerTransform: Transform,
    attackerDamage: Damage,
    targetTransform: Transform,
    targetEntity: Entity
  ): boolean {
    const now = Date.now();
    const timeSinceLastFire = now - this.lastMissileFireTime;

    // Count active missiles for this player
    const playerId = attackerEntity.id;
    const activeMissiles = this.countActiveMissiles(playerId);
    console.log(`[MISSILE] player=${playerId}, active=${activeMissiles}, timeSinceLastFire=${timeSinceLastFire}, cooldown=${MissileManager.COOLDOWN}, firing=${timeSinceLastFire >= MissileManager.COOLDOWN}`);

    if (timeSinceLastFire < MissileManager.COOLDOWN) {
      return false; // Cooldown not ready
    }

    // Calculate direction from player to target
    const { direction } = calculateDirection(
      attackerTransform.x,
      attackerTransform.y,
      targetTransform.x,
      targetTransform.y
    );

    // Create missile projectile (damage is server-authoritative, client uses dummy value)
    console.log(`[MISSILE] Creating missile for player=${playerId}, target=${targetEntity.id}`);
    this.createMissileAt(
      attackerEntity,
      attackerTransform,
      0, // Dummy damage - real damage calculated by server
      direction.x,
      direction.y,
      targetEntity
    );

    // Update last fire time
    this.lastMissileFireTime = now;
    // Note: Missiles have independent cooldown, don't interfere with laser rate limiting

    return true;
  }

  /**
   * Creates a missile at the specified position
   */
  private createMissileAt(
    attackerEntity: Entity,
    attackerTransform: Transform,
    damage: number,
    directionX: number,
    directionY: number,
    targetEntity: Entity
  ): void {
    const isLocalPlayer = attackerEntity === this.playerSystem.getPlayerEntity();
    const clientNetworkSystem = this.getClientNetworkSystem();

    // Calculate target position (far ahead in direction)
    const targetX = attackerTransform.x + directionX * 1000;
    const targetY = attackerTransform.y + directionY * 1000;

    if (isLocalPlayer) {
      // Create missile for local player - spawn from center of player
      const missileId = `missile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create missile from center of player (no offset, no animated sprite spawn point)
      const missileEntity = ProjectileFactory.createProjectile(
        this.ecs,
        damage,
        attackerTransform.x, // Start from player center
        attackerTransform.y, // Start from player center
        targetX,
        targetY,
        attackerEntity.id,
        targetEntity.id,
        isLocalPlayer && clientNetworkSystem ? clientNetworkSystem.getLocalClientId() : undefined,
        undefined, // No animated sprite - spawn from center
        attackerTransform.rotation,
        'missile' // Pass missile type to factory
      );

      // Override spawn position to be exactly at player center (ProjectileFactory adds offset)
      const missileTransform = this.ecs.getComponent(missileEntity, Transform);
      if (missileTransform) {
        missileTransform.x = attackerTransform.x;
        missileTransform.y = attackerTransform.y;
      }

      // Set missile ID and verify
      const projectileComponent = this.ecs.getComponent(missileEntity, Projectile);
      if (projectileComponent) {
        (projectileComponent as any).id = missileId;

        // Registra il fire time quando il missile viene creato localmente
        const fireTime = Date.now();
        if (clientNetworkSystem) {
          clientNetworkSystem.registerLocalMissileFire(missileId, fireTime);
        }

        // Play missile sound immediately
        if (clientNetworkSystem) {
          const audioSystem = clientNetworkSystem.getAudioSystem();
          if (audioSystem) {
            audioSystem.playSound('rocketStart', 0.05, false, true);
          }
        }

        // Send missile_fired message to server for server-authoritative damage
        if (clientNetworkSystem) {
          const velocity = {
            x: directionX * GAME_CONSTANTS.MISSILE.SPEED,
            y: directionY * GAME_CONSTANTS.MISSILE.SPEED
          };

          clientNetworkSystem.sendProjectileFired({
            projectileId: missileId,
            playerId: clientNetworkSystem.gameContext.authId,
            position: {
              x: attackerTransform.x,
              y: attackerTransform.y
            },
            velocity: velocity,
            projectileType: 'missile'
          });
        }
      }
    }
  }
}
