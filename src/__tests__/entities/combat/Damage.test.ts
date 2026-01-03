import { describe, it, expect, beforeEach } from 'vitest';
import { Damage } from '../../../entities/combat/Damage';

describe('Damage', () => {
  let damage: Damage;

  beforeEach(() => {
    damage = new Damage(25, 100, 1000); // damage, range, cooldown
  });

  it('should create instance with correct parameters', () => {
    expect(damage).toBeDefined();
    expect(damage.damage).toBe(25);
    expect(damage.attackRange).toBe(100);
    expect(damage.attackCooldown).toBe(1000);
  });

  it('should check if can attack', () => {
    expect(damage.canAttack(1000)).toBe(true); // First attack after cooldown time

    damage.performAttack(1000);
    expect(damage.canAttack(1500)).toBe(false); // Within cooldown (1500 - 1000 = 500 < 1000)
    expect(damage.canAttack(2500)).toBe(true); // After cooldown (2500 - 1000 = 1500 >= 1000)
  });

  it('should perform attack and update timestamp', () => {
    const attackTime = 1000;
    damage.performAttack(attackTime);

    expect(damage.getCooldownRemaining(1500)).toBe(500); // 1000ms cooldown - 500ms passed
    expect(damage.getCooldownRemaining(2500)).toBe(0); // Cooldown expired
  });

  it('should check if target is in range', () => {
    expect(damage.isInRange(0, 0, 50, 0)).toBe(true); // Within 100 units
    expect(damage.isInRange(0, 0, 150, 0)).toBe(false); // Outside 100 units
  });

  it('should set damage stats', () => {
    damage.setDamageStats(50, 200, 500);

    expect(damage.damage).toBe(50);
    expect(damage.attackRange).toBe(200);
    expect(damage.attackCooldown).toBe(500);
  });
});

