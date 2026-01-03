import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Component } from '../../infrastructure/ecs/Component';
import { System } from '../../infrastructure/ecs/System';
import { Transform } from '../../entities/spatial/Transform';
import { Health } from '../../entities/combat/Health';
import { Damage } from '../../entities/combat/Damage';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';

// Mock components for testing
class MockComponent extends Component {
  constructor(public value: string = 'test') {
    super();
  }
}

class MockComponent2 extends Component {
  constructor(public number: number = 42) {
    super();
  }
}

// Mock system for testing
class MockSystem extends System {
  public updateCalled = false;
  public renderCalled = false;
  public lastDeltaTime = 0;

  update(deltaTime: number): void {
    this.updateCalled = true;
    this.lastDeltaTime = deltaTime;
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderCalled = true;
  }
}

describe('ECS', () => {
  let ecs: ECS;

  beforeEach(() => {
    ecs = new ECS();
  });

  describe('Entity Management', () => {
    it('should create entities with unique ids', () => {
      const entity1 = ecs.createEntity();
      const entity2 = ecs.createEntity();

      expect(entity1).toBeInstanceOf(Entity);
      expect(entity2).toBeInstanceOf(Entity);
      expect(entity1.id).not.toBe(entity2.id);
    });

    it('should check if entity exists', () => {
      const entity = ecs.createEntity();

      expect(ecs.entityExists(entity.id)).toBe(true);
      expect(ecs.entityExists(999)).toBe(false);
    });

    it('should get entity by id', () => {
      const entity = ecs.createEntity();
      const retrieved = ecs.getEntity(entity.id);

      expect(retrieved).toBeInstanceOf(Entity);
      expect(retrieved?.id).toBe(entity.id);
    });

    it('should return undefined for non-existent entity', () => {
      const retrieved = ecs.getEntity(999);
      expect(retrieved).toBeUndefined();
    });

    it('should remove entity', () => {
      const entity = ecs.createEntity();
      expect(ecs.entityExists(entity.id)).toBe(true);

      ecs.removeEntity(entity);
      expect(ecs.entityExists(entity.id)).toBe(false);
    });
  });

  describe('Component Management', () => {
    let entity: Entity;

    beforeEach(() => {
      entity = ecs.createEntity();
    });

    it('should add component to entity', () => {
      const component = new MockComponent('test');

      ecs.addComponent(entity, MockComponent, component);

      expect(ecs.hasComponent(entity, MockComponent)).toBe(true);
    });

    it('should throw error when adding component to non-existent entity', () => {
      const fakeEntity = new Entity(999);
      const component = new MockComponent();

      expect(() => {
        ecs.addComponent(fakeEntity, MockComponent, component);
      }).toThrow('Entity Entity(999) does not exist');
    });

    it('should get component from entity', () => {
      const component = new MockComponent('test');
      ecs.addComponent(entity, MockComponent, component);

      const retrieved = ecs.getComponent(entity, MockComponent);
      expect(retrieved).toBe(component);
      expect(retrieved?.value).toBe('test');
    });

    it('should return undefined for non-existent component', () => {
      const retrieved = ecs.getComponent(entity, MockComponent);
      expect(retrieved).toBeUndefined();
    });

    it('should remove component from entity', () => {
      const component = new MockComponent();
      ecs.addComponent(entity, MockComponent, component);

      expect(ecs.hasComponent(entity, MockComponent)).toBe(true);

      ecs.removeComponent(entity, MockComponent);
      expect(ecs.hasComponent(entity, MockComponent)).toBe(false);
    });

    it('should handle multiple component types', () => {
      const comp1 = new MockComponent('first');
      const comp2 = new MockComponent2(123);

      ecs.addComponent(entity, MockComponent, comp1);
      ecs.addComponent(entity, MockComponent2, comp2);

      expect(ecs.hasComponent(entity, MockComponent)).toBe(true);
      expect(ecs.hasComponent(entity, MockComponent2)).toBe(true);
      expect(ecs.getComponent(entity, MockComponent)?.value).toBe('first');
      expect(ecs.getComponent(entity, MockComponent2)?.number).toBe(123);
    });

    it('should remove components when entity is removed', () => {
      const component = new MockComponent();
      ecs.addComponent(entity, MockComponent, component);

      expect(ecs.hasComponent(entity, MockComponent)).toBe(true);

      ecs.removeEntity(entity);
      expect(ecs.hasComponent(entity, MockComponent)).toBe(false);
    });
  });

  describe('Query System', () => {
    it('should get entities with specific components', () => {
      const entity1 = ecs.createEntity();
      const entity2 = ecs.createEntity();
      const entity3 = ecs.createEntity();

      const comp1 = new MockComponent();
      const comp2 = new MockComponent2();

      ecs.addComponent(entity1, MockComponent, comp1);
      ecs.addComponent(entity1, MockComponent2, comp2);

      ecs.addComponent(entity2, MockComponent, comp1);

      // entity3 has no components

      const entitiesWithBoth = ecs.getEntitiesWithComponents(MockComponent, MockComponent2);
      const entitiesWithOne = ecs.getEntitiesWithComponents(MockComponent);

      expect(entitiesWithBoth).toHaveLength(1);
      expect(entitiesWithBoth[0].id).toBe(entity1.id);

      expect(entitiesWithOne).toHaveLength(2);
      expect(entitiesWithOne.map(e => e.id)).toContain(entity1.id);
      expect(entitiesWithOne.map(e => e.id)).toContain(entity2.id);
    });
  });

  describe('System Management', () => {
    it('should add and update systems', () => {
      const system = new MockSystem(ecs);
      ecs.addSystem(system);

      ecs.update(16.67);

      expect(system.updateCalled).toBe(true);
      expect(system.lastDeltaTime).toBe(16.67);
    });

    it('should render systems that support rendering', () => {
      const system = new MockSystem(ecs);
      ecs.addSystem(system);

      const mockCtx = {} as CanvasRenderingContext2D;
      ecs.render(mockCtx);

      expect(system.renderCalled).toBe(true);
    });

    it('should remove system', () => {
      const system = new MockSystem(ecs);
      ecs.addSystem(system);

      expect(system.updateCalled).toBe(false);

      ecs.update(16.67);
      expect(system.updateCalled).toBe(true);

      system.updateCalled = false;
      ecs.removeSystem(system);
      ecs.update(16.67);

      expect(system.updateCalled).toBe(false);
    });
  });

  describe('Player Entity Helper', () => {
    it('should return null when no player entity exists', () => {
      const player = ecs.getPlayerEntity();
      expect(player).toBeNull();
    });

    it('should return player entity with required components', () => {
      const playerEntity = ecs.createEntity();
      const npcEntity = ecs.createEntity();

      // Add player components
      ecs.addComponent(playerEntity, Transform, new Transform(0, 0));
      ecs.addComponent(playerEntity, Health, new Health(100, 100));
      ecs.addComponent(playerEntity, Damage, new Damage(25, 100, 1000));

      // Add NPC components (same as player but with SelectedNpc)
      ecs.addComponent(npcEntity, Transform, new Transform(10, 10));
      ecs.addComponent(npcEntity, Health, new Health(50, 50));
      ecs.addComponent(npcEntity, Damage, new Damage(10, 50, 2000));
      ecs.addComponent(npcEntity, SelectedNpc, new SelectedNpc());

      const foundPlayer = ecs.getPlayerEntity();
      expect(foundPlayer?.id).toBe(playerEntity.id);
    });

    it('should return null when player has SelectedNpc component', () => {
      const playerEntity = ecs.createEntity();

      ecs.addComponent(playerEntity, Transform, new Transform(0, 0));
      ecs.addComponent(playerEntity, Health, new Health(100, 100));
      ecs.addComponent(playerEntity, Damage, new Damage(25, 100, 1000));
      ecs.addComponent(playerEntity, SelectedNpc, new SelectedNpc()); // This makes it not a player

      const foundPlayer = ecs.getPlayerEntity();
      expect(foundPlayer).toBeNull();
    });
  });
});
