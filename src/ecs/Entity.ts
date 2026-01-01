/**
 * Entity rappresentata come semplice ID numerico
 * In futuro potrà essere estesa con metadata se necessario
 */
export class Entity {
  constructor(public id: number) {}

  toString(): string {
    return `Entity(${this.id})`;
  }

  valueOf(): number {
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

  static createIdValue(): number {
    return this.nextId++;
  }
}
