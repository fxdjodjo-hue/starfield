import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Projectile } from '../../entities/combat/Projectile';
import { Sprite } from '../../entities/Sprite';
import { Npc } from '../../entities/ai/Npc';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
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
    isLocalPlayer: boolean = false
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

    // Determina ownerId e targetId corretti per homing
    let ownerId: number = entity.id; // Default fallback
    let actualTargetId: number = -1; // Default: nessun target

    // Se playerId inizia con "npc_", è un proiettile NPC
    if (typeof playerId === 'string' && playerId.startsWith('npc_')) {
      // Proiettile NPC: owner è l'NPC, target è il player
      const npcId = parseInt(playerId.replace('npc_', ''));
      ownerId = npcId;

      // Trova l'entità player locale come target
      if (targetId) {
        // Cerca il player con il clientId corrispondente
        // Per ora semplificato: assumiamo che il player locale sia il target
        // TODO: Implementare mapping corretto clientId -> entityId
        const playerEntities = this.ecs.getEntitiesWithComponents(Transform);
        for (const playerEntity of playerEntities) {
          // Controlla se è un'entità player (non NPC)
          if (!this.ecs.hasComponent(playerEntity, Npc)) {
            actualTargetId = playerEntity.id;
            break;
          }
        }
      }
    } else {
      // Proiettile player: owner è il player, target potrebbe essere un NPC
      // Cerca l'entità player locale come owner
      const playerEntities = this.ecs.getEntitiesWithComponents(Transform);
      ownerId = entity.id; // Fallback
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
          if (npc && npc.serverId === targetId.toString()) {
            actualTargetId = npcEntity.id;
            break;
          }
        }
      }
    }

    // Componente proiettile
    const projectile = new Projectile(damage, speed, directionX, directionY, ownerId, actualTargetId, GAME_CONSTANTS.PROJECTILE.LIFETIME, playerId);
    this.ecs.addComponent(entity, Projectile, projectile);

    // Per proiettili NPC remoti, aggiungi InterpolationTarget per movimento fluido
    // Il server invia aggiornamenti ogni 50ms, l'interpolazione elimina glitch
    if (typeof playerId === 'string' && playerId.startsWith('npc_')) {
      this.ecs.addComponent(entity, InterpolationTarget, new InterpolationTarget(position.x, position.y, 0));
    }

    // Sprite per rendering (se necessario)
    // TODO: Aggiungere sprite appropriati per i diversi tipi di proiettile

    // Registra il proiettile
    this.remoteProjectiles.set(projectileId, {
      entityId: entity.id,
      playerId,
      type: projectileType
    });

    // Per tutti i player (non NPC), crea laser visivi sempre 3 per maggiore impatto visivo
    if (typeof playerId === 'string' && !playerId.startsWith('npc_')) {
      // OTTIMIZZAZIONE: Sempre 3 laser per maggiore fluidità visiva
      // Rimosso alternanza 2-3 laser, ora sempre impatto massimo
      const isTripleShot = true; // Sempre triple shot per laser più impressionanti
      
      const dualLaserOffset = 40; // Offset perpendicolare per i laser laterali (px)
      const perpX = -directionY;
      const perpY = directionX;
      
      if (isTripleShot) {
        // Sparo pari: 3 laser totali (1 server centrale + 2 visivi laterali)
        const leftOffsetX = perpX * dualLaserOffset;
        const leftOffsetY = perpY * dualLaserOffset;
        const rightOffsetX = -perpX * dualLaserOffset;
        const rightOffsetY = -perpY * dualLaserOffset;
        
        // Laser sinistro (solo visivo)
        const leftEntity = this.ecs.createEntity();
        this.ecs.addComponent(leftEntity, Transform, new Transform(
          position.x + leftOffsetX,
          position.y + leftOffsetY,
          0
        ));
        this.ecs.addComponent(leftEntity, Velocity, new Velocity(velocity.x, velocity.y, 0));
        const leftProjectile = new Projectile(0, speed, directionX, directionY, ownerId, actualTargetId, GAME_CONSTANTS.PROJECTILE.LIFETIME, playerId);
        this.ecs.addComponent(leftEntity, Projectile, leftProjectile);
        this.remoteProjectiles.set(`${projectileId}_left`, {
          entityId: leftEntity.id,
          playerId,
          type: projectileType
        });
        
        // Laser destro (solo visivo)
        const rightEntity = this.ecs.createEntity();
        this.ecs.addComponent(rightEntity, Transform, new Transform(
          position.x + rightOffsetX,
          position.y + rightOffsetY,
          0
        ));
        this.ecs.addComponent(rightEntity, Velocity, new Velocity(velocity.x, velocity.y, 0));
        const rightProjectile = new Projectile(0, speed, directionX, directionY, ownerId, actualTargetId, GAME_CONSTANTS.PROJECTILE.LIFETIME, playerId);
        this.ecs.addComponent(rightEntity, Projectile, rightProjectile);
        this.remoteProjectiles.set(`${projectileId}_right`, {
          entityId: rightEntity.id,
          playerId,
          type: projectileType
        });
      } else {
        // Sparo dispari: 2 laser totali (1 server centrale + 2 visivi laterali)
        // Always create both left and right lasers (same as triple, but without center visual)
        const leftOffsetX = perpX * dualLaserOffset;
        const leftOffsetY = perpY * dualLaserOffset;
        const rightOffsetX = -perpX * dualLaserOffset;
        const rightOffsetY = -perpY * dualLaserOffset;
        
        // Laser sinistro (solo visivo)
        const leftEntity = this.ecs.createEntity();
        this.ecs.addComponent(leftEntity, Transform, new Transform(
          position.x + leftOffsetX,
          position.y + leftOffsetY,
          0
        ));
        this.ecs.addComponent(leftEntity, Velocity, new Velocity(velocity.x, velocity.y, 0));
        const leftProjectile = new Projectile(0, speed, directionX, directionY, ownerId, actualTargetId, GAME_CONSTANTS.PROJECTILE.LIFETIME, playerId);
        this.ecs.addComponent(leftEntity, Projectile, leftProjectile);
        this.remoteProjectiles.set(`${projectileId}_left`, {
          entityId: leftEntity.id,
          playerId,
          type: projectileType
        });
        
        // Laser destro (solo visivo)
        const rightEntity = this.ecs.createEntity();
        this.ecs.addComponent(rightEntity, Transform, new Transform(
          position.x + rightOffsetX,
          position.y + rightOffsetY,
          0
        ));
        this.ecs.addComponent(rightEntity, Velocity, new Velocity(velocity.x, velocity.y, 0));
        const rightProjectile = new Projectile(0, speed, directionX, directionY, ownerId, actualTargetId, GAME_CONSTANTS.PROJECTILE.LIFETIME, playerId);
        this.ecs.addComponent(rightEntity, Projectile, rightProjectile);
        this.remoteProjectiles.set(`${projectileId}_right`, {
          entityId: rightEntity.id,
          playerId,
          type: projectileType
        });
      }
    }

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
  }

  /**
   * Update periodico (principalmente per logging)
   */
  update(deltaTime: number): void {
    // Aggiorna proiettili remoti (nessun logging verbose necessario)
    // I proiettili vengono gestiti automaticamente dal sistema
  }
}
