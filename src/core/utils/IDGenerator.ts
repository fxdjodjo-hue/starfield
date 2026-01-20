/**
 * IDGenerator - Generazione ID univoci centralizzata
 * Sostituisce il pattern Math.random().toString(36).substr(2,9) ripetuto in tutto il progetto
 */

export class IDGenerator {
  /**
   * Genera un ID univoco generico
   */
  static generateUniqueId(prefix: string = ''): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * Genera ID per proiettili
   */
  static generateProjectileId(ownerId: string): string {
    return this.generateUniqueId(`proj_${ownerId}`);
  }


  /**
   * Genera ID per esplosioni
   */
  static generateExplosionId(entityId: string): string {
    return this.generateUniqueId(`expl_${entityId}`);
  }

  /**
   * Genera ID client temporaneo
   */
  static generateClientId(): string {
    return `client_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Genera ID per messaggi chat
   */
  static generateMessageId(): string {
    return this.generateUniqueId('msg');
  }

  /**
   * Genera ID per sessioni di riparazione
   */
  static generateRepairId(playerId: string): string {
    return this.generateUniqueId(`repair_${playerId}`);
  }

  /**
   * Genera ID per combattimenti
   */
  static generateCombatId(playerId: string, npcId: string): string {
    return this.generateUniqueId(`combat_${playerId}_${npcId}`);
  }
}