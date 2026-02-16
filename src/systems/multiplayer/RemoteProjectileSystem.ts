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

    // Determina ownerId e targetId corretti per homing
    let ownerId: number | string | undefined;
    let actualTargetId: number | string | undefined;

    // Se playerId inizia con "npc_", è un proiettile NPC
    if (typeof playerId === 'string' && playerId.startsWith('npc_')) {
      // Proiettile NPC: owner è l'NPC, target è il player
      ownerId = playerId;

      if (targetId !== null && targetId !== undefined) {
        const normalizedTargetId = this.normalizeNetworkPlayerId(targetId);
        const normalizedLocalClientId = localClientId ? this.normalizeNetworkPlayerId(localClientId) : null;
        const normalizedLocalAuthId = localAuthId ? this.normalizeNetworkPlayerId(localAuthId) : null;

        // 1) Target è il player locale: risolvi direttamente a entity.id locale
        if (
          (normalizedLocalClientId && normalizedTargetId === normalizedLocalClientId) ||
          (normalizedLocalAuthId && normalizedTargetId === normalizedLocalAuthId)
        ) {
          const localPlayerEntity = this.ecs.getPlayerEntity();
          if (localPlayerEntity) {
            actualTargetId = localPlayerEntity.id;
          }
        }

        // 2) Target è un remote player: risolvi a entity.id remoto
        if (actualTargetId === undefined) {
          const remoteTargetEntityId = this.findRemotePlayerEntityByClientId(normalizedTargetId);
          if (remoteTargetEntityId !== null) {
            actualTargetId = remoteTargetEntityId;
          }
        }

        // 3) Fallback: conserva il target server-side (clientId string),
        // senza forzare il player locale come bersaglio visivo.
        if (actualTargetId === undefined) {
          actualTargetId = normalizedTargetId;
        }
      }
    } else {
      // Proiettile player: owner è il player, target potrebbe essere un NPC
      // Cerca l'entità player come owner
      const playerEntities = this.ecs.getEntitiesWithComponents(Transform);
      for (const playerEntity of playerEntities) {
        if (!this.ecs.hasComponent(playerEntity, Npc)) {
          ownerId = playerEntity.id;
          break;
        }
      }

      // Se c'è un targetId, cerca l'NPC con serverId corrispondente
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

    // Usa il nuovo metodo unificato che crea proiettili normali gestiti dal ProjectileSystem
    // Usa il nuovo metodo unificato che crea proiettili normali gestiti dal ProjectileSystem
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

    // Deterministic NPC beams have a server-defined hit time.
    // Clamp local visual lifetime to remaining hit window to avoid end-of-flight linger.
    if (isDeterministic && typeof hitTime === 'number' && Number.isFinite(hitTime)) {
      const projectile = this.ecs.getComponent(entity, Projectile);
      if (projectile) {
        projectile.isDeterministic = true;
        projectile.hitTime = hitTime;
        const remainingMs = Math.max(120, hitTime - Date.now());
        const bufferedLifetime = remainingMs + 40; // small jitter buffer
        projectile.lifetime = Math.min(projectile.lifetime, bufferedLifetime);
        projectile.maxLifetime = projectile.lifetime;
      }

      // Pure server-authoritative visual path:
      // add interpolation so MovementSystem does not move this projectile locally.
      if (!this.ecs.hasComponent(entity, InterpolationTarget)) {
        const initialRotation = (velocity.x !== 0 || velocity.y !== 0)
          ? Math.atan2(velocity.y, velocity.x)
          : 0;
        this.ecs.addComponent(
          entity,
          InterpolationTarget,
          new InterpolationTarget(position.x, position.y, initialRotation)
        );
      }
    } else {
      const projectile = this.ecs.getComponent(entity, Projectile);
      if (projectile) {
        projectile.isDeterministic = false;
        projectile.hitTime = undefined;
      }
    }

    // Registra il proiettile nella mappa per tracking
    this.remoteProjectiles.set(projectileId, {
      entityId: entity.id,
      playerId: playerId,
      type: projectileType
    });

    return entity.id;
  }

  /**
   * Risolve l'entità ECS di un remote player tramite clientId server-side.
   */
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

  /**
   * Normalizes player identifiers used in network messages.
   * Supports formats like "player_<id>", raw clientId, and numeric-like ids.
   */
  private normalizeNetworkPlayerId(id: string | number): string {
    const value = String(id || '').trim();
    return value.startsWith('player_') ? value.slice('player_'.length) : value;
  }



  /**
   * Rimuove un proiettile remoto (distrutto)
   * Idempotente: se il proiettile non esiste più, è normale (multiplayer)
   */
  removeRemoteProjectile(projectileId: string): boolean {
    const projectileData = this.remoteProjectiles.get(projectileId);
    if (!projectileData) {
      // ✅ NORMALE in multiplayer: proiettile già distrutto localmente
      // Non è un errore, può succedere per:
      // - Collisione client-side già processata
      // - TTL/lifetime locale scaduto
      // - NPC projectile mai ricevuto dal client
      // - Missile server-authoritative senza entity locale
      // ✅ NORMALE in multiplayer - il proiettile è già stato rimosso localmente
      // Non loggare per evitare spam nei log
      return true; // ✅ Considerato successo
    }


    const entity = this.ecs.getEntity(projectileData.entityId);
    if (entity) {
      this.ecs.removeEntity(entity);
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
   * Ottiene il tipo di proiettile remoto
   */
  getRemoteProjectileType(projectileId: string): string | undefined {
    const projectileData = this.remoteProjectiles.get(projectileId);
    return projectileData?.type;
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

    for (const projectileData of allProjectiles) {
      byType[projectileData.type] = (byType[projectileData.type] || 0) + 1;
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
  }


  /**
   * Update periodico (principalmente per logging)
   */
  update(deltaTime: number): void {
    // Cleanup safety: remove stale tracking entries whose ECS entity no longer exists.
    // Without this, long sessions can accumulate orphan projectile IDs in the map.
    for (const [projectileId, projectileData] of this.remoteProjectiles.entries()) {
      const entity = this.ecs.getEntity(projectileData.entityId);
      if (!entity) {
        this.remoteProjectiles.delete(projectileId);
      }
    }
  }
}
