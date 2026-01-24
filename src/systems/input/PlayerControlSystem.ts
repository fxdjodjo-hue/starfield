import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Camera } from '../../entities/spatial/Camera';
import { LogSystem } from '../rendering/LogSystem';
import { CameraSystem } from '../rendering/CameraSystem';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { DisplayManager } from '../../infrastructure/display';

// Modular architecture managers
import { PlayerAudioManager } from './managers/PlayerAudioManager';
import { PlayerInputManager } from './managers/PlayerInputManager';
import { PlayerMovementManager } from './managers/PlayerMovementManager';
import { PlayerAttackManager } from './managers/PlayerAttackManager';
import { DeathPopupManager } from '../../presentation/ui/managers/death/DeathPopupManager';

/**
 * Sistema di controllo del player - gestisce click-to-move e movimento continuo
 */
export class PlayerControlSystem extends BaseSystem {
  private playerEntity: any = null;
  private camera: Camera | null = null;
  private cameraSystem: CameraSystem | null = null;
  private audioSystem: any = null;
  private onMouseStateCallback?: (pressed: boolean, x: number, y: number) => void;
  private onMinimapMovementComplete?: () => void;
  private logSystem: LogSystem | null = null;
  private attackActivated = false;
  private deathPopupManager: DeathPopupManager | null = null;
  private forceInputDisabled: boolean = false;

  // Modular architecture managers (lazy initialization)
  private audioManager!: PlayerAudioManager;
  private inputManager!: PlayerInputManager;
  private movementManager!: PlayerMovementManager;
  private attackManager!: PlayerAttackManager;
  private managersInitialized: boolean = false;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta il riferimento al DeathPopupManager per disabilitare input durante morte
   */
  setDeathPopupManager(deathPopupManager: DeathPopupManager): void {
    this.deathPopupManager = deathPopupManager;
  }

  /**
   * Forza l'abilitazione/disabilitazione dell'input (usato per respawn)
   */
  setInputForcedDisabled(disabled: boolean): void {
    this.forceInputDisabled = disabled;
  }

  /**
   * Initializes managers with dependency injection
   */
  private initializeManagers(): void {
    if (this.managersInitialized) return;

    // Initialize audio manager first (simplest)
    this.audioManager = new PlayerAudioManager(() => this.audioSystem);

    // Initialize attack manager (needs callbacks)
    this.attackManager = new PlayerAttackManager(
      this.ecs,
      () => this.playerEntity,
      () => this.logSystem,
      () => this.forceCombatCheck(),
      () => this.stopCombatIfActive(),
      (activated) => { this.attackActivated = activated; }
    );

    // Initialize input manager (needs attack callback)
    this.inputManager = new PlayerInputManager(
      this.ecs,
      () => this.attackManager.handleSpacePress(),
      this.onMouseStateCallback
    );

    // Initialize movement manager (needs input callbacks)
    this.movementManager = new PlayerMovementManager(
      this.ecs,
      () => this.playerEntity,
      () => this.camera,
      () => this.inputManager.getIsMousePressed(),
      () => this.inputManager.getLastMouseX(),
      () => this.inputManager.getLastMouseY(),
      () => this.inputManager.getKeysPressed(),
      (pressed) => { this.inputManager.setIsMousePressed(pressed); }
    );

    // Passa lo stato di combattimento al movement manager
    this.movementManager.setAttackActivatedCallback(() => this.attackActivated);

    // Setup UI panel event listeners to disable input when panels are open
    this.setupUIPanelEventListeners();

    this.managersInitialized = true;
  }

  /**
   * Setup event listeners for UI panels to disable input when panels are open
   */
  private setupUIPanelEventListeners(): void {
    // Disable input when a UI panel is opened
    document.addEventListener('uiPanelOpened', () => {
      this.inputManager.setInputDisabled(true);
    });

    // Re-enable input when a UI panel is closed
    document.addEventListener('uiPanelClosed', () => {
      this.inputManager.setInputDisabled(false);
    });
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
    if (this.managersInitialized) {
      // Recreate input manager with new callback
      this.inputManager = new PlayerInputManager(
        this.ecs,
        () => this.attackManager.handleSpacePress(),
        callback
      );
    }
  }

