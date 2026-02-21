import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Projectile } from '../../entities/combat/Projectile';
import { ProjectileVisualState, VisualFadeState } from '../../entities/combat/ProjectileVisualState';
import { LoggerWrapper, LogCategory } from '../../core/data/LoggerWrapper';
import { ProjectileLogger } from '../../core/utils/ProjectileLogger';

/**
 * ProjectileVisualManager - Sistema centralizzato per la gestione degli stati visivi dei proiettili
 *
 * Responsabilità:
 * - Gestione delle animazioni di fade (fade-in/fade-out)
 * - Controllo centralizzato di visibilità e attività
 * - Applicazione coerente dei layer di rendering
 * - Interfaccia unificata per il controllo visivo dei proiettili
 * - Logging centralizzato degli stati visivi
 */
export class ProjectileVisualManager extends BaseSystem {
  private projectileEntities: readonly Entity[] = [];
  private lastUpdateTime: number = 0;

  constructor(ecs: ECS) {
    super(ecs);
    this.lastUpdateTime = Date.now();
  }

  /**
   * Aggiornamento periodico - gestisce le animazioni di fade e stati visivi
   */
  update(deltaTime: number): void {
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - this.lastUpdateTime;

    // Aggiorna cache delle entità proiettili
    this.updateProjectileCache();

    // Processa ogni proiettile per animazioni e stati visivi
    for (const entity of this.projectileEntities) {
      this.processVisualState(entity, timeSinceLastUpdate);
    }

    this.lastUpdateTime = currentTime;
  }

  /**
   * Aggiorna la cache delle entità proiettili
   */
  private updateProjectileCache(): void {
    this.projectileEntities = this.ecs.getEntitiesWithComponentsReadOnly(Projectile, ProjectileVisualState);
  }

  /**
   * Processa lo stato visivo di un singolo proiettile
   */
  private processVisualState(entity: Entity, deltaTimeMs: number): void {
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    if (!visualState) return;

    // Salta se non ci sono animazioni attive
    if (visualState.fadeState === VisualFadeState.NONE) {
      return;
    }

    // Calcola il delta time in secondi per le animazioni
    const deltaTimeSeconds = deltaTimeMs / 1000;
    const alphaChange = visualState.fadeSpeed * deltaTimeSeconds;

    // Gestisci le diverse animazioni di fade
    switch (visualState.fadeState) {
      case VisualFadeState.FADING_IN:
        visualState.alpha = Math.min(1.0, visualState.alpha + alphaChange);
        if (visualState.alpha >= 1.0) {
          visualState.fadeState = VisualFadeState.NONE;
          this.logVisualStateChange(entity, 'fade_in_completed', { finalAlpha: visualState.alpha });
        }
        break;

      case VisualFadeState.FADING_OUT:
        visualState.alpha = Math.max(0.0, visualState.alpha - alphaChange);
        if (visualState.alpha <= 0.0) {
          visualState.fadeState = VisualFadeState.NONE;
          visualState.visible = false; // Nasconde automaticamente quando fade out completato
          this.logVisualStateChange(entity, 'fade_out_completed', { finalAlpha: visualState.alpha });
        }
        break;
    }
  }

  /**
   * Interfaccia pubblica: avvia fade-in per un proiettile
   */
  startFadeIn(entity: Entity, speed: number = 1.0): boolean {
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    if (!visualState) {
      this.logError(entity, 'startFadeIn', 'ProjectileVisualState component not found');
      return false;
    }

    visualState.startFadeIn(speed);
    this.logVisualStateChange(entity, 'fade_in_started', { speed });
    return true;
  }

  /**
   * Interfaccia pubblica: avvia fade-out per un proiettile
   */
  startFadeOut(entity: Entity, speed: number = 1.0): boolean {
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    if (!visualState) {
      this.logError(entity, 'startFadeOut', 'ProjectileVisualState component not found');
      return false;
    }

    visualState.startFadeOut(speed);
    this.logVisualStateChange(entity, 'fade_out_started', { speed });
    return true;
  }

  /**
   * Interfaccia pubblica: imposta direttamente l'opacità
   */
  setAlpha(entity: Entity, alpha: number): boolean {
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    if (!visualState) {
      this.logError(entity, 'setAlpha', 'ProjectileVisualState component not found');
      return false;
    }

    const oldAlpha = visualState.alpha;
    visualState.setAlpha(alpha);
    this.logVisualStateChange(entity, 'alpha_set', { oldAlpha, newAlpha: alpha });
    return true;
  }

