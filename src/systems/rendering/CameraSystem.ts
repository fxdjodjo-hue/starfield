import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Camera } from '../../entities/spatial/Camera';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';

/**
 * Sistema dedicato alla gestione della camera
 * Responsabile di mantenere la camera centrata sul player e fornire accesso alla camera
 */
export class CameraSystem extends BaseSystem {
  public static override readonly Type = 'CameraSystem';

  private camera: Camera;
  private zoomAnimation: {
    active: boolean;
    startZoom: number;
    targetZoom: number;
    duration: number;
    elapsed: number;
    onComplete?: () => void;
  } | null = null;
  private isZoomAnimating: boolean = false;

  // Direct Player Reference for Real-Time Position Reading
  private playerEntity: Entity | null = null;

  // Legacy targetPos (kept for backward compatibility with centerOn calls)
  private targetPos: { x: number; y: number } | null = null;

  // Speed-based zoom (disabled)
  private lastPosition: { x: number; y: number } | null = null;
  private currentSpeed: number = 0;
  private targetSpeedZoom: number = 1;
  private currentSpeedZoom: number = 1;
  private readonly BASE_ZOOM: number = 1;  // Zoom normale
  private readonly MIN_SPEED_ZOOM: number = 1;  // Disabled
  private readonly MAX_SPEED_FOR_ZOOM: number = 400;
  private readonly ZOOM_LERP_SPEED: number = 3;

  constructor(ecs: ECS) {
    super(ecs);
    // Crea una camera globale che segue il player
    this.camera = new Camera(0, 0, 1);
  }

  /**
   * Restituisce la camera corrente
   */
  getCamera(): Camera {
    return this.camera;
  }

  /**
   * Imposta l'entità player da seguire direttamente
   * Questo permette alla camera di leggere la posizione in real-time durante render
   */
  setPlayerEntity(entity: Entity): void {
    this.playerEntity = entity;
  }

  /**
   * Centra la camera su una posizione specifica
   * Non centra durante l'animazione zoom per evitare interferenze
   */
  centerOn(x: number, y: number): void {
    // Durante l'animazione zoom, mantieni la camera centrata sulla posizione iniziale
    // Durante l'animazione zoom, mantieni la camera centrata sulla posizione iniziale
    if (!this.isZoomAnimating) {
      if (!this.targetPos) {
        // First initialization: snap instantly to prevent swoop
        this.camera.centerOn(x, y);
        this.targetPos = { x, y };
      } else {
        // Update target for smooth interpolation
        this.targetPos = { x, y };
      }
    }
  }

  /**
   * Snap istantaneo della camera a una posizione (senza interpolazione)
   * Usato per teletrasporti e cambi mappa dove non si vuole lo slide
   */
  snapTo(x: number, y: number): void {
    this.camera.centerOn(x, y);
    this.targetPos = { x, y };
    // Reset last position per evitare calcoli di velocità errati
    this.lastPosition = { x, y };
  }

  /**
   * Avvia un'animazione di zoom out dalla nave
   * Parte molto zoomato sul centro della nave e fa zoom out fino alla visione normale
   */
  animateZoomOut(startZoom: number = 5, targetZoom: number = 1, duration: number = 2500, centerX?: number, centerY?: number, onComplete?: () => void): void {
    // Centra la camera sulla posizione specificata se fornita
    if (centerX !== undefined && centerY !== undefined) {
      this.camera.centerOn(centerX, centerY);
    }

    this.isZoomAnimating = true;
    this.zoomAnimation = {
      active: true,
      startZoom,
      targetZoom,
      duration,
      elapsed: 0,
      onComplete
    };
    this.camera.setZoom(startZoom);
  }

  /**
   * Verifica se l'animazione zoom è in corso
   */
  isZoomAnimationActive(): boolean {
    return this.isZoomAnimating && this.zoomAnimation !== null && this.zoomAnimation.active;
  }

  /**
   * Aggiorna lo zoom basato sulla velocità del player
   * Chiamare questo metodo con la posizione corrente del player
   */
  updateSpeedZoom(playerX: number, playerY: number, deltaTime: number): void {
    // Non aggiornare durante l'animazione zoom
    if (this.isZoomAnimating) {
      return;
    }

    // Calcola la velocità basata sulla differenza di posizione
    if (this.lastPosition) {
      const dx = playerX - this.lastPosition.x;
      const dy = playerY - this.lastPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Velocità in pixel al secondo (deltaTime è in ms)
      const instantSpeed = distance / (deltaTime / 1000);

      // Smooth la velocità per evitare scatti
      this.currentSpeed = this.currentSpeed * 0.9 + instantSpeed * 0.1;
    }

    this.lastPosition = { x: playerX, y: playerY };

    // Calcola il target zoom basato sulla velocità
    const speedRatio = Math.min(this.currentSpeed / this.MAX_SPEED_FOR_ZOOM, 1);
    this.targetSpeedZoom = this.BASE_ZOOM - (this.BASE_ZOOM - this.MIN_SPEED_ZOOM) * speedRatio;

    // Interpola smoothly verso il target zoom
    const lerpFactor = 1 - Math.exp(-this.ZOOM_LERP_SPEED * (deltaTime / 1000));
    this.currentSpeedZoom = this.currentSpeedZoom + (this.targetSpeedZoom - this.currentSpeedZoom) * lerpFactor;

    // Applica lo zoom (solo se non c'è animazione in corso)
    this.camera.setZoom(this.currentSpeedZoom);
  }

