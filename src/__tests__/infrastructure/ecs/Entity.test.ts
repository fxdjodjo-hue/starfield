import { describe, it, expect } from 'vitest';
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