  /**
   * Interfaccia pubblica: mostra un proiettile
   */
  showProjectile(entity: Entity): boolean {
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    if (!visualState) {
      this.logError(entity, 'showProjectile', 'ProjectileVisualState component not found');
      return false;
    }

    if (!visualState.visible) {
      visualState.show();
      this.logVisualStateChange(entity, 'shown');
    }
    return true;
  }

  /**
   * Interfaccia pubblica: nasconde un proiettile
   */
  hideProjectile(entity: Entity): boolean {
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    if (!visualState) {
      this.logError(entity, 'hideProjectile', 'ProjectileVisualState component not found');
      return false;
    }

    if (visualState.visible) {
      visualState.hide();
      this.logVisualStateChange(entity, 'hidden');
    }
    return true;
  }

  /**
   * Interfaccia pubblica: attiva un proiettile
   */
  activateProjectile(entity: Entity): boolean {
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    if (!visualState) {
      this.logError(entity, 'activateProjectile', 'ProjectileVisualState component not found');
      return false;
    }

    if (!visualState.active) {
      visualState.activate();
      this.logVisualStateChange(entity, 'activated');
    }
    return true;
  }

  /**
   * Interfaccia pubblica: disattiva un proiettile
   */
  deactivateProjectile(entity: Entity): boolean {
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    if (!visualState) {
      this.logError(entity, 'deactivateProjectile', 'ProjectileVisualState component not found');
      return false;
    }

    if (visualState.active) {
      visualState.deactivate();
      this.logVisualStateChange(entity, 'deactivated');
    }
    return true;
  }

  /**
   * Interfaccia pubblica: ottiene lo stato visivo corrente
   */
  getVisualState(entity: Entity): ProjectileVisualState | null {
    return this.ecs.getComponent(entity, ProjectileVisualState) ?? null;
  }

  /**
   * Interfaccia pubblica: verifica se un proiettile deve essere renderizzato
   */
  shouldRender(entity: Entity): boolean {
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
    return visualState ? visualState.shouldRender() : false;
  }

  /**
   * Interfaccia pubblica: ottiene tutti i proiettili visibili in un layer specifico
   */
  getVisibleProjectilesInLayer(layer: number): Entity[] {
    return this.projectileEntities.filter(entity => {
      const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
      return visualState && visualState.shouldRender() && visualState.layer === layer;
    });
  }

  /**
   * Interfaccia pubblica: ottiene statistiche sui proiettili visivi
   */
  getVisualStats(): {
    total: number;
    active: number;
    visible: number;
    fading: number;
    byLayer: Record<number, number>;
  } {
    const stats = {
      total: this.projectileEntities.length,
      active: 0,
      visible: 0,
      fading: 0,
      byLayer: {} as Record<number, number>
    };

    for (const entity of this.projectileEntities) {
      const visualState = this.ecs.getComponent(entity, ProjectileVisualState);
      if (!visualState) continue;

      if (visualState.active) stats.active++;
      if (visualState.visible) stats.visible++;
      if (visualState.fadeState !== VisualFadeState.NONE) stats.fading++;

      stats.byLayer[visualState.layer] = (stats.byLayer[visualState.layer] || 0) + 1;
    }

    return stats;
  }

  /**
   * Logging centralizzato per cambiamenti di stato visivo
   */
  private logVisualStateChange(entity: Entity, action: string, details?: any): void {
    const projectile = this.ecs.getComponent(entity, Projectile);
    const visualState = this.ecs.getComponent(entity, ProjectileVisualState);

    if (!projectile || !visualState) return;

    const projectileId = (projectile as any).id || `entity_${entity.id}`;

    ProjectileLogger.logVisualStateChange(
      projectileId,
      entity,
      'ProjectileVisualManager',
      action,
      {
        active: visualState.active,
        visible: visualState.visible,
        alpha: visualState.alpha,
        layer: visualState.layer,
        fadeState: visualState.fadeState
      },
      details?.position
    );
  }

  /**
   * Logging per errori
   */
  private logError(entity: Entity, operation: string, message: string): void {
    LoggerWrapper.error(LogCategory.RENDER, `ProjectileVisualManager.${operation} failed`, new Error(message), {
      entityId: entity.id,
      operation
    });
  }

  /**
   * Cleanup alla distruzione del sistema
   */
  destroy(): void {
    this.projectileEntities = [];
    LoggerWrapper.render('ProjectileVisualManager destroyed');
  }
}