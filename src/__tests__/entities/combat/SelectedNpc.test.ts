import { describe, it, expect } from 'vitest';
import { SelectedNpc } from '../../../entities/combat/SelectedNpc';

describe('SelectedNpc', () => {
  it('should create selected npc component', () => {
    const selectedNpc = new SelectedNpc();
    expect(selectedNpc).toBeInstanceOf(SelectedNpc);
  });
});