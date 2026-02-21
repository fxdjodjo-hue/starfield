import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Projectile } from '../../entities/combat/Projectile';
import { Npc } from '../../entities/ai/Npc';
import { RemotePlayer } from '../../entities/player/RemotePlayer';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { ProjectileFactory } from '../../core/domain/ProjectileFactory';
import { LoggerWrapper } from '../../core/data/LoggerWrapper';
import { PlayerSystem } from '../player/PlayerSystem';
import { AssetManager } from '../../core/services/AssetManager';

/**
 * Sistema per la gestione dei proiettili remoti in multiplayer
 * Gestisce creazione, aggiornamento e rimozione dei proiettili sparati da altri giocatori
 */
export class RemoteProjectileSystem extends BaseSystem {
  public static override readonly Type = 'RemoteProjectileSystem';
  // Mappa projectileId -> entity data
  private remoteProjectiles: Map<string, { entityId: number, playerId: string, type: string }> = new Map();
  // Contatori sparo per alternanza visiva (2 laser / 3 laser) - uno per ogni playerId
  private playerShotCounts: Map<string, number> = new Map();
  // Frame counter per cleanup ammortizzato
  private cleanupFrameCounter: number = 0;

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
    projectileType: string = 'laser',
    targetId: string | number | null = null,
    isLocalPlayer: boolean = false,
    assetManager?: AssetManager,
    localClientId?: string | null,
    localAuthId?: string | null,
    hitTime?: number | null,
    isDeterministic: boolean = false
  ): number {
    // Verifica se il proiettile esiste già
    if (this.remoteProjectiles.has(projectileId)) {
      console.warn(`[REMOTE_PROJECTILE] Projectile ${projectileId} already exists`);
      return this.remoteProjectiles.get(projectileId)!.entityId;
    }

    let actualTargetId: number | string | undefined;

    // Se playerId inizia con "npc_", è un proiettile NPC
    if (typeof playerId === 'string' && playerId.startsWith('npc_')) {
      if (targetId !== null && targetId !== undefined) {
        const normalizedTargetId = this.normalizeNetworkPlayerId(targetId);
        const normalizedLocalClientId = localClientId ? this.normalizeNetworkPlayerId(localClientId) : null;
        const normalizedLocalAuthId = localAuthId ? this.normalizeNetworkPlayerId(localAuthId) : null;

        if (
          (normalizedLocalClientId && normalizedTargetId === normalizedLocalClientId) ||
          (normalizedLocalAuthId && normalizedTargetId === normalizedLocalAuthId)
        ) {
          const localPlayerEntity = this.ecs.getPlayerEntity();
          if (localPlayerEntity) {
            actualTargetId = localPlayerEntity.id;
          }
        }

        if (actualTargetId === undefined) {
          const remoteTargetEntityId = this.findRemotePlayerEntityByClientId(normalizedTargetId);
          if (remoteTargetEntityId !== null) {
            actualTargetId = remoteTargetEntityId;
          }
        }

        if (actualTargetId === undefined) {
          actualTargetId = normalizedTargetId;
        }
      }
    } else {
      if (targetId) {
        const npcEntities = this.ecs.getEntitiesWithComponents(Npc);
        for (const npcEntity of npcEntities) {
          const npc = this.ecs.getComponent(npcEntity, Npc);
          if (npc && npc.serverId === String(targetId)) {
            actualTargetId = npcEntity.id;
            break;
          }
        }
      }
    }

    const entity = ProjectileFactory.createRemoteUnified(
      this.ecs,
      projectileId,
      playerId,
      position,
      velocity,
      damage,
      projectileType,
      actualTargetId !== undefined ? actualTargetId : (targetId || undefined),
      undefined,
      assetManager
    );

    if (isDeterministic && typeof hitTime === 'number' && Number.isFinite(hitTime)) {
      const projectile = this.ecs.getComponent(entity, Projectile);
      if (projectile) {
        projectile.isDeterministic = true;
        projectile.hitTime = hitTime;
        const remainingMs = Math.max(120, hitTime - Date.now());
        const bufferedLifetime = remainingMs + 40;
        projectile.lifetime = Math.min(projectile.lifetime, bufferedLifetime);
        projectile.maxLifetime = projectile.lifetime;
      }
    }

    this.remoteProjectiles.set(projectileId, {
      entityId: entity.id,
      playerId: playerId,
      type: projectileType
    });

    return entity.id;
  }

  private findRemotePlayerEntityByClientId(clientId: string): number | null {
    const normalizedClientId = this.normalizeNetworkPlayerId(clientId);
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer);
    for (const entity of remotePlayerEntities) {
      const remotePlayer = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayer && this.normalizeNetworkPlayerId(remotePlayer.clientId) === normalizedClientId) {
        return entity.id;
      }
    }
    return null;
  }

  private normalizeNetworkPlayerId(id: string | number): string {
    const value = String(id || '').trim();
    return value.startsWith('player_') ? value.slice('player_'.length) : value;
  }

  removeRemoteProjectile(projectileId: string): boolean {
    const projectileData = this.remoteProjectiles.get(projectileId);
    if (!projectileData) return true;

    const entity = this.ecs.getEntity(projectileData.entityId);
    if (entity) {
      this.ecs.removeEntity(entity);
    }

    this.remoteProjectiles.delete(projectileId);
    return true;
  }

  hasRemoteProjectile(projectileId: string): boolean {
    return this.remoteProjectiles.has(projectileId);
  }

  getRemoteProjectileEntity(projectileId: string): number | undefined {
    return this.remoteProjectiles.get(projectileId)?.entityId;
  }

  getRemoteProjectileType(projectileId: string): string | undefined {
    return this.remoteProjectiles.get(projectileId)?.type;
  }

  getActiveRemoteProjectiles(): string[] {
    return Array.from(this.remoteProjectiles.keys());
  }

  getStats(): { totalProjectiles: number; byType: Record<string, number> } {
    const allProjectiles = Array.from(this.remoteProjectiles.values());
    const byType: Record<string, number> = {};
    for (const p of allProjectiles) {
      byType[p.type] = (byType[p.type] || 0) + 1;
    }
    return { totalProjectiles: allProjectiles.length, byType };
  }

  removeAllRemoteProjectiles(): void {
    const projectileIds = Array.from(this.remoteProjectiles.keys());
    for (const id of projectileIds) {
      this.removeRemoteProjectile(id);
    }
  }

  update(deltaTime: number): void {
    this.cleanupFrameCounter++;
    if (this.cleanupFrameCounter >= 30) {
      this.cleanupFrameCounter = 0;
      for (const [projectileId, projectileData] of this.remoteProjectiles.entries()) {
        const entity = this.ecs.getEntity(projectileData.entityId);
        if (!entity) {
          this.remoteProjectiles.delete(projectileId);
        }
      }
    }
  }
}
