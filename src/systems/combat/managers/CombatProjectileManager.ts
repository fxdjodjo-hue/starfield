import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Entity } from '../../../infrastructure/ecs/Entity';
import type { PlayerSystem } from '../../player/PlayerSystem';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { Damage } from '../../../entities/combat/Damage';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { Projectile } from '../../../entities/combat/Projectile';
import { ProjectileFactory } from '../../../factories/ProjectileFactory';
import { GAME_CONSTANTS } from '../../../config/GameConstants';
import { calculateDirection } from '../../../utils/MathUtils';
import { Npc } from '../../../entities/ai/Npc';
import { MissileManager } from './MissileManager';

/**
 * Manages projectile creation and attack execution
 */
export class CombatProjectileManager {
  private lastPlayerFireTime: number = 0;
  private useFastInterval: boolean = false; // Alterna tra veloce e normale
  private static readonly FIRE_RATE_SLOW = 800; // 0.8s
  private static readonly FIRE_RATE_FAST = 500; // 0.5s
  private static readonly MAX_PLAYER_PROJECTILES = 4; // Cap massimo proiettili attivi
  private missileManager: MissileManager;
  
  // Reset pattern quando inizia un nuovo combattimento
  resetFirePattern(): void {
    this.useFastInterval = false;
    this.lastPlayerFireTime = 0;
    this.missileManager.resetCooldown();
  }

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
   * Performs an attack from attacker to target
   */
  performAttack(attackerEntity: Entity, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: Entity): void {
    const isPlayer = attackerEntity === this.playerSystem.getPlayerEntity();

    let directionX: number, directionY: number;

    if (isPlayer) {
      const { direction } = calculateDirection(
        attackerTransform.x, attackerTransform.y,
        targetTransform.x, targetTransform.y
      );
      // Ensure direction is normalized (like triple lasers do from velocity)
      const dirLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
      directionX = dirLength > 0 ? direction.x / dirLength : direction.x;
      directionY = dirLength > 0 ? direction.y / dirLength : direction.y;
    } else {
      const angle = attackerTransform.rotation;
      directionX = Math.cos(angle);
      directionY = Math.sin(angle);
    }

    if (isPlayer) {
      // Don't create lasers here - they will be created by RemoteProjectileSystem when server projectile arrives
      // Just register the attack for cooldown
      attackerDamage.performAttack(Date.now());
    } else {
      attackerDamage.performAttack(Date.now());
    }
  }

  /**
   * Creates a single laser for the player
   */
  private createSingleLaser(attackerEntity: Entity, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: Entity, directionX: number, directionY: number): void {
    const now = Date.now();
    
    // Alterna tra intervallo veloce (0.5s) e normale (0.8s)
    const currentFireRate = this.useFastInterval 
      ? CombatProjectileManager.FIRE_RATE_FAST 
      : CombatProjectileManager.FIRE_RATE_SLOW;
    
    const timeSinceLastFire = now - this.lastPlayerFireTime;
    if (timeSinceLastFire < currentFireRate) {
      return; // Troppo presto, blocca lo sparo
    }

    // Conta proiettili attivi del player
    const activeProjectiles = this.countActivePlayerProjectiles(attackerEntity.id);
    
    // Il player crea 2 proiettili (dual laser), quindi serve spazio per almeno 2
    // Se ci sono già 3 o più proiettili attivi, non posso creare una nuova coppia
    if (activeProjectiles >= CombatProjectileManager.MAX_PLAYER_PROJECTILES - 1) {
      return; // Troppi proiettili attivi, blocca lo sparo
    }

    const laserDamage = attackerDamage.damage;
    this.createProjectileAt(attackerEntity, attackerTransform, laserDamage, directionX, directionY, targetEntity);
    
    // Alterna per il prossimo sparo (prima di aggiornare lastPlayerFireTime)
    this.useFastInterval = !this.useFastInterval;
    this.lastPlayerFireTime = now;
    attackerDamage.performAttack(now);
  }

  /**
   * Creates a single projectile (used by NPCs)
   */
  createSingleProjectile(attackerEntity: Entity, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: Entity, directionX: number, directionY: number): void {
    this.createProjectileAt(attackerEntity, attackerTransform, attackerDamage.damage, directionX, directionY, targetEntity);
    attackerDamage.performAttack(Date.now());
  }

