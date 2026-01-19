import { Entity } from '../../infrastructure/ecs/Entity';
import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';
import { RenderLayerUtils } from './rendering/RenderLayers';

/**
 * ProjectileLogger - Sistema centralizzato per il tracciamento end-to-end dei proiettili
 *
 * Fornisce tracciamento completo del ciclo di vita di ogni proiettile:
 * - Creazione e configurazione iniziale
 * - Cambiamenti di stato logico (attivo/inattivo)
 * - Cambiamenti di stato visivo (visibile/nascosto, fade, layer)
 * - Movimenti e collisioni
 * - Distruzione e cleanup
 *
 * Utile per:
 * - Debug di problemi di sincronizzazione
 * - Analisi delle performance
 * - Tracciamento di comportamenti anomali
 * - Monitoraggio del multiplayer
 */

export interface ProjectileLogEntry {
  timestamp: number;
  projectileId: string;
  entityId: number;
  action: string;
  system: string; // Sistema che ha generato il log
  details?: any;
  position?: { x: number; y: number };
  visualState?: {
    active: boolean;
    visible: boolean;
    alpha: number;
    layer: number;
    fadeState: string;
  };
  gameState?: {
    damage: number;
    speed: number;
    lifetime: number;
    ownerId: number;
    targetId: number;
    projectileType: string;
  };
}

export class ProjectileLogger {
  private static logHistory: Map<string, ProjectileLogEntry[]> = new Map();
  private static maxHistoryPerProjectile = 50; // Limite per evitare memory leaks
  private static enabled = true; // Flag per abilitare/disabilitare il logging

