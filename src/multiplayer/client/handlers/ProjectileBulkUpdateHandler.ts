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
    const rawProjectiles = message.pr || message.projectiles;
    if (!rawProjectiles || !Array.isArray(rawProjectiles)) return;

    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) return;

    const ecs = networkSystem.getECS();
    if (!ecs) return;

    for (const update of rawProjectiles) {
      let projectileId, x, y, vx, vy;

      if (Array.isArray(update)) {
        // FORMATO COMPATTO: [id, x, y, vx, vy]
        [projectileId, x, y, vx, vy] = update;
      } else {
        // Formato vecchio (fallback)
        projectileId = update.id;
        x = update.position?.x;
        y = update.position?.y;
        vx = update.velocity?.x;
        vy = update.velocity?.y;
      }

      // Usa RemoteProjectileSystem per trovare il proiettile tramite projectileId
      const entityId = remoteProjectileSystem.getRemoteProjectileEntity(projectileId);
      if (!entityId) continue;

      const projectileEntity = ecs.getEntity(entityId);
      if (!projectileEntity) continue;

      // Aggiorna posizione e velocità del proiettile
      const transform = ecs.getComponent(projectileEntity, Transform);
      const velocity = ecs.getComponent(projectileEntity, Velocity);
      const projectileComponent = ecs.getComponent(projectileEntity, Projectile);

      // Verifica se è un proiettile NPC remoto con interpolazione
      const isNpcProjectile = projectileComponent && typeof projectileComponent.playerId === 'string' && projectileComponent.playerId.startsWith('npc_');
      const interpolation = isNpcProjectile ? ecs.getComponent(projectileEntity, InterpolationTarget) : null;

      if (interpolation && x !== undefined && y !== undefined) {
        // Usa interpolazione per movimento fluido (elimina glitch)
        let rotation = 0;
        if (vx !== undefined && vy !== undefined && (vx !== 0 || vy !== 0)) {
          rotation = Math.atan2(vy, vx);
        }
        interpolation.updateTarget(x, y, rotation);

        // Update rotation for interpolation target too if supported, currently handled by visual update
      } else if (transform && x !== undefined && y !== undefined) {
        // Fallback: aggiornamento diretto per proiettili senza interpolazione
        transform.x = x;
        transform.y = y;

        // 🚀 FIX: Update rotation to face velocity direction
        if (vx !== undefined && vy !== undefined && (vx !== 0 || vy !== 0)) {
          transform.rotation = Math.atan2(vy, vx);
        }
      }

      if (velocity && vx !== undefined && vy !== undefined) {
        velocity.x = vx;
        velocity.y = vy;
      }

      // CRITICO: Aggiorna direzione e velocità del componente Projectile per rendering corretto
      if (projectileComponent && vx !== undefined && vy !== undefined) {
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 0) {
          projectileComponent.directionX = vx / speed;
          projectileComponent.directionY = vy / speed;
          projectileComponent.speed = speed;
        }
      }
    }
  }
}
