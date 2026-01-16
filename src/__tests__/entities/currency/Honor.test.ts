import { describe, it, expect } from 'vitest';
import { Honor } from '../../../entities/currency/Honor';

describe('Honor', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Honor(0);
    expect(instance).toBeDefined();
  });


  it('should have updateOutlawStatus method', () => {
    const instance = new Honor(0);
    expect(typeof instance.updateOutlawStatus).toBe('function');
  });

  it('should have addHonor method', () => {
    const instance = new Honor(0);
    expect(typeof instance.addHonor).toBe('function');
  });

});


