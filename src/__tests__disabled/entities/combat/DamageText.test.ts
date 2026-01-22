import { describe, it, expect } from 'vitest';
import { DamageText } from '../../../entities/combat/DamageText';

describe('DamageText', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new DamageText("10");
    expect(instance).toBeDefined();
  });

  it('should have getAlpha method', () => {
    const instance = new DamageText("10");
    expect(typeof instance.getAlpha).toBe('function');
  });

  it('should have isExpired method', () => {
    const instance = new DamageText("10");
    expect(typeof instance.isExpired).toBe('function');
  });

});


