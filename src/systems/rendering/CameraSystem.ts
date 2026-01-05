import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Camera } from '../../entities/spatial/Camera';

/**
 * Sistema dedicato alla gestione della camera
 * Responsabile di mantenere la camera centrata sul player e fornire accesso alla camera
 */
export class CameraSystem extends BaseSystem {
  private camera: Camera;

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
   */
  centerOn(x: number, y: number): void {
    this.camera.centerOn(x, y);
  }

  /**
   * Aggiorna la camera (per ora non fa nulla, ma può essere esteso per smooth following, zoom, etc.)
   */
  update(deltaTime: number): void {
    // Per ora la camera non ha logica di update propria
    // ma questo metodo è richiesto dall'interfaccia System
  }
}
