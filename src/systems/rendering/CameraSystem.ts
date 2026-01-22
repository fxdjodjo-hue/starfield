import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Camera } from '../../entities/spatial/Camera';

/**
 * Sistema dedicato alla gestione della camera
 * Responsabile di mantenere la camera centrata sul player e fornire accesso alla camera
 */
export class CameraSystem extends BaseSystem {
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
    if (!this.isZoomAnimating) {
      this.camera.centerOn(x, y);
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

        // Chiama il callback se presente
        if (onComplete) {
          onComplete();
        }
      }
    }
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
