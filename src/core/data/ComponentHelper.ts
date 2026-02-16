/**
 * ComponentHelper - Helper centralizzato per accesso componenti ECS
 * Sostituisce getComponent ripetuto in tutto il progetto con caching e sicurezza
 */

import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { CollectionManager } from './CollectionManager';

export class ComponentHelper {
  private static componentCache: Map<string, any> = new Map();
  private static cacheEnabled: boolean = true;
  private static readonly MAX_CACHE_SIZE = 3000;

  /**
   * Cache write with bounded size to avoid unbounded memory growth
   * when many transient entities are created (projectiles, effects, etc.).
   */
  private static setCacheEntry(cacheKey: string, value: any): void {
    this.componentCache.set(cacheKey, value);

    // Keep cache bounded to prevent progressive FPS degradation over time.
    if (this.componentCache.size > this.MAX_CACHE_SIZE) {
      this.maintainCache(this.MAX_CACHE_SIZE);
    }
  }

  /**
   * Abilita/disabilita il caching dei componenti
   */
  static setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      CollectionManager.clear(this.componentCache);
    }
  }

  /**
   * Ottiene un componente Transform con caching
   */
  static getTransform(ecs: ECS, entity: Entity): Transform | null {
    const cacheKey = `transform_${entity.id}`;
    if (this.cacheEnabled && this.componentCache.has(cacheKey)) {
      return this.componentCache.get(cacheKey);
    }

    try {
      const transform = ecs.getComponent(entity, Transform);
      if (this.cacheEnabled && transform) {
        this.setCacheEntry(cacheKey, transform);
      }
      return transform || null;
    } catch (error) {
      console.error('ComponentHelper: Failed to get Transform:', error);
      return null;
    }
  }

  /**
   * Ottiene un componente Velocity con caching
   */
  static getVelocity(ecs: ECS, entity: Entity): Velocity | null {
    const cacheKey = `velocity_${entity.id}`;
    if (this.cacheEnabled && this.componentCache.has(cacheKey)) {
      return this.componentCache.get(cacheKey);
    }

    try {
      const velocity = ecs.getComponent(entity, Velocity);
      if (this.cacheEnabled && velocity) {
        this.setCacheEntry(cacheKey, velocity);
      }
      return velocity || null;
    } catch (error) {
      console.error('ComponentHelper: Failed to get Velocity:', error);
      return null;
    }
  }

  /**
   * Ottiene un componente Health con caching
   */
  static getHealth(ecs: ECS, entity: Entity): Health | null {
    const cacheKey = `health_${entity.id}`;
    if (this.cacheEnabled && this.componentCache.has(cacheKey)) {
      return this.componentCache.get(cacheKey);
    }

    try {
      const health = ecs.getComponent(entity, Health);
      if (this.cacheEnabled && health) {
        this.setCacheEntry(cacheKey, health);
      }
      return health || null;
    } catch (error) {
      console.error('ComponentHelper: Failed to get Health:', error);
      return null;
    }
  }

  /**
   * Ottiene un componente Shield con caching
   */
  static getShield(ecs: ECS, entity: Entity): Shield | null {
    const cacheKey = `shield_${entity.id}`;
    if (this.cacheEnabled && this.componentCache.has(cacheKey)) {
      return this.componentCache.get(cacheKey);
    }

    try {
      const shield = ecs.getComponent(entity, Shield);
      if (this.cacheEnabled && shield) {
        this.setCacheEntry(cacheKey, shield);
      }
      return shield || null;
    } catch (error) {
      console.error('ComponentHelper: Failed to get Shield:', error);
      return null;
    }
  }

  /**
   * Ottiene un componente Damage con caching
   */
  static getDamage(ecs: ECS, entity: Entity): Damage | null {
    const cacheKey = `damage_${entity.id}`;
    if (this.cacheEnabled && this.componentCache.has(cacheKey)) {
      return this.componentCache.get(cacheKey);
    }

    try {
      const damage = ecs.getComponent(entity, Damage);
      if (this.cacheEnabled && damage) {
        this.setCacheEntry(cacheKey, damage);
      }
      return damage || null;
    } catch (error) {
      console.error('ComponentHelper: Failed to get Damage:', error);
      return null;
    }
  }

  /**
   * Verifica se un'entità ha un componente specifico
   */
  static hasComponent(ecs: ECS, entity: Entity, componentType: any): boolean {
    try {
      return ecs.hasComponent(entity, componentType);
    } catch (error) {
      console.error('ComponentHelper: Failed to check component existence:', error);
      return false;
    }
  }

  /**
   * Ottiene posizione (x, y) da Transform
   */
  static getPosition(ecs: ECS, entity: Entity): { x: number; y: number } | null {
    const transform = this.getTransform(ecs, entity);
    return transform ? { x: transform.x, y: transform.y } : null;
  }

  /**
   * Ottiene rotazione da Transform
   */
  static getRotation(ecs: ECS, entity: Entity): number | null {
    const transform = this.getTransform(ecs, entity);
    return transform ? transform.rotation : null;
  }

  /**
   * Ottiene velocità (x, y) da Velocity
   */
  static getVelocityXY(ecs: ECS, entity: Entity): { x: number; y: number } | null {
    const velocity = this.getVelocity(ecs, entity);
    return velocity ? { x: velocity.x, y: velocity.y } : null;
  }

  /**
   * Ottiene statistiche salute (current, max) da Health
   */
  static getHealthStats(ecs: ECS, entity: Entity): { current: number; max: number } | null {
    const health = this.getHealth(ecs, entity);
    return health ? { current: health.current, max: health.max } : null;
  }

  /**
   * Ottiene statistiche scudo (current, max) da Shield
   */
  static getShieldStats(ecs: ECS, entity: Entity): { current: number; max: number } | null {
    const shield = this.getShield(ecs, entity);
    return shield ? { current: shield.current, max: shield.max } : null;
  }

  /**
   * Aggiorna posizione di un'entità
   */
  static updatePosition(ecs: ECS, entity: Entity, x: number, y: number, rotation?: number): boolean {
    try {
      const transform = this.getTransform(ecs, entity);
      if (!transform) return false;

      transform.x = x;
      transform.y = y;
      if (rotation !== undefined) {
        transform.rotation = rotation;
      }

      // Invalida cache per questa entità
      this.invalidateEntityCache(entity.id);

      return true;
    } catch (error) {
      console.error('ComponentHelper: Failed to update position:', error);
      return false;
    }
  }

  /**
   * Aggiorna salute di un'entità
   */
  static updateHealth(ecs: ECS, entity: Entity, current: number, max?: number): boolean {
    try {
      const health = this.getHealth(ecs, entity);
      if (!health) return false;

      health.current = current;
      if (max !== undefined) {
        health.max = max;
      }

      // Invalida cache per questa entità
      this.invalidateEntityCache(entity.id);

      return true;
    } catch (error) {
      console.error('ComponentHelper: Failed to update health:', error);
      return false;
    }
  }

  /**
   * Aggiorna scudo di un'entità
   */
  static updateShield(ecs: ECS, entity: Entity, current: number, max?: number): boolean {
    try {
      const shield = this.getShield(ecs, entity);
      if (!shield) return false;

      shield.current = current;
      if (max !== undefined) {
        shield.max = max;
      }

      // Invalida cache per questa entità
      this.invalidateEntityCache(entity.id);

      return true;
    } catch (error) {
      console.error('ComponentHelper: Failed to update shield:', error);
      return false;
    }
  }

  /**
   * Invalida la cache per una specifica entità
   */
  static invalidateEntityCache(entityId: number): void {
    if (!this.cacheEnabled) return;

    // Rimuovi tutte le cache entries per questa entità
    const keysToDelete: string[] = [];
    for (const key of this.componentCache.keys()) {
      if (key.includes(`_${entityId}`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.componentCache.delete(key));
  }

  /**
   * Pulisce completamente la cache
   */
  static clearCache(): void {
    CollectionManager.clear(this.componentCache);
  }

  /**
   * Mantiene la cache entro limiti ragionevoli per prevenire memory leaks
   */
  static maintainCache(maxSize: number = 1000): void {
    if (this.componentCache.size > maxSize) {
      // Rimuovi le entries più vecchie (semplice strategia FIFO)
      const entries = Array.from(this.componentCache.entries());
      const toRemove = entries.slice(0, this.componentCache.size - maxSize);
      toRemove.forEach(([key]) => this.componentCache.delete(key));
    }
  }

  /**
   * Ottiene statistiche sulla cache
   */
  static getCacheStats() {
    return CollectionManager.getStats(this.componentCache);
  }
}
