import { ECS } from '../../../infrastructure/ecs/ECS';
import { RemotePlayerSystem } from '../../../systems/multiplayer/RemotePlayerSystem';
import { RemoteNpcSystem } from '../../../systems/multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../../../systems/multiplayer/RemoteProjectileSystem';
import { Projectile } from '../../../entities/combat/Projectile';
import { Transform } from '../../../entities/spatial/Transform';
import { Velocity } from '../../../entities/spatial/Velocity';

/**
 * RemoteEntityManager - Gestisce entità remote e logica di combattimento
 * Refactored da ClientNetworkSystem per Separation of Concerns
 */
export class RemoteEntityManager {
  private ecs: ECS;
  private remotePlayerSystem: RemotePlayerSystem;
  private remoteNpcSystem: RemoteNpcSystem | null = null;
  private remoteProjectileSystem: RemoteProjectileSystem | null = null;

  // Combat state
  private currentCombatNpcId: string | null = null;

  constructor(ecs: ECS, remotePlayerSystem: RemotePlayerSystem) {
    this.ecs = ecs;
    this.remotePlayerSystem = remotePlayerSystem;
  }

  /**
   * Imposta sistemi per NPC e proiettili remoti
   */
  setRemoteSystems(remoteNpcSystem?: RemoteNpcSystem, remoteProjectileSystem?: RemoteProjectileSystem): void {
    this.remoteNpcSystem = remoteNpcSystem || null;
    this.remoteProjectileSystem = remoteProjectileSystem || null;
  }

  /**
   * Gestisce aggiornamenti posizione proiettili homing dal server
   */
  handleProjectileUpdates(message: any): void {
    if (!message.projectiles || !Array.isArray(message.projectiles)) return;

    for (const projectileUpdate of message.projectiles) {
      // Trova il proiettile nell'ECS
      const projectileEntity = this.ecs.getEntitiesWithComponents(Projectile)
        .find(entity => {
          const projectile = this.ecs.getComponent(entity, Projectile);
          return projectile && projectile.id === projectileUpdate.id;
        });

      if (projectileEntity) {
        // Aggiorna posizione e velocità del proiettile
        const transform = this.ecs.getComponent(projectileEntity, Transform);
        const velocity = this.ecs.getComponent(projectileEntity, Velocity);

        if (transform && projectileUpdate.position) {
          transform.x = projectileUpdate.position.x;
          transform.y = projectileUpdate.position.y;
        }

        if (velocity && projectileUpdate.velocity) {
          velocity.x = projectileUpdate.velocity.x;
          velocity.y = projectileUpdate.velocity.y;
        }
      }
    }
  }

  /**
   * Imposta ID NPC attualmente in combattimento
   */
  setCurrentCombatNpcId(npcId: string | null): void {
    this.currentCombatNpcId = npcId;
  }

  /**
   * Ottiene ID NPC attualmente in combattimento
   */
  getCurrentCombatNpcId(): string | null {
    return this.currentCombatNpcId;
  }

  /**
   * Ferma combattimento quando server invia stop_combat
   */
  stopCombat(): void {
    if (!this.ecs) {
      console.warn(`⚠️ [REMOTE] ECS not available in RemoteEntityManager.stopCombat()`);
      return;
    }

    // Find the CombatSystem and stop combat immediately
    const combatSystem = this.ecs.getSystems().find((system: any) =>
      typeof system.stopCombatImmediately === 'function'
    ) as any;

    if (combatSystem) {
      combatSystem.stopCombatImmediately();

      // Also deactivate attack in PlayerControlSystem to prevent auto-attack
      const playerControlSystem = this.ecs.getSystems().find((system: any) =>
        typeof system.deactivateAttack === 'function'
      ) as any;

      if (playerControlSystem) {
        playerControlSystem.deactivateAttack();
      }
    } else {
      console.warn(`⚠️ [REMOTE] CombatSystem not found, cannot stop combat`);
    }
  }

  /**
   * Getter per sistemi remoti
   */
  getRemotePlayerSystem(): RemotePlayerSystem {
    return this.remotePlayerSystem;
  }

  getRemoteNpcSystem(): RemoteNpcSystem | null {
    return this.remoteNpcSystem;
  }

  getRemoteProjectileSystem(): RemoteProjectileSystem | null {
    return this.remoteProjectileSystem;
  }

  /**
   * Ottiene handler EntityDestroyed per assegnare ricompense
   */
  getEntityDestroyedHandler(): any {
    // TODO: This should be implemented properly
    return null;
  }

  /**
   * Cleanup risorse
   */
  destroy(): void {
  }
}