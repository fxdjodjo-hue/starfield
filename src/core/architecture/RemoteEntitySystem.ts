/**
 * RemoteEntitySystem - Classe base astratta per sistemi di entità remote
 * Fornisce funzionalità comuni per RemoteNpcSystem e RemotePlayerSystem
 */

import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { InterpolationTarget } from '../../entities/spatial/InterpolationTarget';
import { CollectionManager } from '../data/CollectionManager';
import { ComponentHelper } from '../data/ComponentHelper';
import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';
import { EntityStateSystem } from '../domain/EntityStateSystem';
import { TimeManager } from '../utils/TimeManager';

export interface RemoteEntityData {
  entityId: number;
  remoteId: string; // npcId o clientId
  type?: string; // tipo entità (Scouter, Kronos, player, etc.)
  lastUpdate?: number;
}

export interface RemoteEntityConfig {
  enableInterpolation?: boolean;
  updateThrottleMs?: number; // Throttle per logging aggiornamenti
  maxEntities?: number; // Limite entità remote
}

export abstract class RemoteEntitySystem extends BaseSystem {
  protected remoteEntities: Map<string, RemoteEntityData> = new Map();
  protected sprites: Map<string, Sprite> = new Map();
  protected animatedSprites: Map<string, AnimatedSprite> = new Map();
  protected config: RemoteEntityConfig;
  protected lastBulkUpdateLog = 0;

  constructor(
    ecs: ECS,
    config: RemoteEntityConfig = {}
  ) {
    super(ecs);
    this.config = {
      enableInterpolation: true,
      updateThrottleMs: 5000, // 5 secondi tra log bulk
      maxEntities: 100, // Limite ragionevole
      ...config
    };
  }

  /**
   * Metodo astratto per ottenere il tipo di entità (per logging)
   */
  protected abstract getEntityType(): string;

  /**
   * Metodo astratto per creare componenti specifici dell'entità
   */
  protected abstract createEntityComponents(
    entity: Entity,
    remoteId: string,
    initialData: any
  ): void;

  /**
   * Metodo astratto per gestire aggiornamenti specifici
   */
  protected abstract handleEntitySpecificUpdate(
    remoteId: string,
    updateData: any
  ): void;