  /**
   * Gestisce la pressione dei tasti
   */
  handleKeyPress(key: string): void {
    this.initializeManagers();
    if (key === 'Space') {
      this.attackManager.handleKeyPress(key);
    } else {
      this.inputManager.handleKeyPress(key);
    }
  }

  /**
   * Gestisce il rilascio dei tasti (solo per movimento WASD)
   */
  handleKeyRelease(key: string): void {
    this.initializeManagers();
    this.inputManager.handleKeyRelease(key);
  }

  /**
   * Restituisce se l'attacco è attualmente attivato
   */
  isAttackActivated(): boolean {
    this.initializeManagers();
    return this.attackManager.isAttackActivated();
  }

  /**
   * Forza controllo immediato del combattimento (per risolvere timing issues)
   */
  private forceCombatCheck(): void {
    const combatSystem = this.ecs.getSystems().find((system: any) =>
      typeof system.processPlayerCombat === 'function'
    ) as any;
    if (combatSystem) {
      combatSystem.processPlayerCombat();
    }
  }

  /**
   * Disattiva forzatamente l'attacco (chiamato quando finisce il combattimento o cambia selezione)
   */
  deactivateAttack(): void {
    this.initializeManagers();
    this.attackManager.deactivateAttack();
  }

  /**
   * Deselect an NPC and reset ship rotation (unified method)
   */
  deselectNpcAndReset(npcEntity: any): void {
    this.initializeManagers();
    this.attackManager.deselectNpcAndReset(npcEntity);
  }

  /**
   * Reset ship rotation when NPC is deselected
   */
  resetShipRotation(): void {
    this.initializeManagers();
    this.attackManager.resetShipRotation();
  }

  /**
   * Imposta la camera per la conversione coordinate
   */
  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /**
   * Imposta il sistema camera per verificare lo stato dell'animazione zoom
   */
  setCameraSystem(cameraSystem: CameraSystem): void {
    this.cameraSystem = cameraSystem;
  }

  /**
   * Imposta il sistema audio per i suoni del motore
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
  }

  /**
   * Imposta il sistema di logging per messaggi in-game
   */
  setLogSystem(logSystem: LogSystem): void {
    this.logSystem = logSystem;
  }


  /**
   * Imposta callback per quando finisce il movimento dalla minimappa
   */
  setMinimapMovementCompleteCallback(callback: () => void): void {
    this.onMinimapMovementComplete = callback;
    this.initializeManagers();
    this.movementManager.setMinimapMovementCompleteCallback(callback);
  }

  update(deltaTime: number): void {
    if (!this.playerEntity) return;
    this.initializeManagers();

    // Disabilita input durante popup morte/respawn o se forzatamente disabilitato
    const isDeathPopupVisible = this.deathPopupManager?.isPopupVisible() ?? false;
    const shouldDisableInput = isDeathPopupVisible || this.forceInputDisabled;
    this.inputManager.setInputDisabled(shouldDisableInput);

    // Blocca il movimento durante l'animazione zoom
    const isZoomAnimating = this.cameraSystem?.isZoomAnimationActive ? this.cameraSystem.isZoomAnimationActive() : false;
    if (isZoomAnimating) {
      // Ferma il movimento e il suono del motore durante l'animazione
      this.movementManager.stopPlayerMovement();
      if (this.audioManager.isPlaying() && !this.audioManager.getEngineSoundPromise()) {
        const promise = this.audioManager.stop().finally(() => {
          this.audioManager.setEngineSoundPromise(null);
        });
        this.audioManager.setEngineSoundPromise(promise);
      }
      return; // Non processare input di movimento durante l'animazione
    }

    const isMoving = this.movementManager.hasMinimapTarget() ||
      this.inputManager.isKeyboardMoving() ||
      this.inputManager.getIsMousePressed();

    // Gestisci suono del motore - evita chiamate multiple rapide
    if (isMoving && !this.audioManager.isPlaying() && !this.audioManager.getEngineSoundPromise()) {
      const promise = this.audioManager.start().finally(() => {
        this.audioManager.setEngineSoundPromise(null);
      });
      this.audioManager.setEngineSoundPromise(promise);
    } else if (!isMoving && this.audioManager.isPlaying() && !this.audioManager.getEngineSoundPromise()) {
      const promise = this.audioManager.stop().finally(() => {
        this.audioManager.setEngineSoundPromise(null);
      });
      this.audioManager.setEngineSoundPromise(promise);
    }

    // Priorità: movimento minimappa > movimento tastiera > movimento mouse > fermo
    if (this.movementManager.hasMinimapTarget()) {
      this.movementManager.movePlayerTowardsMinimapTarget(deltaTime);
    } else if (this.inputManager.isKeyboardMoving()) {
      this.movementManager.movePlayerWithKeyboard(deltaTime);
    } else if (this.inputManager.getIsMousePressed()) {
      this.movementManager.movePlayerTowardsMouse(deltaTime);
    } else {
      this.movementManager.stopPlayerMovement();
    }

    // Ruota verso l'NPC selezionato durante combattimento attivo
    // Solo se c'è ancora un NPC selezionato
    if (this.attackActivated) {
      const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
      if (selectedNpcs.length > 0) {
        this.attackManager.faceSelectedNpc(deltaTime);
      } else {
        // If attack is active but no NPC is selected (e.g., NPC died or despawned)
        // Deactivate attack and reset rotation once
        this.attackActivated = false;
        this.attackManager.deactivateAttack();
        this.attackManager.resetShipRotation();
      }
    }
  }

