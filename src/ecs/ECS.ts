import { Entity, EntityIdGenerator } from './Entity';
import { Component } from './Component';
import { System } from './System';

console.log('ECS module loaded, EntityIdGenerator:', typeof EntityIdGenerator);

/**
 * Entity Component System principale
 * Gestisce entità, componenti e sistemi
 */
export class ECS {
  private entities = new Set<number>();
  private components = new Map<new (...args: any[]) => Component, Map<number, Component>>();
  private systems: System[] = [];

  /**
   * Crea una nuova entità
   */
  createEntity(): Entity {
    console.log('ECS.createEntity called, EntityIdGenerator:', typeof EntityIdGenerator);
    const entity = EntityIdGenerator.createId();
    console.log('Created entity:', entity);
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
   * Ottiene tutte le entità che hanno determinati componenti
   */
  getEntitiesWithComponents(...componentTypes: (new (...args: any[]) => Component)[]): Entity[] {
    const entities: Entity[] = [];
    console.log(`ECS: Querying entities with ${componentTypes.length} component types`);

    for (const entityId of this.entities) {
      const entity = new Entity(entityId);
      const hasAllComponents = componentTypes.every(componentType =>
        this.hasComponent(entity, componentType)
      );

      if (hasAllComponents) {
        console.log(`ECS: Found entity ${entityId} with all required components`);
        entities.push(entity);
      }
    }

    console.log(`ECS: Total entities found: ${entities.length}`);
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
    }
  }

  /**
   * Aggiorna tutti i sistemi
   */
  update(deltaTime: number): void {
    for (const system of this.systems) {
      system.update(deltaTime);
    }
  }

  /**
   * Render di tutti i sistemi che supportano il rendering
   */
  render(ctx: CanvasRenderingContext2D): void {
    for (const system of this.systems) {
      if (system.render) {
        system.render(ctx);
      }
    }
  }
}