  /**
   * Registra una nuova entità remota
   */
  protected registerRemoteEntity(
    remoteId: string,
    entity: Entity,
    type?: string
  ): boolean {
    try {
      // Controllo limite entità
      if (this.remoteEntities.size >= this.config.maxEntities!) {
        LoggerWrapper.warn(LogCategory.ECS, `Max ${this.getEntityType()} entities reached (${this.config.maxEntities})`, {
          remoteId,
          currentCount: this.remoteEntities.size
        });
        return false;
      }

      // Verifica se già esiste
      if (this.remoteEntities.has(remoteId)) {
        LoggerWrapper.warn(LogCategory.ECS, `${this.getEntityType()} ${remoteId} already exists`, {
          remoteId,
          entityId: entity.id
        });
        return false;
      }

      this.remoteEntities.set(remoteId, {
        entityId: entity.id,
        remoteId,
        type,
        lastUpdate: TimeManager.getCurrentTime()
      });

      LoggerWrapper.ecs(`${this.getEntityType()} ${remoteId} registered`, {
        remoteId,
        entityId: entity.id,
        type,
        totalEntities: this.remoteEntities.size
      });

      return true;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to register ${this.getEntityType()} ${remoteId}`, error as Error, {
        remoteId,
        entityId: entity.id
      });
      return false;
    }
  }

  /**
   * Rimuove un'entità remota
   */
  protected unregisterRemoteEntity(remoteId: string): boolean {
    try {
      const entityData = this.remoteEntities.get(remoteId);
      if (!entityData) {
        LoggerWrapper.debug(LogCategory.ECS, `${this.getEntityType()} ${remoteId} not found for removal`, {
          remoteId
        });
        return true; // Considerato successo se non esiste
      }

      const entity = this.ecs.getEntity(entityData.entityId);
      if (entity) {
        this.ecs.removeEntity(entity);
      }

      this.remoteEntities.delete(remoteId);

      LoggerWrapper.ecs(`${this.getEntityType()} ${remoteId} unregistered`, {
        remoteId,
        entityId: entityData.entityId,
        remainingEntities: this.remoteEntities.size
      });

      return true;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to unregister ${this.getEntityType()} ${remoteId}`, error as Error, {
        remoteId
      });
      return false;
    }
  }

  /**
   * Trova l'entità remota tramite remoteId
   */
  protected findRemoteEntity(remoteId: string): Entity | null {
    const entityData = this.remoteEntities.get(remoteId);
    if (!entityData) return null;

    return this.ecs.getEntity(entityData.entityId) || null;
  }

  /**
   * Ottiene l'entityId tramite remoteId
   */
  protected getRemoteEntityId(remoteId: string): number | null {
    const entityData = this.remoteEntities.get(remoteId);
    return entityData?.entityId || null;
  }

  /**
   * Aggiorna stato entità remota usando EntityStateSystem
   */
  protected updateRemoteEntityState(
    remoteId: string,
    update: any,
    source: string = 'server'
  ): boolean {
    try {
      const entity = this.findRemoteEntity(remoteId);
      if (!entity) {
        LoggerWrapper.warn(LogCategory.ECS, `Cannot update ${this.getEntityType()} ${remoteId}: entity not found`, {
          remoteId,
          source
        });
        return false;
      }

      // Usa EntityStateSystem per aggiornamenti standardizzati
      const success = EntityStateSystem.updateEntityState(
        this.ecs,
        entity,
        update,
        source
      );

      if (success) {
        // Aggiorna timestamp ultimo update
        const entityData = this.remoteEntities.get(remoteId);
        if (entityData) {
          entityData.lastUpdate = TimeManager.getCurrentTime();
        }

        // Gestisci aggiornamenti specifici dell'entità
        this.handleEntitySpecificUpdate(remoteId, update);
      }

      return success;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to update ${this.getEntityType()} ${remoteId} state`, error as Error, {
        remoteId,
        update,
        source
      });
      return false;
    }
  }

  /**
   * Sincronizza stato completo da server
   */
  protected syncRemoteEntityState(
    remoteId: string,
    fullState: any
  ): boolean {
    try {
      const entity = this.findRemoteEntity(remoteId);
      if (!entity) {
        LoggerWrapper.warn(LogCategory.ECS, `Cannot sync ${this.getEntityType()} ${remoteId}: entity not found`, {
          remoteId
        });
        return false;
      }

      // Usa EntityStateSystem per sincronizzazione completa
      const success = EntityStateSystem.syncEntityState(
        this.ecs,
        entity,
        fullState
      );

      if (success) {
        const entityData = this.remoteEntities.get(remoteId);
        if (entityData) {
          entityData.lastUpdate = TimeManager.getCurrentTime();
        }
      }

      return success;
    } catch (error) {
      LoggerWrapper.error(LogCategory.ECS, `Failed to sync ${this.getEntityType()} ${remoteId} state`, error as Error, {
        remoteId,
        fullState
      });
      return false;
    }
  }

  /**
   * Registra uno sprite per un tipo di entità
   */
  protected registerSprite(type: string, sprite: Sprite): void {
    this.sprites.set(type, sprite);
    LoggerWrapper.ecs(`${this.getEntityType()} sprite registered: ${type}`, {
      type,
      hasImage: !!sprite.image
    });
  }

  /**
   * Registra un AnimatedSprite per un tipo di entità
   */
  protected registerAnimatedSprite(type: string, animatedSprite: AnimatedSprite): void {
    this.animatedSprites.set(type, animatedSprite);
    LoggerWrapper.ecs(`${this.getEntityType()} animated sprite registered: ${type}`, {
      type,
      frameCount: animatedSprite.frameCount
    });
  }

  /**
   * Ottiene sprite per tipo (preferisce AnimatedSprite)
   */
  protected getSpriteForType(type: string): Sprite | AnimatedSprite | null {
    return this.animatedSprites.get(type) || this.sprites.get(type) || null;
  }

  /**
   * Crea componenti base per entità remote (Transform, InterpolationTarget)
   */
  protected createBaseEntityComponents(
    entity: Entity,
    x: number,
    y: number,
    rotation: number = 0
  ): void {
    // Componente Transform
    this.ecs.addComponent(entity, Transform, new Transform(x, y, rotation, 1, 1));

    // Componente InterpolationTarget se abilitato
    if (this.config.enableInterpolation) {
      this.ecs.addComponent(entity, InterpolationTarget, new InterpolationTarget(x, y, rotation));
    }
  }

  /**
   * Logga aggiornamenti bulk (throttled per evitare spam)
   */
  protected logBulkUpdate(updatesCount: number, source: string): void {
    const now = TimeManager.getCurrentTime();
    if (now - this.lastBulkUpdateLog > this.config.updateThrottleMs!) {
      LoggerWrapper.ecs(`${this.getEntityType()} bulk update: ${updatesCount} entities from ${source}`, {
        updatesCount,
        source,
        totalEntities: this.remoteEntities.size
      });
      this.lastBulkUpdateLog = now;
    }
  }

  /**
   * Ottiene statistiche del sistema
   */
  public getStats(): {
    entityType: string;
    totalEntities: number;
    registeredSprites: number;
    registeredAnimatedSprites: number;
    config: RemoteEntityConfig;
    entities: string[];
  } {
    return {
      entityType: this.getEntityType(),
      totalEntities: this.remoteEntities.size,
      registeredSprites: this.sprites.size,
      registeredAnimatedSprites: this.animatedSprites.size,
      config: this.config,
      entities: CollectionManager.getKeys(this.remoteEntities)
    };
  }

  /**
   * Cleanup risorse
   */
  public cleanup(): void {
    // Rimuovi tutte le entità remote
    const remoteIds = CollectionManager.getKeys(this.remoteEntities);
    for (const remoteId of remoteIds) {
      this.unregisterRemoteEntity(remoteId);
    }

    // Pulisci cache
    CollectionManager.clear(this.sprites);
    CollectionManager.clear(this.animatedSprites);

    LoggerWrapper.ecs(`${this.getEntityType()} system cleanup completed`, {
      removedEntities: remoteIds.length
    });
  }

  /**
   * Update periodico (implementazione base)
   */
  update(deltaTime: number): void {
    // Implementazione base - sottoclassi possono override per logica specifica
    // Es: gestione timeout entità remote, cleanup periodico, etc.
  }
}