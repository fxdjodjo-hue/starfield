import { describe, it, expect } from 'vitest';
import { Game } from '../../../infrastructure/engine/Game';

describe('Game', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Game(null as any);
    expect(instance).toBeDefined();
  });

  it('should have start method', () => {
    const instance = new Game(null as any);
    expect(typeof instance.start).toBe('function');
  });

  it('should have stop method', () => {
    const instance = new Game(null as any);
    expect(typeof instance.stop).toBe('function');
  });

  it('should have update method', () => {
    const instance = new Game(null as any);
    expect(typeof instance.update).toBe('function');
  });

});


