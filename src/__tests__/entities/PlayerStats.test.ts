import { describe, it, expect } from 'vitest';
import { PlayerStats } from '../../../entities/PlayerStats';

describe('PlayerStats', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new PlayerStats();
    expect(instance).toBeDefined();
  });

  it('should have addKill method', () => {
    const instance = new PlayerStats();
    expect(typeof instance.addKill).toBe('function');
  });

  it('should have addDeath method', () => {
    const instance = new PlayerStats();
    expect(typeof instance.addDeath).toBe('function');
  });

  it('should have addMissionCompleted method', () => {
    const instance = new PlayerStats();
    expect(typeof instance.addMissionCompleted).toBe('function');
  });

});