  /**
   * Creates a projectile at a specific position and direction
   * For player, creates 2 visual lasers (dual laser)
   */
  createProjectileAt(attackerEntity: Entity, attackerTransform: Transform, damage: number, directionX: number, directionY: number, targetEntity: Entity): void {
    const playerEntity = this.playerSystem.getPlayerEntity();
    const isLocalPlayer = playerEntity && attackerEntity.id === playerEntity.id;

    const animatedSprite = this.ecs.getComponent(attackerEntity, AnimatedSprite);

    const targetX = attackerTransform.x + directionX * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET * 2;
    const targetY = attackerTransform.y + directionY * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET * 2;

    if (isLocalPlayer) {
      // Use EXACT same logic as triple lasers in RemoteProjectileSystem (but without center)
      // Calculate velocity first (like triple lasers do)
      const speed = GAME_CONSTANTS.PROJECTILE.SPEED;
      const velocityX = directionX * speed;
      const velocityY = directionY * speed;
      
      // Use EXACT same calculations as triple lasers
      const dualLaserOffset = 40; // Same offset as triple lasers
      const perpX = -directionY; // EXACT same calculation as triple lasers
      const perpY = directionX;   // EXACT same calculation as triple lasers
      
      const leftOffsetX = perpX * dualLaserOffset;
      const leftOffsetY = perpY * dualLaserOffset;
      const rightOffsetX = -perpX * dualLaserOffset;
      const rightOffsetY = -perpY * dualLaserOffset;
      
      // Use player center position (like triple lasers use position.x/y from server)
      const positionX = attackerTransform.x;
      const positionY = attackerTransform.y;
      
      const clientId = isLocalPlayer && this.getClientNetworkSystem() ? this.getClientNetworkSystem()!.getLocalClientId() : `npc_${attackerEntity.id}`;
      const ownerId = attackerEntity.id;
      const actualTargetId = targetEntity.id;
      
      // Left laser (visual only, no damage) - EXACT same creation as triple lasers
      const leftEntity = this.ecs.createEntity();
      this.ecs.addComponent(leftEntity, Transform, new Transform(
        positionX + leftOffsetX,
        positionY + leftOffsetY,
        0
      ));
      this.ecs.addComponent(leftEntity, Velocity, new Velocity(
        velocityX,
        velocityY,
        0
      ));
      const leftProjectile = new Projectile(
        0, // No damage - visual only (like triple lasers)
        speed,
        directionX,
        directionY,
        ownerId,
        actualTargetId,
        GAME_CONSTANTS.PROJECTILE.LIFETIME,
        clientId
      );
      this.ecs.addComponent(leftEntity, Projectile, leftProjectile);
      const leftProjectileComponent = this.ecs.getComponent(leftEntity, Projectile);
      if (leftProjectileComponent) {
        (leftProjectileComponent as any).id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Right laser (visual only, no damage) - EXACT same creation as triple lasers
      const rightEntity = this.ecs.createEntity();
      this.ecs.addComponent(rightEntity, Transform, new Transform(
        positionX + rightOffsetX,
        positionY + rightOffsetY,
        0
      ));
      this.ecs.addComponent(rightEntity, Velocity, new Velocity(
        velocityX,
        velocityY,
        0
      ));
      const rightProjectile = new Projectile(
        0, // No damage - visual only (like triple lasers)
        speed,
        directionX,
        directionY,
        ownerId,
        actualTargetId,
        GAME_CONSTANTS.PROJECTILE.LIFETIME,
        clientId
      );
      this.ecs.addComponent(rightEntity, Projectile, rightProjectile);
      const rightProjectileComponent = this.ecs.getComponent(rightEntity, Projectile);
      if (rightProjectileComponent) {
        (rightProjectileComponent as any).id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
    } else {
      const projectileId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const projectileEntity = ProjectileFactory.createProjectile(
        this.ecs,
        damage,
        attackerTransform.x,
        attackerTransform.y,
        targetX,
        targetY,
        attackerEntity.id,
        targetEntity.id,
        isLocalPlayer && this.getClientNetworkSystem() ? this.getClientNetworkSystem()!.getLocalClientId() : `npc_${attackerEntity.id}`,
        animatedSprite || undefined,
        attackerTransform.rotation
      );
      const projectileComponent = this.ecs.getComponent(projectileEntity, Projectile);
      if (projectileComponent) {
        (projectileComponent as any).id = projectileId;
      }
    }
  }

  /**
   * Counts active projectiles for a player entity
   */
  private countActivePlayerProjectiles(playerEntityId: number): number {
    const allProjectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);
    let count = 0;

    for (const projectileEntity of allProjectiles) {
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);
      if (!projectile) continue;

      // Conta solo proiettili del player specificato e ancora attivi (lifetime > 0)
      if (projectile.ownerId === playerEntityId && projectile.lifetime > 0) {
        count++;
      }
    }

    return count;
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
