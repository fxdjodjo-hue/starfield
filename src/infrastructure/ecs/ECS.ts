import { Entity, EntityIdGenerator } from './Entity';
import { Component } from './Component';
import { System } from './System';
import { Transform } from '../../entities/spatial/Transform';
import { Health } from '../../entities/combat/Health';
import { Damage } from '../../entities/combat/Damage';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';

/**
 * Cache per ottimizzare le query ECS più frequenti
 * Riduce la complessità da O(n) a O(1) per query cached
 * Implementa invalidazione intelligente basata sui tipi di componente modificati
 */
class EntityQueryCache {
  private cache = new Map<string, Set<number>>();
  private lastEntityCount = 0;

  /**
   * Ottiene entità dalla cache o calcola se necessario
   */
  getEntitiesWithComponents(
    ecs: ECS,
    componentTypes: (new (...args: any[]) => Component)[],
    currentEntityCount: number
  ): Entity[] {
    // Invalida cache se numero entità è cambiato (entità aggiunte/rimosse)
    if (currentEntityCount !== this.lastEntityCount) {
      this.cache.clear();
      this.lastEntityCount = currentEntityCount;
    }

    const cacheKey = this.getCacheKey(componentTypes);

    if (this.cache.has(cacheKey)) {
      // Restituisce copia dalla cache per evitare modifiche esterne
      const cachedIds = this.cache.get(cacheKey)!;
      return Array.from(cachedIds).map(id => new Entity(id));
    }

    // Calcola e cache il risultato
    const entities = ecs.getEntitiesWithComponentsUncached(...componentTypes);
    const entityIds = new Set(entities.map(e => e.id));
    this.cache.set(cacheKey, entityIds);

    return entities;
  }

  /**
   * Invalida cache in modo intelligente - solo le cache che includono il tipo di componente modificato
   */
  invalidateForComponent(componentType: new (...args: any[]) => Component): void {
    const componentTypeName = componentType.name;
    const keysToRemove: string[] = [];

    // Trova tutte le chiavi cache che includono questo tipo di componente
    for (const cacheKey of this.cache.keys()) {
      if (cacheKey.includes(componentTypeName)) {
        keysToRemove.push(cacheKey);
      }
    }

    // Rimuovi solo le cache influenzate
    for (const key of keysToRemove) {
      this.cache.delete(key);
    }
  }

  /**
   * Invalida completamente la cache (fallback per cambiamenti drastici)
   */
  invalidate(): void {
    this.cache.clear();
  }

  /**
   * Genera chiave cache basata sui tipi di componente
   */
  private getCacheKey(componentTypes: (new (...args: any[]) => Component)[]): string {
    return componentTypes.map(type => type.name).sort().join(',');
  }
}

/**
 * Entity Component System principale
 * Gestisce entità, componenti e sistemi
 */
export class ECS {
  private entities = new Set<number>();
  private components = new Map<new (...args: any[]) => Component, Map<number, Component>>();
  private systems: System[] = [];
  private queryCache = new EntityQueryCache();

  /**
   * Crea una nuova entità
   */
  createEntity(): Entity {
    const entity = EntityIdGenerator.createId();
    this.entities.add(entity.id);
    return entity;
  }

  /**
   * Rimuove un'entità e tutti i suoi componenti
   */
  removeEntity(entity: Entity): void {
    this.entities.delete(entity.id);

    // Rimuovi tutti i componenti dell'entità
    for (const componentMap of this.components.values()) {
      componentMap.delete(entity.id);
    }

    // Invalida cache quando entità vengono rimosse
    this.queryCache.invalidate();
  }

  /**
   * Aggiunge un componente a un'entità
   */
  addComponent<T extends Component>(
    entity: Entity,
    componentType: new (...args: any[]) => T,
    component: T
  ): void {
    if (!this.entities.has(entity.id)) {
      throw new Error(`Entity ${entity} does not exist`);
    }

    if (!this.components.has(componentType)) {
      this.components.set(componentType, new Map());
    }

    this.components.get(componentType)!.set(entity.id, component);

    // Invalida cache in modo intelligente per questo tipo di componente
    this.queryCache.invalidateForComponent(componentType);
  }

  /**
   * Rimuove un componente da un'entità
   */
  removeComponent<T extends Component>(
    entity: Entity,
    componentType: new (...args: any[]) => T
  ): void {
    const componentMap = this.components.get(componentType);
    if (componentMap) {
      componentMap.delete(entity.id);
      // Invalida cache in modo intelligente per questo tipo di componente
      this.queryCache.invalidateForComponent(componentType);
    }
  }

  /**
   * Ottiene un componente da un'entità
   */
  getComponent<T extends Component>(
    entity: Entity,
    componentType: new (...args: any[]) => T
  ): T | undefined {
    const componentMap = this.components.get(componentType);
    return componentMap?.get(entity.id) as T;
  }

