import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { ECS } from '../../../infrastructure/ecs/ECS';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';
import { InterpolationTarget } from '../../../entities/spatial/InterpolationTarget';
import { Projectile } from '../../../entities/combat/Projectile';

/**
 * Gestisce aggiornamenti bulk di posizione proiettili dal server (per proiettili homing)
 */
export class ProjectileBulkUpdateHandler extends BaseMessageHandler {
  constructor() {
    super('projectile_updates');
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    if (!message.projectiles || !Array.isArray(message.projectiles)) return;

    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) return;

    const ecs = networkSystem.getECS();
    if (!ecs) return;

    for (const projectileUpdate of message.projectiles) {
      // Usa RemoteProjectileSystem per trovare il proiettile tramite projectileId
      const entityId = remoteProjectileSystem.getRemoteProjectileEntity(projectileUpdate.id);
      if (!entityId) continue;

      const projectileEntity = ecs.getEntity(entityId);
      if (!projectileEntity) continue;

      // Aggiorna posizione e velocità del proiettile
      const transform = ecs.getComponent(projectileEntity, Transform);
      const velocity = ecs.getComponent(projectileEntity, Velocity);
      const projectile = ecs.getComponent(projectileEntity, Projectile);
      
      // Verifica se è un proiettile NPC remoto con interpolazione
      const isNpcProjectile = projectile && typeof projectile.playerId === 'string' && projectile.playerId.startsWith('npc_');
      const interpolation = isNpcProjectile ? ecs.getComponent(projectileEntity, InterpolationTarget) : null;

      if (interpolation && projectileUpdate.position) {
        // Usa interpolazione per movimento fluido (elimina glitch)
        interpolation.updateTarget(projectileUpdate.position.x, projectileUpdate.position.y, 0);
      } else if (transform && projectileUpdate.position) {
        // Fallback: aggiornamento diretto per proiettili senza interpolazione
        transform.x = projectileUpdate.position.x;
        transform.y = projectileUpdate.position.y;
      }

      if (velocity && projectileUpdate.velocity) {
        velocity.x = projectileUpdate.velocity.x;
        velocity.y = projectileUpdate.velocity.y;
      }
      
      // CRITICO: Aggiorna direzione e velocità del componente Projectile per rendering corretto
      if (projectile && projectileUpdate.velocity) {
        const speed = Math.sqrt(projectileUpdate.velocity.x * projectileUpdate.velocity.x + projectileUpdate.velocity.y * projectileUpdate.velocity.y);
        if (speed > 0) {
          projectile.directionX = projectileUpdate.velocity.x / speed;
          projectile.directionY = projectileUpdate.velocity.y / speed;
          projectile.speed = speed;
        }
      }
    }
  }
}
