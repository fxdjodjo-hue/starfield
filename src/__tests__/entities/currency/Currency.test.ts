import { describe, it, expect } from 'vitest';
import { Credits } from '../../../entities/currency/Credits';
import { Cosmos } from '../../../entities/currency/Cosmos';

describe('Credits', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Credits();
    expect(instance).toBeDefined();
  });

  it('should have addCredits method', () => {
    const instance = new Credits();
    expect(typeof instance.addCredits).toBe('function');
  });

  it('should have removeCredits method', () => {
    const instance = new Credits();
    expect(typeof instance.removeCredits).toBe('function');
  });

  it('should have setCredits method', () => {
    const instance = new Credits();
    expect(typeof instance.setCredits).toBe('function');
  });

});

describe('Cosmos', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Cosmos();
    expect(instance).toBeDefined();
  });

  it('should have addCredits method', () => {
    const instance = new Cosmos();
    expect(typeof instance.addCredits).toBe('function');
  });

  it('should have removeCredits method', () => {
    const instance = new Cosmos();
    expect(typeof instance.removeCredits).toBe('function');
  });

  it('should have setCredits method', () => {
    const instance = new Cosmos();
    expect(typeof instance.setCredits).toBe('function');
  });

});


