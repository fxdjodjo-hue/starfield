import { describe, it, expect } from 'vitest';
import { NPC_DEFINITIONS, getNpcDefinition, getAllNpcTypes } from '../../config/NpcConfig';

describe('NpcConfig', () => {
  describe('NPC_DEFINITIONS', () => {
    it('should contain Scouter definition', () => {
      expect(NPC_DEFINITIONS['Scouter']).toBeDefined();
      expect(NPC_DEFINITIONS['Scouter'].type).toBe('Scouter');
      expect(NPC_DEFINITIONS['Scouter'].defaultBehavior).toBe('cruise');
    });

    it('should contain Kronos definition', () => {
      expect(NPC_DEFINITIONS['Kronos']).toBeDefined();
      expect(NPC_DEFINITIONS['Kronos'].type).toBe('Kronos');
      expect(NPC_DEFINITIONS['Kronos'].defaultBehavior).toBe('cruise');
    });

    it('should contain Guard definition', () => {
      expect(NPC_DEFINITIONS['Guard']).toBeDefined();
      expect(NPC_DEFINITIONS['Guard'].type).toBe('Guard');
      expect(NPC_DEFINITIONS['Guard'].defaultBehavior).toBe('cruise');
    });

    it('should contain Pyramid definition', () => {
      expect(NPC_DEFINITIONS['Pyramid']).toBeDefined();
      expect(NPC_DEFINITIONS['Pyramid'].type).toBe('Pyramid');
      expect(NPC_DEFINITIONS['Pyramid'].defaultBehavior).toBe('cruise');
    });

    it('should have Kronos with higher stats than Scouter', () => {
      const scouter = NPC_DEFINITIONS['Scouter'];
      const kronos = NPC_DEFINITIONS['Kronos'];

      expect(kronos.stats.health).toBeGreaterThan(scouter.stats.health);
      expect(kronos.stats.damage).toBeGreaterThan(scouter.stats.damage);
      expect(kronos.stats.shield).toBeGreaterThan(scouter.stats.shield);
    });

    it('should have NPCs with appropriate ranges', () => {
      const scouter = NPC_DEFINITIONS['Scouter'];
      const kronos = NPC_DEFINITIONS['Kronos'];
      const guard = NPC_DEFINITIONS['Guard'];
      const pyramid = NPC_DEFINITIONS['Pyramid'];

      expect(scouter.stats.range).toBe(600);
      expect(kronos.stats.range).toBe(400);
      expect(guard.stats.range).toBe(500);
      expect(pyramid.stats.range).toBe(450);
    });
  });

  describe('getNpcDefinition', () => {
    it('should return Scouter definition', () => {
      const scouter = getNpcDefinition('Scouter');
      expect(scouter).toBeDefined();
      expect(scouter?.type).toBe('Scouter');
    });

    it('should return Kronos definition', () => {
      const kronos = getNpcDefinition('Kronos');
      expect(kronos).toBeDefined();
      expect(kronos?.type).toBe('Kronos');
    });

    it('should return Guard definition', () => {
      const guard = getNpcDefinition('Guard');
      expect(guard).toBeDefined();
      expect(guard?.type).toBe('Guard');
    });

    it('should return Pyramid definition', () => {
      const pyramid = getNpcDefinition('Pyramid');
      expect(pyramid).toBeDefined();
      expect(pyramid?.type).toBe('Pyramid');
    });

    it('should return null for non-existent NPC', () => {
      const result = getNpcDefinition('NonExistent');
      expect(result).toBeNull();
    });
  });

  describe('getAllNpcTypes', () => {
    it('should return all NPC types including Kronos, Guard and Pyramid', () => {
      const types = getAllNpcTypes();
      expect(types).toContain('Scouter');
      expect(types).toContain('Kronos');
      expect(types).toContain('Guard');
      expect(types).toContain('Pyramid');
      expect(types.length).toBe(4);
    });
  });
});

