import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';

/**
 * Rendering parameters for health/shield bars
 */
export interface HealthBarRenderParams {
  backgroundColor: string;
  fillColor: string;
  fillColorEnd?: string; // Colore finale per gradiente
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
  private static readonly BAR_WIDTH = 70;
  private static readonly BAR_HEIGHT = 4;
  private static readonly BAR_OFFSET_Y = 95; // Spostato più in alto
  private static readonly BORDER_COLOR = '#ffffff';
  private static readonly BORDER_WIDTH = 0.5;
  private static readonly CORNER_RADIUS = 2; // Bordi leggermente arrotondati

  /**
   * Get rendering parameters for health bar
   */
  static getHealthBarParams(screenX: number, screenY: number, health: Health | null): HealthBarRenderParams | null {
    if (!health) return null;

    const barY = screenY - this.BAR_OFFSET_Y;
    const healthPercent = health.getPercentage();

    // Color logic: green → yellow → red (con gradienti moderni)
    let fillColorStart = '#00ff88'; // Verde brillante
    let fillColorEnd = '#00cc66'; // Verde scuro
    let bgColor = '#1a1a1a'; // Background scuro moderno
    
    if (healthPercent < 0.3) {
      fillColorStart = '#ff4444'; // Rosso brillante
      fillColorEnd = '#cc0000'; // Rosso scuro
      bgColor = '#2a0a0a'; // Background rosso scuro
    } else if (healthPercent < 0.6) {
      fillColorStart = '#ffaa00'; // Arancione/giallo brillante
      fillColorEnd = '#cc8800'; // Arancione scuro
      bgColor = '#2a1a0a'; // Background arancione scuro
    }

    return {
      backgroundColor: bgColor,
      fillColor: fillColorStart, // Colore iniziale per gradiente
      fillColorEnd: fillColorEnd, // Colore finale per gradiente
      borderColor: '#ffffff',
      x: screenX - this.BAR_WIDTH / 2,
      y: barY,
      width: this.BAR_WIDTH * healthPercent,
      height: this.BAR_HEIGHT,
      borderWidth: this.BORDER_WIDTH
    };
  }

  /**
   * Get rendering parameters for shield bar
   */
  static getShieldBarParams(screenX: number, screenY: number, shield: Shield | null): HealthBarRenderParams | null {
    if (!shield) return null;

    const barY = screenY - this.BAR_OFFSET_Y;

    return {
      backgroundColor: '#0a0a1a', // Background blu scuro moderno
      fillColor: '#4488ff', // Blu brillante
      fillColorEnd: '#2266cc', // Blu scuro
      borderColor: this.BORDER_COLOR,
      x: screenX - this.BAR_WIDTH / 2,
      y: barY,
      width: this.BAR_WIDTH * shield.getPercentage(),
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
