import { describe, it, expect, vi } from 'vitest';
import { System } from '../../../infrastructure/ecs/System';
import { ECS } from '../../../infrastructure/ecs/ECS';

// Test system implementation
class TestSystem extends System {
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

describe('System', () => {
  let ecs: ECS;
  let system: TestSystem;

  beforeEach(() => {
    ecs = new ECS();
    system = new TestSystem(ecs);
  });

  it('should store ecs reference', () => {
    expect(system.ecs).toBe(ecs);
  });

  it('should call update with deltaTime', () => {
    const deltaTime = 16.67;
    system.update(deltaTime);

    expect(system.updateCalled).toBe(true);
    expect(system.lastDeltaTime).toBe(deltaTime);
  });

  it('should call render when render method exists', () => {
    const mockCtx = {} as CanvasRenderingContext2D;
    system.render(mockCtx);

    expect(system.renderCalled).toBe(true);
  });
});