  /**
   * Aggiorna la camera (gestisce animazioni zoom)
   */
  update(deltaTime: number): void {
    if (this.zoomAnimation && this.zoomAnimation.active) {
      this.zoomAnimation.elapsed += deltaTime;
      const progress = Math.min(this.zoomAnimation.elapsed / this.zoomAnimation.duration, 1);

      // Easing smooth ease-out
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      const currentZoom = this.zoomAnimation.startZoom +
        (this.zoomAnimation.targetZoom - this.zoomAnimation.startZoom) * easedProgress;

      this.camera.setZoom(currentZoom);

      if (progress >= 1) {
        this.zoomAnimation.active = false;
        const onComplete = this.zoomAnimation.onComplete;
        this.zoomAnimation = null;
        this.isZoomAnimating = false;

        // Reset smooth target to avoid jump after zoom
        this.targetPos = { x: this.camera.x, y: this.camera.y };

        // Resetta lo speed zoom al valore finale dell'animazione
        this.currentSpeedZoom = currentZoom;

        // Chiama il callback se presente
        if (onComplete) {
          onComplete();
        }
      }
    }

    // REMOVED: Smooth logic moved to updateForRender to run at render frequency
  }

  // Screen Shake State
  private shakeState: {
    active: boolean;
    intensity: number;
    initialIntensity: number;
    duration: number;
    elapsed: number;
  } | null = null;

  /**
   * Avvia un effetto di screen shake
   * @param intensity Intensità dello shake (es. 5-20 pixel)
   * @param duration Durata in ms
   */
  public shake(intensity: number = 10, duration: number = 500): void {
    this.shakeState = {
      active: true,
      intensity: intensity,
      initialIntensity: intensity,
      duration: duration,
      elapsed: 0
    };
  }

  /**
   * Aggiorna la posizione della camera con interpolazione fluida (da chiamare nel loop di rendering)
   * @param deltaTime Tempo trascorso dall'ultimo frame di rendering in ms
   */
  public updateForRender(deltaTime: number): void {
    // 1. Update Shake
    let shakeOffsetX = 0;
    let shakeOffsetY = 0;

    if (this.shakeState && this.shakeState.active) {
      this.shakeState.elapsed += deltaTime;
      const progress = this.shakeState.elapsed / this.shakeState.duration;

      if (progress < 1) {
        // Decadimento lineare dell'intensità
        const currentIntensity = this.shakeState.initialIntensity * (1 - progress);

        // Random shake offset
        shakeOffsetX = (Math.random() - 0.5) * 2 * currentIntensity;
        shakeOffsetY = (Math.random() - 0.5) * 2 * currentIntensity;
      } else {
        this.shakeState.active = false;
        this.shakeState = null;
      }
    }

    // 2. Apply Camera Following Logic - READ PLAYER POSITION DIRECTLY
    // This eliminates timing mismatch between update (60Hz) and render (144Hz)
    if (!this.isZoomAnimating) {
      let newX: number | null = null;
      let newY: number | null = null;

      // Priority 1: Read player position directly (real-time, same frame)
      if (this.playerEntity) {
        const transform = this.ecs.getComponent(this.playerEntity, Transform);
        if (transform) {
          newX = transform.x;
          newY = transform.y;
        }
      }

      // Priority 2: Fallback to targetPos (for zoom animations, etc)
      if (newX === null && this.targetPos) {
        newX = this.targetPos.x;
        newY = this.targetPos.y;
      }

      // Apply camera position with shake
      if (newX !== null && newY !== null) {
        this.camera.centerOn(newX + shakeOffsetX, newY + shakeOffsetY);
      }
    }
    // Se c'è un'animazione zoom in corso, applica comunque lo shake alla posizione corrente
    else if (this.isZoomAnimating && this.shakeState?.active) {
      this.camera.centerOn(this.camera.x + shakeOffsetX, this.camera.y + shakeOffsetY);
    }
  }

  /**
   * Ottiene la velocità corrente del player (per debug/UI)
   */
  getCurrentSpeed(): number {
    return this.currentSpeed;
  }

  /**
   * Ottiene l'opacità del mondo durante l'animazione zoom (per fade-in)
   */
  getWorldOpacity(): number {
    if (!this.zoomAnimation || !this.zoomAnimation.active) {
      return 1;
    }

    const progress = Math.min(this.zoomAnimation.elapsed / this.zoomAnimation.duration, 1);
    // Fade-in più veloce: inizia a 0.3 e arriva a 1.0 entro il 40% dell'animazione
    if (progress < 0.4) {
      const fadeProgress = progress / 0.4;
      return 0.3 + (0.7 * fadeProgress);
    }
    return 1;
  }
}
