/**
 * Branded type per Entity ID - type safety per ID di entità
 */
export type EntityId = number & { readonly __brand: unique symbol };

/**
 * Entity rappresentata come semplice ID numerico
 * In futuro potrà essere estesa con metadata se necessario
 */
export class Entity {
  public readonly id: EntityId;

  constructor(id: number) {
    this.id = id as EntityId;
  }

  toString(): string {
    return `Entity(${this.id})`;
  }

  valueOf(): EntityId {
    return this.id;
  }
}

/**
 * Generatore di ID unici per le entità
 */
export class EntityIdGenerator {
  private static nextId = 0;

  static createId(): Entity {
    return new Entity(this.nextId++);
  }

  static createIdValue(): EntityId {
    return this.nextId++ as EntityId;
  }
}
