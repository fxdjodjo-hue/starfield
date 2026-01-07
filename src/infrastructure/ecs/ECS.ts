import { Entity, EntityIdGenerator } from './Entity';
import { Component } from './Component';
import { System } from './System';
import { Transform } from '../../entities/spatial/Transform';
import { Health } from '../../entities/combat/Health';
import { Damage } from '../../entities/combat/Damage';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';

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
      return new Entity(id);
    }
    return undefined;
  }

  /**
   * Ottiene tutte le entità che hanno determinati componenti
   */
  getEntitiesWithComponents(...componentTypes: (new (...args: any[]) => Component)[]): Entity[] {
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
    }
  }

  /**
   * Restituisce tutti i sistemi registrati
   */
  getSystems(): System[] {
    return [...this.systems]; // Restituisce una copia per evitare modifiche esterne
  }

  /**
   * Aggiorna tutti i sistemi con error boundary
   */
  update(deltaTime: number): void {
    for (const system of this.systems) {
      try {
        system.update(deltaTime);
      } catch (error) {
        // Log dell'errore ma continua con gli altri sistemi
        console.error(`[ECS] System ${system.constructor.name} failed during update:`, error);

        // In development, possiamo anche loggare lo stack trace
        if (process.env.NODE_ENV === 'development') {
          console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
        }

        // Continua con il prossimo sistema invece di bloccare tutto
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
          // Log dell'errore ma continua con gli altri sistemi
          console.error(`[ECS] System ${system.constructor.name} failed during render:`, error);

          // In development, possiamo anche loggare lo stack trace
          if (process.env.NODE_ENV === 'development') {
            console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
          }

          // Continua con il prossimo sistema invece di bloccare tutto il rendering
        }
      }
    }
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
}
