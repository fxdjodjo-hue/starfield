import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';

/**
 * Rendering parameters for health/shield bars
 */
export interface HealthBarRenderParams {
  backgroundColor: string;
  fillColor: string;
  borderColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderWidth: number;
}

/**
 * Helper for HUD rendering logic (health/shield bars)
 */
export class HudRenderer {
  private static readonly BAR_WIDTH = 40;
  private static readonly BAR_HEIGHT = 6;
  private static readonly BAR_OFFSET_Y = 60;
  private static readonly BORDER_COLOR = '#ffffff';
  private static readonly BORDER_WIDTH = 1;

  /**
   * Get rendering parameters for health bar
   */
  static getHealthBarParams(screenX: number, screenY: number, health: Health | null): HealthBarRenderParams | null {
    if (!health) return null;

    const barY = screenY - this.BAR_OFFSET_Y;
    const healthPercent = health.getPercentage();

    // Color logic: green → yellow → red
    let healthColor = '#00ff00'; // Green
    if (healthPercent < 0.3) {
      healthColor = '#ff0000'; // Red
    } else if (healthPercent < 0.6) {
      healthColor = '#ffff00'; // Yellow
    }

    return {
      backgroundColor: '#330000', // Dark red background
      fillColor: healthColor,
      borderColor: this.BORDER_COLOR,
      x: screenX - this.BAR_WIDTH / 2,
      y: barY,
      width: this.BAR_WIDTH * healthPercent, // ← CORRETTO: width proporzionale alla %
      height: this.BAR_HEIGHT,
      borderWidth: this.BORDER_WIDTH
    };
  }

  /**
   * Get rendering parameters for shield bar
   */
  static getShieldBarParams(screenX: number, screenY: number, shield: Shield | null): HealthBarRenderParams | null {
    if (!shield) {
      console.log(`❌ [SHIELD_BAR] No shield component`);
      return null;
    }

    const barY = screenY - this.BAR_OFFSET_Y;
    const percentage = shield.getPercentage();
    const width = this.BAR_WIDTH * percentage;

    console.log(`📊 [SHIELD_BAR] Rendering shield bar - current: ${shield.current}, max: ${shield.max}, percentage: ${percentage}, width: ${width}`);

    return {
      backgroundColor: '#001133', // Dark blue background
      fillColor: '#4444ff', // Blue fill
      borderColor: this.BORDER_COLOR,
      x: screenX - this.BAR_WIDTH / 2,
      y: barY,
      width: width,
      height: this.BAR_HEIGHT,
      borderWidth: this.BORDER_WIDTH
    };
  }

  /**
   * Get the bar width
   */
  static getBarWidth(): number {
    return this.BAR_WIDTH;
  }

  /**
   * Get the Y offset for positioning bars (shield above health)
   */
  static getBarSpacing(): number {
    return this.BAR_HEIGHT + 2;
  }
}
