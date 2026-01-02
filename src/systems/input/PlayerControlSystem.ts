import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Transform } from '/src/entities/spatial/Transform';
import { Velocity } from '/src/entities/spatial/Velocity';
import { SelectedNpc } from '/src/entities/combat/SelectedNpc';
import { Camera } from '/src/entities/spatial/Camera';
import { CONFIG } from '/src/utils/config/Config';

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
  private minimapTargetX: number | null = null;
  private minimapTargetY: number | null = null;
  private onMinimapMovementComplete?: () => void;

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

  /**
   * Imposta callback per quando finisce il movimento dalla minimappa
   */
  setMinimapMovementCompleteCallback(callback: () => void): void {
    this.onMinimapMovementComplete = callback;
  }

  update(deltaTime: number): void {
    if (!this.playerEntity) return;

    // Priorità: movimento minimappa > movimento mouse > fermo
    if (this.minimapTargetX !== null && this.minimapTargetY !== null) {
      this.movePlayerTowardsMinimapTarget();
    } else if (this.isMousePressed) {
      this.movePlayerTowardsMouse();
    } else {
      // Quando non c'è movimento richiesto, ferma il player
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

    // Se si clicca con il mouse normale, cancella il target della minimappa
    if (pressed) {
      this.minimapTargetX = null;
      this.minimapTargetY = null;
    }

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
   * Imposta una destinazione per il movimento del player
   * Usato per click-to-move dalla minimappa
   */
  movePlayerTo(worldX: number, worldY: number): void {
    if (!this.playerEntity) return;

    // Salva la destinazione mondo per il movimento dalla minimappa
    this.minimapTargetX = worldX;
    this.minimapTargetY = worldY;

    // Disabilita il movimento normale con mouse
    this.isMousePressed = false;
  }

  /**
   * Muove il player verso la destinazione della minimappa
   */
  private movePlayerTowardsMinimapTarget(): void {
    if (!this.playerEntity || this.minimapTargetX === null || this.minimapTargetY === null) return;

    const transform = this.ecs.getComponent(this.playerEntity, Transform);
    const velocity = this.ecs.getComponent(this.playerEntity, Velocity);

    if (!transform || !velocity) return;

    const dx = this.minimapTargetX - transform.x;
    const dy = this.minimapTargetY - transform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 50) { // Se siamo abbastanza lontani (soglia più alta per minimappa)
      // Normalizza la direzione
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Imposta velocity verso la destinazione (stessa velocità del player)
      velocity.setVelocity(dirX * CONFIG.PLAYER_SPEED, dirY * CONFIG.PLAYER_SPEED);

      // Ruota verso la direzione del movimento (sempre, dato che è navigazione)
      const angle = Math.atan2(dirY, dirX) + Math.PI / 2;
      transform.rotation = angle;
    } else {
      // Vicino alla destinazione, ferma il movimento e reset target
      velocity.stop();
      this.minimapTargetX = null;
      this.minimapTargetY = null;

      // Notifica che il movimento dalla minimappa è completato
      if (this.onMinimapMovementComplete) {
        this.onMinimapMovementComplete();
      }
    }
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
      velocity.setVelocity(dirX * CONFIG.PLAYER_SPEED, dirY * CONFIG.PLAYER_SPEED);

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
      this.isMousePressed = false; // Reset mouse pressed state
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
