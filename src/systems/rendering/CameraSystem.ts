import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Camera } from '../../entities/spatial/Camera';

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

  // Smooth Camera Follow
  private targetPos: { x: number; y: number } | null = null;
  private readonly CAMERA_SMOOTH_SPEED: number = 20.0; // Valore alto (20) per reattività ma sufficiente smooth per jitter

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
        this.targetPos.x = x;
        this.targetPos.y = y;
      }
    }
  }

  /**
   * Snap istantaneo della camera a una posizione (senza interpolazione)
   * Usato per teletrasporti e cambi mappa dove non si vuole lo slide
   */
  snapTo(x: number, y: number): void {
    this.camera.centerOn(x, y);
    if (!this.targetPos) {
      this.targetPos = { x, y };
    } else {
      this.targetPos.x = x;
      this.targetPos.y = y;
    }
    // Reset last position per evitare calcoli di velocità errati
    if (!this.lastPosition) {
      this.lastPosition = { x, y };
    } else {
      this.lastPosition.x = x;
      this.lastPosition.y = y;
    }
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

    if (!this.lastPosition) {
      this.lastPosition = { x: playerX, y: playerY };
    } else {
      this.lastPosition.x = playerX;
      this.lastPosition.y = playerY;
    }

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
        if (!this.targetPos) {
          this.targetPos = { x: this.camera.x, y: this.camera.y };
        } else {
          this.targetPos.x = this.camera.x;
          this.targetPos.y = this.camera.y;
        }

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

    // 2. Apply Smooth Following Logic
    if (!this.isZoomAnimating && this.targetPos) {
      const dt = deltaTime / 1000;
      // Frame-rate independent lerp
      const lerpFactor = 1 - Math.exp(-this.CAMERA_SMOOTH_SPEED * dt);

      const currentX = this.camera.x;
      const currentY = this.camera.y;

      // Interpolate base position
      let newX = currentX + (this.targetPos.x - currentX) * lerpFactor;
      let newY = currentY + (this.targetPos.y - currentY) * lerpFactor;

      // Apply shake offset
      // NOTA: La camera usa centerOn, quindi offsettiamo la posizione target visuale
      // Ma non salviamo lo shake nel targetPos, è solo visivo per questo frame
      this.camera.centerOn(newX + shakeOffsetX, newY + shakeOffsetY);
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
