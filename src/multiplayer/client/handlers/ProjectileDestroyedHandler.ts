import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce la distruzione dei proiettili
 */
export class ProjectileDestroyedHandler extends BaseMessageHandler {
  // Traccia quando i missili vengono sparati per evitare di riprodurre il suono troppo presto
  private missileFireTimes: Map<string, number> = new Map();

  constructor() {
    super(MESSAGE_TYPES.PROJECTILE_DESTROYED);
  }

  /**
   * Registra quando un missile viene sparato (chiamato da ProjectileFiredHandler)
   */
  registerMissileFire(projectileId: string, fireTime: number): void {
    // Evita registrazioni duplicate
    if (this.missileFireTimes.has(projectileId)) {
      return;
    }
    this.missileFireTimes.set(projectileId, fireTime);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) {
      return;
    }

    const projectileType = remoteProjectileSystem.getRemoteProjectileType(message.projectileId);
    const isLocalMissile = this.missileFireTimes.has(message.projectileId);
    
    // Play explosion sound when missile hits target or collides
    if ((projectileType === 'missile' || isLocalMissile) && (message.reason === 'target_hit' || message.reason === 'collision')) {
      const fireTime = this.missileFireTimes.get(message.projectileId) || 0;
      
      if (fireTime > 0) {
        const audioSystem = networkSystem.getAudioSystem();
        if (audioSystem) {
          audioSystem.playSound('rocketExplosion', 0.05, false, true);
        }
      }
      
      this.missileFireTimes.delete(message.projectileId);
    }

    // Rimuovi il proiettile dal mondo del client solo se esiste in RemoteProjectileSystem
    if (projectileType !== undefined || !isLocalMissile) {
      remoteProjectileSystem.removeRemoteProjectile(message.projectileId);
    }
  }
}
