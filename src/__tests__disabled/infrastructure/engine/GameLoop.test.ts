import { describe, it, expect } from 'vitest';
import { GameLoop } from '../../../infrastructure/engine/GameLoop';

describe('GameLoop', () => {
  it('should have stop method', () => {
    const instance = new GameLoop(null as any);
    expect(typeof instance.stop).toBe('function');
  });

});