  /**
   * Abilita/disabilita il logging centralizzato
   */
  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    LoggerWrapper.projectile(`Projectile logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Registra la creazione di un nuovo proiettile
   */
  static logCreation(
    projectileId: string,
    entity: Entity,
    system: string,
    details: {
      position: { x: number; y: number };
      gameState: any;
      visualState?: any;
    }
  ): void {
    if (!this.enabled) return;

    const entry: ProjectileLogEntry = {
      timestamp: Date.now(),
      projectileId,
      entityId: entity.id,
      action: 'created',
      system,
      position: details.position,
      gameState: details.gameState,
      visualState: details.visualState
    };

    this.addToHistory(projectileId, entry);
    LoggerWrapper.projectile(`Projectile ${projectileId} created by ${system}`, {
      projectileId,
      entityId: entity.id,
      position: details.position,
      gameState: details.gameState,
      visualState: details.visualState
    });
  }

  /**
   * Registra un cambiamento di stato visivo
   */
  static logVisualStateChange(
    projectileId: string,
    entity: Entity,
    system: string,
    action: string,
    visualState: any,
    position?: { x: number; y: number }
  ): void {
    if (!this.enabled) return;

    const entry: ProjectileLogEntry = {
      timestamp: Date.now(),
      projectileId,
      entityId: entity.id,
      action: `visual_${action}`,
      system,
      position,
      visualState
    };

    this.addToHistory(projectileId, entry);
    LoggerWrapper.render(`Projectile ${projectileId} visual state: ${action}`, {
      projectileId,
      entityId: entity.id,
      visualState,
      position,
      system
    });
  }

  /**
   * Registra un cambiamento di stato di gioco
   */
  static logGameStateChange(
    projectileId: string,
    entity: Entity,
    system: string,
    action: string,
    gameState: any,
    position?: { x: number; y: number }
  ): void {
    if (!this.enabled) return;

    const entry: ProjectileLogEntry = {
      timestamp: Date.now(),
      projectileId,
      entityId: entity.id,
      action: `game_${action}`,
      system,
      position,
      gameState
    };

    this.addToHistory(projectileId, entry);
    LoggerWrapper.combat(`Projectile ${projectileId} game state: ${action}`, {
      projectileId,
      entityId: entity.id,
      gameState,
      position,
      system
    });
  }

  /**
   * Registra movimento del proiettile
   */
  static logMovement(
    projectileId: string,
    entity: Entity,
    system: string,
    fromPosition: { x: number; y: number },
    toPosition: { x: number; y: number },
    velocity?: { x: number; y: number }
  ): void {
    if (!this.enabled) return;

    const entry: ProjectileLogEntry = {
      timestamp: Date.now(),
      projectileId,
      entityId: entity.id,
      action: 'moved',
      system,
      position: toPosition,
      details: {
        fromPosition,
        toPosition,
        velocity,
        distance: Math.sqrt(
          Math.pow(toPosition.x - fromPosition.x, 2) +
          Math.pow(toPosition.y - fromPosition.y, 2)
        )
      }
    };

    this.addToHistory(projectileId, entry);
  }

  /**
   * Registra collisione del proiettile
   */
  static logCollision(
    projectileId: string,
    entity: Entity,
    system: string,
    targetEntityId: number,
    position: { x: number; y: number },
    damageDealt: number,
    destroyed: boolean
  ): void {
    if (!this.enabled) return;

    const entry: ProjectileLogEntry = {
      timestamp: Date.now(),
      projectileId,
      entityId: entity.id,
      action: destroyed ? 'collision_destroyed' : 'collision_hit',
      system,
      position,
      details: {
        targetEntityId,
        damageDealt,
        destroyed
      }
    };

    this.addToHistory(projectileId, entry);
    LoggerWrapper.combat(`Projectile ${projectileId} collision`, {
      projectileId,
      entityId: entity.id,
      targetEntityId,
      position,
      damageDealt,
      destroyed,
      system
    });
  }

  /**
   * Registra la distruzione del proiettile
   */
  static logDestruction(
    projectileId: string,
    entity: Entity,
    system: string,
    reason: string,
    position?: { x: number; y: number }
  ): void {
    if (!this.enabled) return;

    const entry: ProjectileLogEntry = {
      timestamp: Date.now(),
      projectileId,
      entityId: entity.id,
      action: 'destroyed',
      system,
      position,
      details: { reason }
    };

    this.addToHistory(projectileId, entry);
    LoggerWrapper.projectile(`Projectile ${projectileId} destroyed: ${reason}`, {
      projectileId,
      entityId: entity.id,
      reason,
      position,
      system,
      lifetime: this.getProjectileLifetime(projectileId)
    });
  }

  /**
   * Registra un errore relativo a un proiettile
   */
  static logError(
    projectileId: string,
    entity: Entity,
    system: string,
    error: Error,
    context?: any
  ): void {
    const entry: ProjectileLogEntry = {
      timestamp: Date.now(),
      projectileId,
      entityId: entity.id,
      action: 'error',
      system,
      details: {
        error: error.message,
        stack: error.stack,
        ...context
      }
    };

    this.addToHistory(projectileId, entry);
    LoggerWrapper.error(LogCategory.PROJECTILE, `Projectile ${projectileId} error in ${system}`, error, {
      projectileId,
      entityId: entity.id,
      system,
      ...context
    });
  }

  /**
   * Ottiene la cronologia completa di un proiettile
   */
  static getProjectileHistory(projectileId: string): ProjectileLogEntry[] {
    return this.logHistory.get(projectileId) || [];
  }

  /**
   * Ottiene statistiche sui proiettili attivi
   */
  static getStats(): {
    totalProjectiles: number;
    activeProjectiles: number;
    totalLogEntries: number;
    averageLifetime: number;
    errors: number;
  } {
    const projectiles = Array.from(this.logHistory.keys());
    let totalLogEntries = 0;
    let totalLifetime = 0;
    let lifetimeCount = 0;
    let errors = 0;

    for (const projectileId of projectiles) {
      const history = this.logHistory.get(projectileId) || [];
      totalLogEntries += history.length;

      // Conta errori
      errors += history.filter(entry => entry.action === 'error').length;

      // Calcola lifetime se disponibile
      const lifetime = this.getProjectileLifetime(projectileId);
      if (lifetime > 0) {
        totalLifetime += lifetime;
        lifetimeCount++;
      }
    }

    return {
      totalProjectiles: projectiles.length,
      activeProjectiles: projectiles.filter(id => !this.isProjectileDestroyed(id)).length,
      totalLogEntries,
      averageLifetime: lifetimeCount > 0 ? totalLifetime / lifetimeCount : 0,
      errors
    };
  }

  /**
   * Verifica se un proiettile è stato distrutto
   */
  private static isProjectileDestroyed(projectileId: string): boolean {
    const history = this.logHistory.get(projectileId) || [];
    return history.some(entry => entry.action === 'destroyed');
  }

  /**
   * Calcola il tempo di vita di un proiettile
   */
  private static getProjectileLifetime(projectileId: string): number {
    const history = this.logHistory.get(projectileId) || [];
    const created = history.find(entry => entry.action === 'created');
    const destroyed = history.find(entry => entry.action === 'destroyed');

    if (created && destroyed) {
      return destroyed.timestamp - created.timestamp;
    }
    return 0;
  }

  /**
   * Aggiunge una entry alla cronologia del proiettile
   */
  private static addToHistory(projectileId: string, entry: ProjectileLogEntry): void {
    if (!this.logHistory.has(projectileId)) {
      this.logHistory.set(projectileId, []);
    }

    const history = this.logHistory.get(projectileId)!;
    history.push(entry);

    // Limita la dimensione della cronologia per evitare memory leaks
    if (history.length > this.maxHistoryPerProjectile) {
      history.shift(); // Rimuove la entry più vecchia
    }
  }

  /**
   * Pulisce la cronologia di un proiettile distrutto (chiamare dopo cleanup)
   */
  static cleanupProjectileHistory(projectileId: string): void {
    this.logHistory.delete(projectileId);
  }

  /**
   * Pulisce tutta la cronologia (per testing o reset)
   */
  static clearAllHistory(): void {
    this.logHistory.clear();
    LoggerWrapper.projectile('Projectile history cleared');
  }

  /**
   * Esporta la cronologia per debugging
   */
  static exportHistory(projectileId?: string): any {
    if (projectileId) {
      return {
        projectileId,
        history: this.getProjectileHistory(projectileId),
        lifetime: this.getProjectileLifetime(projectileId)
      };
    }

    const result: any = {};
    for (const [id, history] of this.logHistory) {
      result[id] = {
        history,
        lifetime: this.getProjectileLifetime(id),
        isActive: !this.isProjectileDestroyed(id)
      };
    }
    return result;
  }
}