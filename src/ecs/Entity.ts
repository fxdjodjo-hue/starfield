/**
 * Entity rappresentata come semplice ID numerico
 * In futuro potrà essere estesa con metadata se necessario
 */
export class Entity {
  public id: number;

  constructor(id: number) {
    this.id = id;
  }

  toString(): string {
    return `Entity(${this.id})`;
  }

  valueOf(): number {
    return this.id;
  }
}

console.log('Entity module loaded');

/**
 * Generatore di ID unici per le entità
 */
export class EntityIdGenerator {
  private static nextId = 0;

  static createId(): Entity {
    console.log('EntityIdGenerator.createId called');
    return new Entity(this.nextId++);
  }

  static createIdValue(): number {
    return this.nextId++;
  }
}
