import { Entity, EntityIdGenerator, type EntityId } from './Entity';
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
  private cache = new Map<string, Entity[]>();
  // reverseIndex: componentName -> Set of cacheKeys that use it
  private reverseIndex = new Map<string, Set<string>>();
  // queryComponents: cacheKey -> Array of component constructors
  private queryComponents = new Map<string, (new (...args: any[]) => Component)[]>();

  // Diagnostic counters
  public totalInvalidations = 0;
  public totalRecomputations = 0;
  public totalInvalidationTimeMs = 0;
  // componentName -> number of times it caused invalidation
  public componentInvalidationStats = new Map<string, number>();

  /**
   * Ottiene entità dalla cache in modalità READONLY.
   * EVITA l'allocazione di nuovi array ad ogni frame se il risultato è già in cache.
   */
  getEntitiesWithComponentsReadOnly(
    ecs: ECS,
    componentTypes: (new (...args: any[]) => Component)[]
  ): readonly Entity[] {
    const cacheKey = this.getCacheKey(componentTypes);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Calcola e cache il risultato
    this.totalRecomputations++;
    const entities = ecs.getEntitiesWithComponentsUncached(...componentTypes);

    // Registra nella cache e nel reverse index
    this.cache.set(cacheKey, entities);
    this.queryComponents.set(cacheKey, [...componentTypes]);

    for (const type of componentTypes) {
      const typeName = type.name;
      if (!this.reverseIndex.has(typeName)) {
        this.reverseIndex.set(typeName, new Set());
      }
      this.reverseIndex.get(typeName)!.add(cacheKey);
    }

    return entities;
  }

  /**
   * Invalida intelligente per AGGIUNTA di un componente.
   * Un'aggiunta invalida una query SOLO SE l'entità ora soddisfa TUTTI i componenti della query.
   */
  invalidateAddition(
    ecs: ECS,
    entity: Entity,
    addedComponentType: new (...args: any[]) => Component,
    entityComponentSet: Set<string>
  ): void {
    const startTime = performance.now();
    const typeName = addedComponentType.name;
    const affectedKeys = this.reverseIndex.get(typeName);

    if (!affectedKeys) return;

    let invalidationsInThisCall = 0;
    for (const cacheKey of affectedKeys) {
      // Lazy auto-clean stale keys
      if (!this.cache.has(cacheKey)) {
        affectedKeys.delete(cacheKey);
        continue;
      }

      const requiredTypes = this.queryComponents.get(cacheKey);
      if (!requiredTypes) continue;

      // Verifica se l'entità ora soddisfa l'intera query
      let matchesAll = true;
      for (const reqType of requiredTypes) {
        if (!entityComponentSet.has(reqType.name)) {
          matchesAll = false;
          break;
        }
      }

      if (matchesAll) {
        if (this.cache.delete(cacheKey)) {
          this.queryComponents.delete(cacheKey);
          invalidationsInThisCall++;
          this.totalInvalidations++;
        }
      }
    }

    if (invalidationsInThisCall > 0) {
      this.componentInvalidationStats.set(typeName, (this.componentInvalidationStats.get(typeName) || 0) + 1);
    }
    this.totalInvalidationTimeMs += (performance.now() - startTime);
  }

  /**
   * Invalida intelligente per RIMOZIONE di un componente o entità.
   * Una rimozione invalida una query SOLO SE l'entità soddisfaceva la query PRIMA della rimozione.
   */
  invalidateRemoval(
    removedComponentType: new (...args: any[]) => Component,
    entityMatchesQueryBefore: (requiredTypes: (new (...args: any[]) => Component)[]) => boolean
  ): void {
    const startTime = performance.now();
    const typeName = removedComponentType.name;
    const affectedKeys = this.reverseIndex.get(typeName);

    if (!affectedKeys) return;

    let invalidationsInThisCall = 0;
    for (const cacheKey of affectedKeys) {
      // Lazy auto-clean stale keys
      if (!this.cache.has(cacheKey)) {
        affectedKeys.delete(cacheKey);
        continue;
      }

      const requiredTypes = this.queryComponents.get(cacheKey);
      if (!requiredTypes) continue;

      // Se l'entità soddisfaceva la query prima, allora la rimozione la invalida
      if (entityMatchesQueryBefore(requiredTypes)) {
        if (this.cache.delete(cacheKey)) {
          this.queryComponents.delete(cacheKey);
          invalidationsInThisCall++;
          this.totalInvalidations++;
        }
      }
    }

    if (invalidationsInThisCall > 0) {
      this.componentInvalidationStats.set(typeName, (this.componentInvalidationStats.get(typeName) || 0) + 1);
    }
    this.totalInvalidationTimeMs += (performance.now() - startTime);
  }

  /**
   * Invalida completamente la cache
   */
  invalidate(): void {
    this.totalInvalidations += this.cache.size;
    this.cache.clear();
    this.reverseIndex.clear();
    this.queryComponents.clear();
  }

  /**
   * Invalida la query speciale "__all__"
   */
  invalidateAllEntitiesQuery(): void {
    if (this.cache.has("__all__")) {
      this.cache.delete("__all__");
      this.totalInvalidations++;
    }
  }

  getEntitiesWithComponents(
    ecs: ECS,
    componentTypes: (new (...args: any[]) => Component)[]
  ): Entity[] {
    return (this.getEntitiesWithComponentsReadOnly(ecs, componentTypes) as Entity[]).slice();
  }

  private getCacheKey(componentTypes: (new (...args: any[]) => Component)[]): string {
    if (componentTypes.length === 0) return "__all__";
    return componentTypes.map(type => type.name).sort().join(',');
  }
}




