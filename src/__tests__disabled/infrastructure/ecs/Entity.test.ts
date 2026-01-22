import { describe, it, expect } from 'vitest';
import { Entity, EntityIdGenerator } from '../../../infrastructure/ecs/Entity';

describe('Entity', () => {
  it('should create entity with given id', () => {
    const entity = new Entity(42);
    expect(entity.id).toBe(42);
  });

  it('should convert to string representation', () => {
    const entity = new Entity(42);
    expect(entity.toString()).toBe('Entity(42)');
  });

  it('should return id as primitive value', () => {
    const entity = new Entity(42);
    expect(entity.valueOf()).toBe(42);
  });
});

describe('EntityIdGenerator', () => {
  it('should create unique entity ids', () => {
    const entity1 = EntityIdGenerator.createId();
    const entity2 = EntityIdGenerator.createId();

    expect(entity1.id).toBe(0);
    expect(entity2.id).toBe(1);
    expect(entity1.id).not.toBe(entity2.id);
  });

  it('should create unique id values', () => {
    const id1 = EntityIdGenerator.createIdValue();
    const id2 = EntityIdGenerator.createIdValue();

    expect(id1).toBe(2);
    expect(id2).toBe(3);
    expect(id1).not.toBe(id2);
  });
});
import { Entity } from '../../../infrastructure/ecs/Entity';
import { EntityIdGenerator } from '../../../infrastructure/ecs/Entity';

describe('Entity', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Entity();
    expect(instance).toBeDefined();
  });

  it('should have toString method', () => {
    const instance = new Entity();
    expect(typeof instance.toString).toBe('function');
  });

  it('should have valueOf method', () => {
    const instance = new Entity();
    expect(typeof instance.valueOf).toBe('function');
  });

});

describe('EntityIdGenerator', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new EntityIdGenerator();
    expect(instance).toBeDefined();
  });

  it('should have toString method', () => {
    const instance = new EntityIdGenerator();
    expect(typeof instance.toString).toBe('function');
  });

  it('should have valueOf method', () => {
    const instance = new EntityIdGenerator();
    expect(typeof instance.valueOf).toBe('function');
  });

});


