import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Camera } from '../../entities/spatial/Camera';
import { LogSystem } from '../rendering/LogSystem';

// Modular architecture managers
import { PlayerAudioManager } from './managers/PlayerAudioManager';
import { PlayerInputManager } from './managers/PlayerInputManager';
import { PlayerMovementManager } from './managers/PlayerMovementManager';
import { PlayerAttackManager } from './managers/PlayerAttackManager';

/**
 * Sistema di controllo del player - gestisce click-to-move e movimento continuo
 */
export class PlayerControlSystem extends BaseSystem {
  private playerEntity: any = null;
  private camera: Camera | null = null;
  private audioSystem: any = null;
  private onMouseStateCallback?: (pressed: boolean, x: number, y: number) => void;
  private onMinimapMovementComplete?: () => void;
  private logSystem: LogSystem | null = null;
  private attackActivated = false;

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

    this.managersInitialized = true;
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
    const combatSystem = this.ecs.systems?.find((system: any) =>
      typeof system.processPlayerCombat === 'function'
    );
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
   * Imposta la camera per la conversione coordinate
   */
  setCamera(camera: Camera): void {
    this.camera = camera;
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
      this.movementManager.movePlayerTowardsMinimapTarget();
    } else if (this.inputManager.isKeyboardMoving()) {
      this.movementManager.movePlayerWithKeyboard();
    } else if (this.inputManager.getIsMousePressed()) {
      this.movementManager.movePlayerTowardsMouse();
    } else {
      this.movementManager.stopPlayerMovement();
    }

    // Ruota verso l'NPC selezionato SOLO se l'attacco è attivo
    if (this.attackActivated) {
      this.attackManager.faceSelectedNpc();
    }
  }

  /**
   * Gestisce lo stato del mouse (premuto/rilasciato)
   */
  handleMouseState(pressed: boolean, x: number, y: number): void {
    if (!this.playerEntity) return;
    this.initializeManagers();

    // Se si clicca con il mouse normale, cancella il target della minimappa
    if (pressed) {
      this.movementManager.clearMinimapTarget();
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
    const combatSystem = this.ecs.systems?.find((system: any) =>
      typeof system.stopCombatImmediately === 'function'
    );

    if (combatSystem) {
      combatSystem.stopCombatImmediately();
    }
  }
}