/**
 * Entity Component System principale
 * Gestisce entità, componenti e sistemi
 */
export class ECS {
  private entities = new Set<number>();
  private entityPool = new Map<number, Entity>();
  private components = new Map<new (...args: any[]) => Component, Map<number, Component>>();
  private systems: System[] = [];
  public queryCache = new EntityQueryCache();

  // entityId -> Set of component names (tracked for smart invalidation)
  private entityComponentSets = new Map<number, Set<string>>();


  /**
   * Crea una nuova entità
   */
  createEntity(): Entity {
    const entity = EntityIdGenerator.createId();
    this.entities.add(entity.id);
    this.entityPool.set(entity.id, entity);

    // Invalida la query speciale "__all__"
    this.queryCache.invalidateAllEntitiesQuery();

    return entity;
  }


  /**
   * Rimuovi un'entità e tutti i suoi componenti
   */
  removeEntity(entity: Entity): void {
    if (!this.entities.has(entity.id)) return;

    const componentNames = this.entityComponentSets.get(entity.id);

    // Rimuovi tutti i componenti dell'entità
    for (const [componentType, componentMap] of this.components.entries()) {
      if (componentMap.has(entity.id)) {
        // Smart Invalidation: check if it matched BEFORE removal
        if (componentNames) {
          this.queryCache.invalidateRemoval(componentType, (requiredTypes) => {
            return requiredTypes.every(type => componentNames.has(type.name));
          });
        }

        componentMap.delete(entity.id);
      }
    }

    // Cleanup strutture dati
    this.entityComponentSets.delete(entity.id);
    this.entities.delete(entity.id);
    this.entityPool.delete(entity.id);

    // Invalida solo la query speciale "__all__"
    this.queryCache.invalidateAllEntitiesQuery();
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

    // Update entity component set
    let componentSet = this.entityComponentSets.get(entity.id);
    if (!componentSet) {
      componentSet = new Set();
      this.entityComponentSets.set(entity.id, componentSet);
    }
    componentSet.add(componentType.name);

    // Smart Invalidation: check addition impact
    this.queryCache.invalidateAddition(this, entity, componentType, componentSet);
  }


