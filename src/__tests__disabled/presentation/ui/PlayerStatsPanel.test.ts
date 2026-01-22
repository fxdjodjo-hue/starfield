import { describe, it, expect } from 'vitest';
import { PlayerStatsPanel } from '../../../presentation/ui/PlayerStatsPanel';
import { PANEL_CONFIGS } from '../../../presentation/ui/PanelConfig';

describe('PlayerStatsPanel', () => {
  it('should create instance', () => {
    const instance = new PlayerStatsPanel(PANEL_CONFIGS.stats);
    expect(instance).toBeDefined();
  });

  it('should have createPanelContent method', () => {
    const instance = new PlayerStatsPanel(PANEL_CONFIGS.stats);
    expect(typeof instance.createPanelContent).toBe('function');
  });

  it('should have createModernStatCard method', () => {
    const instance = new PlayerStatsPanel();
    expect(typeof instance.createModernStatCard).toBe('function');
  });

  it('should have update method', () => {
    const instance = new PlayerStatsPanel();
    expect(typeof instance.update).toBe('function');
  });

});


