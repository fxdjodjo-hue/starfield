import { BaseSystem } from '../ecs/System';
import { ECS } from '../ecs/ECS';
import { Transform } from '../entities/Transform';
import { Velocity } from '../entities/Velocity';
import { SelectedNpc } from '../entities/SelectedNpc';
import { Camera } from '../entities/Camera';

/**
 * Sistema di controllo del player - gestisce click-to-move e movimento continuo
 */
export class PlayerControlSystem extends BaseSystem {
  private playerEntity: any = null;
  private camera: Camera | null = null;
  private onMouseStateCallback?: (pressed: boolean, x: number, y: number) => void;
  private isMousePressed = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta l'entità player da controllare
   */
  setPlayerEntity(entity: any): void {
    this.playerEntity = entity;
  }

  /**
   * Imposta il callback per lo stato del mouse
   */
  setMouseStateCallback(callback: (pressed: boolean, x: number, y: number) => void): void {
    this.onMouseStateCallback = callback;
  }

  /**
   * Imposta la camera per la conversione coordinate
   */
  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  update(deltaTime: number): void {
    if (!this.playerEntity) return;

    // Se il mouse è premuto, muovi il player verso la posizione del mouse
    if (this.isMousePressed) {
      this.movePlayerTowardsMouse();
    } else {
      // Quando il mouse non è premuto, ferma il player
      this.stopPlayerMovement();
    }

    // Se c'è un NPC selezionato, ruota il player verso di esso (ha priorità)
    this.faceSelectedNpc();
  }

  /**
   * Gestisce lo stato del mouse (premuto/rilasciato)
   */
  handleMouseState(pressed: boolean, x: number, y: number): void {
    if (!this.playerEntity) return;

    this.isMousePressed = pressed;
    if (pressed) {
      this.lastMouseX = x;
      this.lastMouseY = y;
    }
  }

  /**
   * Gestisce il movimento del mouse mentre è premuto
   */
  handleMouseMoveWhilePressed(x: number, y: number): void {
    if (!this.playerEntity || !this.isMousePressed) return;

    // Aggiorna continuamente la posizione target mentre il mouse si muove
    this.lastMouseX = x;
    this.lastMouseY = y;
  }

  /**
   * Muove il player verso la posizione del mouse
   */
  private movePlayerTowardsMouse(): void {
    if (!this.playerEntity || !this.camera) return;

    const transform = this.ecs.getComponent(this.playerEntity, Transform);
    const velocity = this.ecs.getComponent(this.playerEntity, Velocity);

    if (!transform || !velocity) return;

    // Converti coordinate schermo del mouse in coordinate mondo usando la camera
    const worldMousePos = this.camera.screenToWorld(this.lastMouseX, this.lastMouseY, window.innerWidth, window.innerHeight);
    const worldMouseX = worldMousePos.x;
    const worldMouseY = worldMousePos.y;

    const dx = worldMouseX - transform.x;
    const dy = worldMouseY - transform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) { // Se siamo abbastanza lontani
      // Normalizza la direzione
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Imposta velocity verso il mouse
      const speed = 200; // pixels per second
      velocity.setVelocity(dirX * speed, dirY * speed);

      // NON ruotare verso il mouse se c'è un NPC selezionato
      // La rotazione verso l'NPC ha priorità e viene gestita in faceSelectedNpc()
      const hasSelectedNpc = this.ecs.getEntitiesWithComponents(SelectedNpc).length > 0;
      if (!hasSelectedNpc) {
        // Solo se non c'è NPC selezionato, ruota verso la direzione del movimento
        const angle = Math.atan2(dirY, dirX) + Math.PI / 2;
        transform.rotation = angle;
      }
    } else {
      // Vicino al mouse, ferma il movimento
      velocity.stop();
    }
  }

  /**
   * Ferma il movimento del player
   */
  private stopPlayerMovement(): void {
    if (!this.playerEntity) return;

    const velocity = this.ecs.getComponent(this.playerEntity, Velocity);
    if (velocity) {
      velocity.stop();
    }
  }

  /**
   * Ruota il player verso l'NPC selezionato (se presente)
   */
  private faceSelectedNpc(): void {
    if (!this.playerEntity) return;

    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) return;

    const selectedNpc = selectedNpcs[0];
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
    const playerTransform = this.ecs.getComponent(this.playerEntity, Transform);

    if (!npcTransform || !playerTransform) return;

    // Calcola l'angolo verso l'NPC
    const dx = npcTransform.x - playerTransform.x;
    const dy = npcTransform.y - playerTransform.y;

    // Calcola l'angolo e ruota la nave
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    playerTransform.rotation = angle;
  }
}
