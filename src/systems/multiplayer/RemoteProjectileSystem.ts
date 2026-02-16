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
    localClientId?: string | null
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
        const normalizedTargetId = String(targetId);

        // 1) Target è il player locale: risolvi direttamente a entity.id locale
        if (localClientId && normalizedTargetId === String(localClientId)) {
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
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer);
    for (const entity of remotePlayerEntities) {
      const remotePlayer = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayer && String(remotePlayer.clientId) === String(clientId)) {
        return entity.id;
      }
    }
    return null;
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
    // Aggiorna proiettili remoti (nessun logging verbose necessario)
    // I proiettili vengono gestiti automaticamente dal sistema
  }
}
