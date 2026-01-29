/**
 * InputValidator - Validazione input centralizzata
 * Sostituisce isNaN/isFinite/typeof checks ripetuti in tutto il progetto
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class InputValidator {
  /**
   * Valida un numero (non NaN, finito, nel range sicuro)
   */
  static validateNumber(value: any, fieldName: string = 'value'): ValidationResult {
    if (typeof value !== 'number') {
      return { isValid: false, error: `${fieldName} must be a number` };
    }

    if (isNaN(value)) {
      return { isValid: false, error: `${fieldName} cannot be NaN` };
    }

    if (!isFinite(value)) {
      return { isValid: false, error: `${fieldName} must be finite` };
    }

    return { isValid: true };
  }

  /**
   * Valida coordinate (x, y) con range limite
   */
  static validateCoordinates(x: any, y: any, maxRange: number = 10000): ValidationResult {
    const xValidation = this.validateNumber(x, 'x');
    if (!xValidation.isValid) return xValidation;

    const yValidation = this.validateNumber(y, 'y');
    if (!yValidation.isValid) return yValidation;

    if (Math.abs(x) > maxRange || Math.abs(y) > maxRange) {
      return { isValid: false, error: `Coordinates out of valid range (±${maxRange})` };
    }

    return { isValid: true };
  }

  /**
   * Valida posizione con rotazione
   */
  static validatePosition(x: any, y: any, rotation?: any): ValidationResult {
    const coordsValidation = this.validateCoordinates(x, y);
    if (!coordsValidation.isValid) return coordsValidation;

    if (rotation !== undefined) {
      const rotationValidation = this.validateNumber(rotation, 'rotation');
      if (!rotationValidation.isValid) return rotationValidation;
    }

    return { isValid: true };
  }

  /**
   * Valida velocità (x, y) con limiti di velocità
   */
  static validateVelocity(vx: any, vy: any, maxSpeed: number = 1000): ValidationResult {
    const vxValidation = this.validateNumber(vx, 'velocityX');
    if (!vxValidation.isValid) return vxValidation;

    const vyValidation = this.validateNumber(vy, 'velocityY');
    if (!vyValidation.isValid) return vyValidation;

    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > maxSpeed) {
      return { isValid: false, error: `Velocity exceeds maximum speed (${maxSpeed})` };
    }

    return { isValid: true };
  }

  /**
   * Valida damage/health/shield (positivi, finiti)
   */
  static validateStat(value: any, fieldName: string, maxValue: number = 1000000): ValidationResult {
    const numberValidation = this.validateNumber(value, fieldName);
    if (!numberValidation.isValid) return numberValidation;

    if (value < 0) {
      return { isValid: false, error: `${fieldName} cannot be negative` };
    }

    if (value > maxValue) {
      return { isValid: false, error: `${fieldName} exceeds maximum value (${maxValue})` };
    }

    return { isValid: true };
  }

  /**
   * Valida ID stringa (non vuota, formato corretto)
   */
  static validateId(id: any, fieldName: string = 'id'): ValidationResult {
    if (typeof id !== 'string') {
      return { isValid: false, error: `${fieldName} must be a string` };
    }

    if (id.trim().length === 0) {
      return { isValid: false, error: `${fieldName} cannot be empty` };
    }

    // Pattern base per ID generati dal sistema
    const idPattern = /^[a-zA-Z0-9_]+$/;
    if (!idPattern.test(id)) {
      return { isValid: false, error: `${fieldName} contains invalid characters` };
    }

    return { isValid: true };
  }

  /**
   * Valida timestamp (numero positivo, ragionevole)
   */
  static validateTimestamp(timestamp: any, fieldName: string = 'timestamp'): ValidationResult {
    const numberValidation = this.validateNumber(timestamp, fieldName);
    if (!numberValidation.isValid) return numberValidation;

    const now = Date.now();
    const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);

    if (timestamp < oneYearAgo || timestamp > oneYearFromNow) {
      return { isValid: false, error: `${fieldName} is outside reasonable timestamp range` };
    }

    return { isValid: true };
  }

  /**
   * Valida dimensione array
   */
  static validateArrayLength(array: any, fieldName: string, maxLength: number = 1000): ValidationResult {
    if (!Array.isArray(array)) {
      return { isValid: false, error: `${fieldName} must be an array` };
    }

    if (array.length > maxLength) {
      return { isValid: false, error: `${fieldName} exceeds maximum length (${maxLength})` };
    }

    return { isValid: true };
  }

  /**
   * Valida che un valore sia definito (non null/undefined)
   */
  static validateRequired(value: any, fieldName: string): ValidationResult {
    if (value === null || value === undefined) {
      return { isValid: false, error: `${fieldName} is required` };
    }

    return { isValid: true };
  }
}