  /**
   * Gestisce lo stato del mouse (premuto/rilasciato)
   */
  private mouseDownTime: number = 0;
  private mouseDownPos: { x: number; y: number } = { x: 0, y: 0 };
  private readonly CLICK_THRESHOLD_MS = 200;
  private readonly CLICK_DISTANCE_THRESHOLD = 5;

  /**
   * Gestisce lo stato del mouse (premuto/rilasciato)
   */
  handleMouseState(pressed: boolean, x: number, y: number): void {
    if (!this.playerEntity) return;
    this.initializeManagers();

    if (pressed) {
      // Mouse Down: Start tracking click attempt
      this.mouseDownTime = Date.now();
      this.mouseDownPos = { x, y };

      // Clear existing minimap target to allow manual steering immediately
      this.movementManager.clearMinimapTarget();
    } else {
      // Mouse Up: Check if it was a click or a drag release
      const pressDuration = Date.now() - this.mouseDownTime;
      const moveDistance = Math.sqrt(
        Math.pow(x - this.mouseDownPos.x, 2) +
        Math.pow(y - this.mouseDownPos.y, 2)
      );

      // If brief press and little movement -> It's a Click-to-Move!
      if (pressDuration < this.CLICK_THRESHOLD_MS && moveDistance < this.CLICK_DISTANCE_THRESHOLD) {
        if (this.camera) {
          // Calculate world position
          // Using DisplayManager logical size (similar to PlayerMovementManager)
          const { width, height } = DisplayManager.getInstance().getLogicalSize();
          // NOTE: Camera.screenToWorld uses logical coordinates. 
          // InputSystem gives coordinates relative to canvas.

          // Let's rely on camera.screenToWorld from Mouse position
          const worldPos = this.camera.screenToWorld(x, y, width, height);

          this.movementManager.movePlayerTo(worldPos.x, worldPos.y);
        }
      }
    }

    this.inputManager.handleMouseState(pressed, x, y);
  }

  /**
   * Gestisce il movimento del mouse mentre è premuto
   */
  handleMouseMoveWhilePressed(x: number, y: number): void {
    if (!this.playerEntity) return;
    this.initializeManagers();
    this.inputManager.handleMouseMoveWhilePressed(x, y);
  }

  /**
   * Imposta una destinazione per il movimento del player
   * Usato per click-to-move dalla minimappa
   */
  movePlayerTo(worldX: number, worldY: number): void {
    if (!this.playerEntity) return;
    this.initializeManagers();
    this.movementManager.movePlayerTo(worldX, worldY);
  }

  /**
   * Ferma il combattimento attivo quando disattivi manualmente l'attacco
   */
  private stopCombatIfActive(): void {
    const combatSystem = this.ecs.getSystems().find((system: any) =>
      typeof system.stopCombatImmediately === 'function'
    ) as any;

    if (combatSystem) {
      combatSystem.stopCombatImmediately();
    }
  }
}

