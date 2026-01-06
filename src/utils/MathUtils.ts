/**
 * Utility matematiche per eliminare duplicazioni
 */

export interface Vector2D {
  x: number;
  y: number;
}

export interface DirectionResult {
  direction: Vector2D;
  distance: number;
}

/**
 * Calcola direzione normalizzata tra due punti
 */
export function calculateDirection(fromX: number, fromY: number, toX: number, toY: number): DirectionResult {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    return { direction: { x: 0, y: 0 }, distance: 0 };
  }

  return {
    direction: { x: dx / distance, y: dy / distance },
    distance
  };
}

/**
 * Calcola distanza tra due punti
 */
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Converte millisecondi in secondi
 */
export function msToSeconds(ms: number): number {
  return ms / 1000;
}

/**
 * Converte secondi in millisecondi
 */
export function secondsToMs(seconds: number): number {
  return seconds * 1000;
}

/**
 * Limita un valore tra min e max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Interpolazione lineare
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
