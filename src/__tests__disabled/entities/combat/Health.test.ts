import { describe, it, expect } from 'vitest';
import { Health } from '../../../entities/combat/Health';

describe('Health', () => {
  let health: Health;

  beforeEach(() => {
    health = new Health(75, 100);
  });

  it('should initialize with correct values', () => {
    expect(health.current).toBe(75);
    expect(health.max).toBe(100);
    expect(health.getHealthPercentage()).toBe(0.75);
  });

  it('should check if dead', () => {
    expect(health.isDead()).toBe(false);

    health.takeDamage(75);
    expect(health.isDead()).toBe(true);
  });

  it('should get health percentage', () => {
    expect(health.getHealthPercentage()).toBe(0.75);

    health.takeDamage(25);
    expect(health.getHealthPercentage()).toBe(0.5);
  });

  it('should set health', () => {
    health.setHealth(50);
    expect(health.current).toBe(50);
    expect(health.max).toBe(100);

    health.setHealth(25, 200);
    expect(health.current).toBe(25);
    expect(health.max).toBe(200);
  });

  it('should access current and max as properties', () => {
    health.current = 60;
    health.max = 120;

    expect(health.current).toBe(60);
    expect(health.max).toBe(120);
  });

  it('should delegate properties to ResourceComponent getters/setters', () => {
    expect(health.current).toBe(75);
    expect(health.max).toBe(100);

    // Test direct access to currentValue/maxValue (which should have clamping)
    health.currentValue = 150;
    expect(health.currentValue).toBe(100); // Should be clamped

    health.currentValue = -10;
    expect(health.currentValue).toBe(0); // Should be clamped

    health.currentValue = 50;
    expect(health.currentValue).toBe(50);

    // Test maxValue setter
    health.maxValue = 30;
    expect(health.maxValue).toBe(30);
    expect(health.currentValue).toBe(30); // current clamped to new max
  });

  it('should inherit ResourceComponent methods', () => {
    expect(typeof health.takeDamage).toBe('function');
    expect(typeof health.heal).toBe('function');
    expect(typeof health.isFull).toBe('function');
    expect(typeof health.isEmpty).toBe('function');
  });
});
