import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceComponent } from '../../../entities/combat/ResourceComponent';

// Concrete implementation for testing
class TestResourceComponent extends ResourceComponent {
  constructor(current: number, max: number) {
    super(current, max);
  }
}

describe('ResourceComponent', () => {
  let resource: TestResourceComponent;

  beforeEach(() => {
    resource = new TestResourceComponent(50, 100);
  });

  it('should initialize with correct values', () => {
    expect(resource.currentValue).toBe(50);
    expect(resource.maxValue).toBe(100);
    expect(resource.getPercentage()).toBe(0.5);
  });

  it('should clamp current value to max during construction', () => {
    const clampedResource = new TestResourceComponent(150, 100);
    expect(clampedResource.currentValue).toBe(100);
  });

  describe('Damage and Healing', () => {
    it('should take damage', () => {
      resource.takeDamage(20);
      expect(resource.currentValue).toBe(30);
    });

    it('should not go below zero when taking damage', () => {
      resource.takeDamage(100);
      expect(resource.currentValue).toBe(0);
    });

    it('should heal', () => {
      resource.takeDamage(30); // Now at 20
      resource.heal(15);
      expect(resource.currentValue).toBe(35);
    });

    it('should not exceed max when healing', () => {
      resource.heal(100);
      expect(resource.currentValue).toBe(100);
    });

    it('should restore to full', () => {
      resource.takeDamage(40);
      resource.restoreFull();
      expect(resource.currentValue).toBe(100);
    });
  });

  describe('State Checks', () => {
    it('should check if full', () => {
      expect(resource.isFull()).toBe(false);
      resource.restoreFull();
      expect(resource.isFull()).toBe(true);
    });

    it('should check if empty', () => {
      expect(resource.isEmpty()).toBe(false);
      resource.takeDamage(50);
      expect(resource.isEmpty()).toBe(true);
    });

    it('should get percentage', () => {
      expect(resource.getPercentage()).toBe(0.5);

      resource.takeDamage(25);
      expect(resource.getPercentage()).toBe(0.25);

      resource.restoreFull();
      expect(resource.getPercentage()).toBe(1);
    });
  });

  describe('Setters and Getters', () => {
    it('should set resource values', () => {
      resource.setResource(75, 150);
      expect(resource.currentValue).toBe(75);
      expect(resource.maxValue).toBe(150);
    });

    it('should set resource with only current value', () => {
      resource.setResource(25);
      expect(resource.currentValue).toBe(25);
      expect(resource.maxValue).toBe(100);
    });

    it('should clamp current value in setter', () => {
      resource.currentValue = 150;
      expect(resource.currentValue).toBe(100);

      resource.currentValue = -10;
      expect(resource.currentValue).toBe(0);
    });

    it('should clamp max value and adjust current', () => {
      resource.maxValue = 30;
      expect(resource.maxValue).toBe(30);
      expect(resource.currentValue).toBe(30); // Current clamped to new max

      resource.maxValue = 0;
      expect(resource.maxValue).toBe(0);
    });
  });

  describe('Damage Tracking', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should track last damage time', () => {
      const beforeTime = Date.now();
      resource.takeDamage(10);

      expect(resource.getLastDamageTime()).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should check if damaged recently', () => {
      resource.takeDamage(10);
      expect(resource.wasDamagedRecently(Date.now(), 1000)).toBe(true);

      // Advance time by 4 seconds
      vi.advanceTimersByTime(4000);
      expect(resource.wasDamagedRecently(Date.now(), 1000)).toBe(false);
    });

    it('should not update damage time if no actual damage', () => {
      const originalTime = resource.getLastDamageTime();
      resource.takeDamage(0); // No damage

      expect(resource.getLastDamageTime()).toBe(originalTime);
    });
  });
});
