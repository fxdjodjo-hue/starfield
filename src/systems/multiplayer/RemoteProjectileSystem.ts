import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Projectile } from '../../entities/combat/Projectile';
import { Sprite } from '../../entities/Sprite';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { ProjectileFactory } from '../../factories/ProjectileFactory';
import { logger } from '../../utils/Logger';

/**
 * Sistema per la gestione dei proiettili remoti in multiplayer
 * Gestisce creazione, aggiornamento e rimozione dei proiettili sparati da altri giocatori
 */
export class RemoteProjectileSystem extends BaseSystem {
  // Mappa projectileId -> entity data
  private remoteProjectiles: Map<string, {entityId: number, playerId: string, type: string}> = new Map();

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Aggiunge un nuovo proiettile remoto sparato da un altro giocatore
   */
  addRemoteProjectile(
    projectileId: string,
    playerId: string,
    position: { x: number; y: number },
    velocity: { x: number; y: number },
    damage: number,
    projectileType: string = 'laser'
  ): number {
    // Verifica se il proiettile esiste già
    if (this.remoteProjectiles.has(projectileId)) {
      console.warn(`[REMOTE_PROJECTILE] Projectile ${projectileId} already exists`);
      return this.remoteProjectiles.get(projectileId)!.entityId;
    }

    // Crea la nuova entity proiettile
    const entity = this.ecs.createEntity();

    // Componenti spaziali
    this.ecs.addComponent(entity, Transform, new Transform(position.x, position.y, 0));
    this.ecs.addComponent(entity, Velocity, new Velocity(velocity.x, velocity.y, 0));

    // Calcola speed dalla velocity
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

    // Calcola direction normalizzata
    const directionX = speed > 0 ? velocity.x / speed : 0;
    const directionY = speed > 0 ? velocity.y / speed : 0;

    // Per i proiettili remoti, usa valori dummy per ownerId e targetId
    // ownerId sarà l'entity ID creato, targetId = -1 (nessun target specifico)
    const ownerId = entity.id; // Usa l'entity ID stesso come owner
    const targetId = -1; // Nessun target specifico per proiettili remoti

    // Componente proiettile
    const projectile = new Projectile(damage, speed, directionX, directionY, ownerId, targetId, GAME_CONSTANTS.PROJECTILE.LIFETIME, playerId);
    this.ecs.addComponent(entity, Projectile, projectile);

    // Sprite per rendering (se necessario)
    // TODO: Aggiungere sprite appropriati per i diversi tipi di proiettile

    // Registra il proiettile
    this.remoteProjectiles.set(projectileId, {
      entityId: entity.id,
      playerId,
      type: projectileType
    });

    console.log(`🚀 [REMOTE_PROJECTILE] Added remote projectile ${projectileId} from ${playerId} (${projectileType})`);
    return entity.id;
  }

  /**
   * Aggiorna la posizione di un proiettile remoto
   */
  updateRemoteProjectile(projectileId: string, position: { x: number; y: number }): void {
    const projectileData = this.remoteProjectiles.get(projectileId);
    if (!projectileData) {
      return; // Proiettile potrebbe essere già stato distrutto
    }

    const entity = this.ecs.getEntity(projectileData.entityId);
    if (!entity) {
      console.warn(`[REMOTE_PROJECTILE] Entity ${projectileData.entityId} not found for projectile ${projectileId}`);
      this.remoteProjectiles.delete(projectileId);
      return;
    }

    const transform = this.ecs.getComponent(entity, Transform);
    if (transform) {
      transform.x = position.x;
      transform.y = position.y;
    }
  }

  /**
   * Rimuove un proiettile remoto (distrutto)
   */
  removeRemoteProjectile(projectileId: string): boolean {
    const projectileData = this.remoteProjectiles.get(projectileId);
    if (!projectileData) {
      return false;
    }

    const entity = this.ecs.getEntity(projectileData.entityId);
    if (entity) {
      this.ecs.removeEntity(entity);
      console.log(`💥 [REMOTE_PROJECTILE] Removed remote projectile ${projectileId}`);
    }

    this.remoteProjectiles.delete(projectileId);
    return true;
  }

  /**
   * Verifica se un proiettile remoto esiste
   */
  hasRemoteProjectile(projectileId: string): boolean {
    return this.remoteProjectiles.has(projectileId);
  }

  /**
   * Ottiene l'entity ID di un proiettile remoto
   */
  getRemoteProjectileEntity(projectileId: string): number | undefined {
    const projectileData = this.remoteProjectiles.get(projectileId);
    return projectileData?.entityId;
  }

  /**
   * Ottiene tutti i proiettili remoti attivi
   */
  getActiveRemoteProjectiles(): string[] {
    return Array.from(this.remoteProjectiles.keys());
  }

  /**
   * Ottiene statistiche sui proiettili remoti
   */
  getStats(): { totalProjectiles: number; byType: Record<string, number> } {
    const allProjectiles = Array.from(this.remoteProjectiles.values());
    const byType: Record<string, number> = {};

    for (const projectile of allProjectiles) {
      byType[projectile.type] = (byType[projectile.type] || 0) + 1;
    }

    return {
      totalProjectiles: allProjectiles.length,
      byType
    };
  }

  /**
   * Rimuove tutti i proiettili remoti (per cleanup o riconnessione)
   */
  removeAllRemoteProjectiles(): void {
    const projectileIds = Array.from(this.remoteProjectiles.keys());
    for (const projectileId of projectileIds) {
      this.removeRemoteProjectile(projectileId);
    }
    console.log(`🧹 [REMOTE_PROJECTILE] Cleaned up all ${projectileIds.length} remote projectiles`);
  }

  /**
   * Update periodico (principalmente per logging)
   */
  update(deltaTime: number): void {
    // Logging periodico dello stato usando utility centralizzata
    const stats = this.getStats();
    if (stats.totalProjectiles > 0) {
      logger.logIfTime(
        'remote_projectile_status',
        `🚀 [REMOTE_PROJECTILE] Status: ${stats.totalProjectiles} projectiles`,
        GAME_CONSTANTS.UI.LOG_INTERVAL
      );
    }
  }
}
