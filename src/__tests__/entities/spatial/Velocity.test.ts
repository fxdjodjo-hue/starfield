import { describe, it, expect } from 'vitest';
import { Velocity } from '../../../entities/spatial/Velocity';

describe('Velocity', () => {
  it('should create velocity with default values', () => {
    const velocity = new Velocity();

    expect(velocity.x).toBe(0);
    expect(velocity.y).toBe(0);
    expect(velocity.angular).toBe(0);
  });

  it('should create velocity with custom values', () => {
    const velocity = new Velocity(10, -5, Math.PI / 4);

    expect(velocity.x).toBe(10);
    expect(velocity.y).toBe(-5);
    expect(velocity.angular).toBe(Math.PI / 4);
  });

  it('should set velocity', () => {
    const velocity = new Velocity();
    velocity.setVelocity(25, -10);

    expect(velocity.x).toBe(25);
    expect(velocity.y).toBe(-10);
  });

  it('should set angular velocity', () => {
    const velocity = new Velocity();
    velocity.setAngularVelocity(Math.PI);

    expect(velocity.angular).toBe(Math.PI);
  });

  it('should stop movement', () => {
    const velocity = new Velocity(100, 50, Math.PI / 2);
    velocity.stop();

    expect(velocity.x).toBe(0);
    expect(velocity.y).toBe(0);
    expect(velocity.angular).toBe(0);
  });
});
