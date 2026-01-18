/**
 * MathUtils - Utilità matematiche centralizzate
 * Centralizza tutti i calcoli matematici duplicati nel progetto
 */

export interface DirectionResult {
  direction: { x: number; y: number };
  distance: number;
}

export interface Position {
  x: number;
  y: number;
}

export class MathUtils {
  /**
   * Calcola la distanza tra due punti (formula pitagorica)
   * Sostituisce Math.sqrt(dx*dx + dy*dy) ripetuto in tutto il progetto
   */
  static calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calcola direzione normalizzata e distanza tra due punti
   * Sostituisce calculateDirection ripetuto nei sistemi di proiettili
   */
  static calculateDirection(fromX: number, fromY: number, toX: number, toY: number): DirectionResult {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Evita divisione per zero
    const direction = distance > 0 ?
      { x: dx / distance, y: dy / distance } :
      { x: 0, y: 0 };

    return { direction, distance };
  }

  /**
   * Calcola l'angolo in radianti tra due punti
   */
  static calculateAngle(fromX: number, fromY: number, toX: number, toY: number): number {
    return Math.atan2(toY - fromY, toX - fromX);
  }

  /**
   * Converte gradi in radianti
   */
  static degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Converte radianti in gradi
   */
  static radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Limita un valore entro un range
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Calcola la distanza minima tra due angoli (considerando il wrap-around)
   */
  static angleDifference(angle1: number, angle2: number): number {
    let diff = angle2 - angle1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }

  /**
   * Interpolazione lineare tra due valori
   */
  static lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * MathUtils.clamp(factor, 0, 1);
  }

  /**
   * Verifica se un punto è dentro un rettangolo
   */
  static isPointInRectangle(pointX: number, pointY: number, rectX: number, rectY: number, rectWidth: number, rectHeight: number): boolean {
    return pointX >= rectX &&
           pointX <= rectX + rectWidth &&
           pointY >= rectY &&
           pointY <= rectY + rectHeight;
  }

  /**
   * Verifica se due rettangoli si sovrappongono (collision detection)
   */
  static rectanglesOverlap(
    rect1X: number, rect1Y: number, rect1Width: number, rect1Height: number,
    rect2X: number, rect2Y: number, rect2Width: number, rect2Height: number
  ): boolean {
    return rect1X < rect2X + rect2Width &&
           rect1X + rect1Width > rect2X &&
           rect1Y < rect2Y + rect2Height &&
           rect1Y + rect1Height > rect2Y;
  }
}