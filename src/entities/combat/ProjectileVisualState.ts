import { Component } from '../../infrastructure/ecs/Component';
import { RenderLayer } from '../../core/utils/rendering/RenderLayers';

/**
 * Stati possibili per l'animazione di fade
 */
export enum VisualFadeState {
  NONE = 'none',           // Nessun fade
  FADING_IN = 'fading_in', // In transizione da invisibile a visibile
  FADING_OUT = 'fading_out' // In transizione da visibile a invisibile
}

/**
 * Componente che gestisce lo stato visivo dei proiettili
 * Permette controllo esplicito su visibilità, fade e layer di rendering
 */
export class ProjectileVisualState extends Component {
  /** Se il proiettile è attivo (logicamente esistente) */
  public active: boolean;

  /** Se il proiettile è visibile (può essere nascosto per debug o effetti) */
  public visible: boolean;

  /** Layer di rendering per controllo ordine di disegno */
  public layer: RenderLayer;

  /** Opacità corrente (0.0 = trasparente, 1.0 = opaco) */
  public alpha: number;

  /** Stato corrente dell'animazione di fade */
  public fadeState: VisualFadeState;

  /** Velocità del fade (unità al secondo) */
  public fadeSpeed: number;

  /** Timestamp inizio fade corrente (per calcoli temporali) */
  public fadeStartTime: number;

  /** Se il proiettile deve essere rimosso dal rendering ma non dall'ECS */
  public markedForRemoval: boolean;

  constructor(
    active: boolean = true,
    visible: boolean = true,
    layer: RenderLayer = RenderLayer.PROJECTILES,
    alpha: number = 1.0,
    fadeState: VisualFadeState = VisualFadeState.NONE,
    fadeSpeed: number = 1.0
  ) {
    super();
    this.active = active;
    this.visible = visible;
    this.layer = layer;
    this.alpha = alpha;
    this.fadeState = fadeState;
    this.fadeSpeed = fadeSpeed;
    this.fadeStartTime = Date.now();
    this.markedForRemoval = false;
  }

  /**
   * Avvia un fade-in dal valore alpha corrente a 1.0
   */
  startFadeIn(speed: number = 1.0): void {
    this.fadeState = VisualFadeState.FADING_IN;
    this.fadeSpeed = speed;
    this.fadeStartTime = Date.now();
  }

  /**
   * Avvia un fade-out dal valore alpha corrente a 0.0
   */
  startFadeOut(speed: number = 1.0): void {
    this.fadeState = VisualFadeState.FADING_OUT;
    this.fadeSpeed = speed;
    this.fadeStartTime = Date.now();
  }

  /**
   * Interrompe qualsiasi animazione di fade
   */
  stopFade(): void {
    this.fadeState = VisualFadeState.NONE;
  }

  /**
   * Imposta direttamente l'opacità senza animazione
   */
  setAlpha(alpha: number): void {
    this.alpha = Math.max(0.0, Math.min(1.0, alpha));
    this.fadeState = VisualFadeState.NONE;
  }

  /**
   * Mostra il proiettile (imposta visible = true)
   */
  show(): void {
    this.visible = true;
  }

  /**
   * Nasconde il proiettile (imposta visible = false)
   */
  hide(): void {
    this.visible = false;
  }

  /**
   * Disattiva il proiettile (active = false)
   */
  deactivate(): void {
    this.active = false;
  }

  /**
   * Riattiva il proiettile (active = true)
   */
  activate(): void {
    this.active = true;
  }

  /**
   * Marca il proiettile per la rimozione dal rendering
   */
  markForRemoval(): void {
    this.markedForRemoval = true;
  }

  /**
   * Verifica se il proiettile deve essere renderizzato
   */
  shouldRender(): boolean {
    return this.active && this.visible && !this.markedForRemoval;
  }
}