  /**
   * Verifica se un'entità ha un componente
   */
  hasComponent<T extends Component>(
    entity: Entity,
    componentType: new (...args: any[]) => T
  ): boolean {
    const componentMap = this.components.get(componentType);
    return componentMap?.has(entity.id) ?? false;
  }

  /**
   * Verifica se un'entità esiste
   */
  entityExists(id: EntityId): boolean {
    return this.entities.has(id);
  }

  /**
   * Ottiene un'entità per ID
   */
  getEntity(id: EntityId): Entity | undefined {
    if (this.entities.has(id)) {
      return new Entity(id);
    }
    return undefined;
  }

  /**
   * Ottiene tutte le entità che hanno determinati componenti (con caching)
   */
  getEntitiesWithComponents(...componentTypes: (new (...args: any[]) => Component)[]): Entity[] {
    return this.queryCache.getEntitiesWithComponents(this, componentTypes, this.entities.size);
  }

  /**
   * Versione non-cached per calcoli interni e testing
   */
  getEntitiesWithComponentsUncached(...componentTypes: (new (...args: any[]) => Component)[]): Entity[] {
    const entities: Entity[] = [];

    for (const entityId of this.entities) {
      const entity = new Entity(entityId);
      const hasAllComponents = componentTypes.every(componentType =>
        this.hasComponent(entity, componentType)
      );

      if (hasAllComponents) {
        entities.push(entity);
      }
    }

    return entities;
  }

  /**
   * Aggiunge un sistema all'ECS
   */
  addSystem(system: System): void {
    this.systems.push(system);
  }

  /**
   * Rimuove un sistema dall'ECS
   */
  removeSystem(system: System): void {
    const index = this.systems.indexOf(system);
    if (index > -1) {
      this.systems.splice(index, 1);

      // Chiama cleanup del sistema se disponibile
      if (system.destroy) {
        try {
          system.destroy();
        } catch (error) {
          this.handleSystemError(system, error, 'destroy');
        }
      }
    }
  }

  /**
   * Restituisce tutti i sistemi registrati
   */
  getSystems(): System[] {
    return [...this.systems]; // Restituisce una copia per evitare modifiche esterne
  }

  /**
   * Aggiorna tutti i sistemi con error boundary strutturato
   */
  update(deltaTime: number): void {
    for (const system of this.systems) {
      try {
        system.update(deltaTime);
      } catch (error) {
        // Error boundary strutturato - non blocca altri sistemi
        this.handleSystemError(system, error, 'update');
      }
    }
  }

  /**
   * Render di tutti i sistemi che supportano il rendering con error boundary.
   * 
   * Note: Most visual rendering now uses PixiJS scene graph (updated in update()).
   * However, some systems like InterpolationSystem MUST run in render phase
   * to avoid tick-based acceleration bugs. See InterpolationSystem docs.
   */
  render(ctx: CanvasRenderingContext2D): void {
    for (const system of this.systems) {
      if (system.render) {
        try {
          system.render(ctx);
        } catch (error) {
          this.handleSystemError(system, error, 'render');
        }
      }
    }
  }

  /**
   * Gestisce errori di sistema in modo strutturato
   * Centralizza logging, recovery e monitoring
   */
  private handleSystemError(system: System, error: unknown, operation: string): void {
    const systemName = system.constructor.name;
    const timestamp = new Date().toISOString();

    // Logging strutturato con contesto
    const errorContext = {
      system: systemName,
      operation,
      timestamp,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };

    console.error(`[ECS] System failure:`, errorContext);

    // In produzione, possiamo aggiungere monitoring/telemetry
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrazione con servizio di monitoring (es. Sentry)
      // this.telemetry.reportSystemError(errorContext);
    }

    // Strategia di recovery: per ora continuiamo, ma possiamo estendere
    // - Disabilitare sistema temporaneamente
    // - Triggerare recovery automatico
    // - Notificare altri sistemi del fallimento
  }

  /**
   * Trova l'entità player (entità con Transform, Health, Damage ma senza SelectedNpc)
   * Usato dai sistemi che hanno bisogno di identificare il player
   */
  getPlayerEntity(): Entity | null {
    const playerEntities = this.getEntitiesWithComponents(Transform, Health, Damage)
      .filter(entity => !this.hasComponent(entity, SelectedNpc));

    return playerEntities.length > 0 ? playerEntities[0] : null;
  }

  /**
   * Alias per compatibilità - alcuni sistemi potrebbero ancora usare number
   * @deprecated Use entityExists(id: EntityId) instead
   */
  entityExistsByNumber(id: number): boolean {
    return this.entities.has(id);
  }

  /**
   * Alias per compatibilità
   * @deprecated Use getEntity(id: EntityId) instead
   */
  getEntityByNumber(id: number): Entity | undefined {
    if (this.entities.has(id)) {
      return new Entity(id);
    }
    return undefined;
  }

}
