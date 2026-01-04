import { describe, it, expect } from 'vitest';
import { NPC_DEFINITIONS, getNpcDefinition, getAllNpcTypes } from '../../config/NpcConfig';

describe('NpcConfig', () => {
  describe('NPC_DEFINITIONS', () => {
    it('should contain Scouter definition', () => {
      expect(NPC_DEFINITIONS['Scouter']).toBeDefined();
      expect(NPC_DEFINITIONS['Scouter'].type).toBe('Scouter');
      expect(NPC_DEFINITIONS['Scouter'].defaultBehavior).toBe('cruise');
    });

    it('should contain Frigate definition', () => {
      expect(NPC_DEFINITIONS['Frigate']).toBeDefined();
      expect(NPC_DEFINITIONS['Frigate'].type).toBe('Frigate');
      expect(NPC_DEFINITIONS['Frigate'].defaultBehavior).toBe('cruise');
    });

    it('should have Frigate with higher stats than Scouter', () => {
      const scouter = NPC_DEFINITIONS['Scouter'];
      const frigate = NPC_DEFINITIONS['Frigate'];

      expect(frigate.stats.health).toBeGreaterThan(scouter.stats.health);
      expect(frigate.stats.damage).toBeGreaterThan(scouter.stats.damage);
      expect(frigate.stats.shield).toBeGreaterThan(scouter.stats.shield);
    });

    it('should have NPCs with same range as player (300)', () => {
      const scouter = NPC_DEFINITIONS['Scouter'];
      const frigate = NPC_DEFINITIONS['Frigate'];

      expect(scouter.stats.range).toBe(300);
      expect(frigate.stats.range).toBe(300);
    });
  });

  describe('getNpcDefinition', () => {
    it('should return Scouter definition', () => {
      const scouter = getNpcDefinition('Scouter');
      expect(scouter).toBeDefined();
      expect(scouter?.type).toBe('Scouter');
    });

    it('should return Frigate definition', () => {
      const frigate = getNpcDefinition('Frigate');
      expect(frigate).toBeDefined();
      expect(frigate?.type).toBe('Frigate');
    });

    it('should return null for non-existent NPC', () => {
      const result = getNpcDefinition('NonExistent');
      expect(result).toBeNull();
    });
  });

  describe('getAllNpcTypes', () => {
    it('should return all NPC types including Frigate', () => {
      const types = getAllNpcTypes();
      expect(types).toContain('Scouter');
      expect(types).toContain('Frigate');
      expect(types.length).toBe(2);
    });
  });
});