  /**
   * Rimuove un componente da un'entità
   */
  removeComponent<T extends Component>(
    entity: Entity,
    componentType: new (...args: any[]) => T
  ): void {
    const componentMap = this.components.get(componentType);
    const componentNames = this.entityComponentSets.get(entity.id);

    if (componentMap && componentMap.has(entity.id) && componentNames) {
      // Smart Invalidation: check if it matched BEFORE removal
      this.queryCache.invalidateRemoval(componentType, (requiredTypes) => {
        return requiredTypes.every(type => componentNames.has(type.name));
      });

      componentMap.delete(entity.id);
      componentNames.delete(componentType.name);
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
  entityExists(id: number): boolean {
    return this.entities.has(id);
  }

  /**
   * Ottiene un'entità per ID
   */
  getEntity(id: number): Entity | undefined {
    if (this.entities.has(id)) {
      return this.getOrCreateEntity(id);
    }
    return undefined;
  }

  /**
   * Ottiene tutte le entità che hanno determinati componenti (con caching).
   * Restituisce una copia dell'array (sicuro ma alloca memoria).
   */
  getEntitiesWithComponents(...componentTypes: (new (...args: any[]) => Component)[]): Entity[] {
    return this.queryCache.getEntitiesWithComponents(this, componentTypes);
  }

  /**
   * Ottiene tutte le entità che hanno determinati componenti (con caching).
   * Restituisce un array READONLY (zero allocazione se in cache).
   * USATE questo per i sistemi che girano ogni frame.
   */
  getEntitiesWithComponentsReadOnly(...componentTypes: (new (...args: any[]) => Component)[]): readonly Entity[] {
    return this.queryCache.getEntitiesWithComponentsReadOnly(this, componentTypes);
  }



  /**
   * Versione non-cached per calcoli interni e testing
   */
  getEntitiesWithComponentsUncached(...componentTypes: (new (...args: any[]) => Component)[]): Entity[] {
    const entities: Entity[] = [];

    // Nessun filtro componenti: restituisce tutte le entità in ordine di inserimento
    if (componentTypes.length === 0) {
      for (const entityId of this.entities) {
        entities.push(this.getOrCreateEntity(entityId));
      }
      return entities;
    }

    const componentMaps: Map<number, Component>[] = [];
    for (const componentType of componentTypes) {
      const componentMap = this.components.get(componentType);
      if (!componentMap) {
        return entities; // Nessuna entità può soddisfare tutti i componenti richiesti
      }
      componentMaps.push(componentMap);
    }

    for (const entityId of this.entities) {
      let hasAllComponents = true;
      for (const componentMap of componentMaps) {
        if (!componentMap.has(entityId)) {
          hasAllComponents = false;
          break;
        }
      }

      if (hasAllComponents) {
        entities.push(this.getOrCreateEntity(entityId));
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
   * Render di tutti i sistemi che supportano il rendering con error boundary
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
    // In produzione, possiamo aggiungere monitoring/telemetry
    // if (process.env.NODE_ENV === 'production') {
    // TODO: Integrazione con servizio di monitoring (es. Sentry)
    // this.telemetry.reportSystemError(errorContext);
    // }

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
    const playerEntities = this.getEntitiesWithComponents(Transform, Health, Damage);
    for (const entity of playerEntities) {
      if (!this.hasComponent(entity, SelectedNpc)) {
        return entity;
      }
    }
    return null;
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
      return this.getOrCreateEntity(id);
    }
    return undefined;
  }

  /**
   * Restituisce un wrapper Entity stabile per ID.
   * Riduce allocazioni ripetute nei loop ad alta frequenza.
   */
  private getOrCreateEntity(id: number): Entity {
    let entity = this.entityPool.get(id);
    if (!entity) {
      entity = new Entity(id);
      this.entityPool.set(id, entity);
    }
    return entity;
  }

}
