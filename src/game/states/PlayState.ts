import { GameState } from './GameState';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { World } from '../../infrastructure/engine/World';
import { MovementSystem } from '../../systems/physics/MovementSystem';
import { CameraSystem } from '../../systems/rendering/CameraSystem';
import { InterpolationSystem } from '../../systems/physics/InterpolationSystem';
import { QuestManager } from '../../core/domain/quest/QuestManager';
import { QuestSystem } from '../../systems/quest/QuestSystem';
import { QuestTrackingSystem } from '../../systems/quest/QuestTrackingSystem';
import { GameInitializationSystem } from '../../systems/game/GameInitializationSystem';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { NETWORK_CONFIG } from '../../config/NetworkConfig';
import { RemotePlayerSystem } from '../../systems/multiplayer/RemotePlayerSystem';
import { RemoteNpcSystem } from '../../systems/multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../../systems/multiplayer/RemoteProjectileSystem';
import { UiSystem } from '../../systems/ui/UiSystem';
import { EconomySystem } from '../../systems/economy/EconomySystem';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { Npc } from '../../entities/ai/Npc';
import AudioSystem from '../../systems/audio/AudioSystem';
import { PerformanceMonitor } from '../../core/utils/performance/PerformanceMonitor';
import { LogSystem } from '../../systems/rendering/LogSystem';


// Modular architecture managers
import { PlayStateInitializer } from './managers/playstate/PlayStateInitializer';
import { PlayStateLifecycleManager } from './managers/playstate/PlayStateLifecycleManager';
import { PlayStateResourceManager } from './managers/playstate/PlayStateResourceManager';

/**
 * Stato del gameplay attivo
 * Gestisce il mondo di gioco, ECS e tutti i sistemi di gameplay
 */
export class PlayState extends GameState {

  private world!: World;
  private uiSystem!: UiSystem;
  private gameInitSystem!: GameInitializationSystem;
  private context: GameContext;
  private playerEntity: Entity | null = null;
  private sessionStartTime: number = 0;
  private economySystem: EconomySystem | null = null;
  private questSystem: QuestSystem | null = null;
  private questManager: QuestManager | null = null;
  private questTrackingSystem: QuestTrackingSystem | null = null;
  private cameraSystem: CameraSystem | null = null;
  private movementSystem: MovementSystem | null = null;
  private interpolationSystem: InterpolationSystem | null = null;
  private audioSystem: AudioSystem | null = null;
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private remotePlayerSystem: RemotePlayerSystem | null = null;
  private remoteNpcSystem: RemoteNpcSystem | null = null;
  private remoteProjectileSystem: RemoteProjectileSystem | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;


  // Modular architecture managers (lazy initialization)
  private initializer!: PlayStateInitializer;
  private lifecycleManager!: PlayStateLifecycleManager;
  private resourceManager!: PlayStateResourceManager;
  private managersInitialized: boolean = false;

  /**
   * Segnala che i dati del giocatore sono cambiati e dovrebbero essere salvati
   * Questo viene chiamato da sistemi come RewardSystem quando avvengono cambiamenti significativi
   */
  markAsChanged(): void {
    if (this.clientNetworkSystem && this.context.authId) {
      // Invia una richiesta di salvataggio immediato al server
      this.clientNetworkSystem.sendSaveRequest(this.context.authId);
    }
  }

  /**
   * Verifica se la sessione è in modalità multiplayer
   */
  isMultiplayer(): boolean {
    return this.clientNetworkSystem !== null;
  }

  constructor(context: GameContext) {
    super();
    this.context = context;
    // Crea il mondo di gioco
    this.world = new World(context.canvas);

    // Inizializza sistemi Quest per operazioni immediate
    this.questManager = new QuestManager();
    this.questSystem = new QuestSystem(this.world.getECS(), this.questManager);

    // UiSystem verrà creato nel metodo enter() per evitare inizializzazioni premature
    // this.uiSystem = new UiSystem(this.world.getECS(), this.questSystem, this.context);

    // Crea sistema di inizializzazione (senza UiSystem per ora)
    this.gameInitSystem = new GameInitializationSystem(this.world.getECS(), this.world, this.context, this.questManager, this.questSystem, null, this);
  }

  /**
   * Initializes managers with dependency injection
   */
  private initializeManagers(): void {
    if (this.managersInitialized) return;

    // Initialize resource manager first (simplest)
    this.resourceManager = new PlayStateResourceManager(
      this.world,
      this.context,
      this.gameInitSystem,
      () => this.uiSystem,
      () => this.playerEntity,
      () => this.remotePlayerSystem,
      () => this.cameraSystem,
      () => this.movementSystem,
      () => this.economySystem
    );

    // Initialize lifecycle manager
    this.lifecycleManager = new PlayStateLifecycleManager(
      this.world,
      () => this.clientNetworkSystem,
      () => this.uiSystem,
      () => this.playerEntity,
      () => this.resourceManager.updateNicknamePosition(),
      () => this.resourceManager.updateNpcNicknames(),
      () => this.resourceManager.updateRemotePlayerNicknames(),
      () => this.resourceManager.updatePetNicknames()
    );

    // Initialize initializer (most complex, depends on other managers)
    this.initializer = new PlayStateInitializer(
      this.context,
      this.world,
      this.gameInitSystem,
      () => this.uiSystem,
      (uiSystem) => { this.uiSystem = uiSystem; },
      () => this.clientNetworkSystem,
      (system) => { this.clientNetworkSystem = system; },
      () => this.remotePlayerSystem,
      (system) => { this.remotePlayerSystem = system; },
      () => this.remoteNpcSystem,
      (system) => { this.remoteNpcSystem = system; },
      () => this.remoteProjectileSystem,
      (system) => { this.remoteProjectileSystem = system; },
      () => this.playerEntity,
      (entity) => { this.playerEntity = entity; },
      () => this.economySystem,
      (system) => { this.economySystem = system; },
      () => this.questSystem,
      (system) => { this.questSystem = system; },
      () => this.questManager,
      (manager) => { this.questManager = manager; },
      () => this.cameraSystem,
      (system) => { this.cameraSystem = system; },
      () => this.movementSystem,
      (system) => { this.movementSystem = system; },
      () => this.interpolationSystem,
      (system) => { this.interpolationSystem = system; },
      () => this.audioSystem,
      (system) => { this.audioSystem = system; }
    );

    // Initialize QuestTrackingSystem
    if (this.questManager) {
      this.questTrackingSystem = new QuestTrackingSystem(this.world, this.questManager, this);

      // Set dependencies that are available now
      if (this.economySystem) {
        this.questTrackingSystem.setEconomySystem(this.economySystem);
      }

      // Note: LogSystem and PlayerEntity might be set later via lifecycle or setters
      // We'll update them in update() loops or when systems change

      // 🔄 Ensure QuestManager gets the playerId if already available in context
      if (this.context.playerDbId) {
        this.questManager.setPlayerId(this.context.playerDbId);
      }
    }

    this.managersInitialized = true;
  }

  /**
   * Avvia il gameplay
   */
  async enter(_context: GameContext): Promise<void> {
    // PLAYTEST METRICS: Log inizio sessione
    this.sessionStartTime = Date.now();
    // console.log(`[PLAYTEST] Session started at ${new Date().toISOString()}`);

    // Marca come inizializzato per evitare doppia inizializzazione
    (this as any)._initialized = true;

    this.initializeManagers();
    await this.initializer.enter();
  }







  /**
   * Aggiorna il gameplay
   */
  update(deltaTime: number): void {
    this.initializeManagers();

    // Update QuestTrackingSystem dependencies
    if (this.questTrackingSystem) {
      // UiSystem might have been created late
      if (this.uiSystem && !this.questTrackingSystem['logSystem']) {
        // Assuming UiSystem has access to LogSystem or we can get it differently.
        // Actually, QuestTrackingSystem expects LogSystem separately.
        // Usually LogSystem is in ECS.
        const logSystem = this.world.getECS().getSystems().find(s => s.constructor.name === 'LogSystem');
        if (logSystem) {
          this.questTrackingSystem.setLogSystem(logSystem as any);
        }
      }

      if (this.playerEntity) {
        this.questTrackingSystem.setPlayerEntity(this.playerEntity);
      }

      if (this.economySystem) {
        this.questTrackingSystem.setEconomySystem(this.economySystem);
      }

      // Wire ClientNetworkSystem to QuestTrackingSystem
      if (this.clientNetworkSystem) {
        if (typeof (this.clientNetworkSystem as any).setQuestTrackingSystem === 'function') {
          (this.clientNetworkSystem as any).setQuestTrackingSystem(this.questTrackingSystem);
        }
        // Inject QuestManager for hydration
        if (typeof (this.clientNetworkSystem as any).setQuestManager === 'function') {
          (this.clientNetworkSystem as any).setQuestManager(this.questManager);
        }
      }
    }

    // Update PerformanceMonitor
    if (this.performanceMonitor) {
      this.performanceMonitor.update();
    } else {
      const logSystem = this.world.getECS().getSystems().find(s => s instanceof LogSystem) as LogSystem;
      if (logSystem) {
        this.performanceMonitor = new PerformanceMonitor(this.world.getECS(), logSystem);
      }
    }

    this.lifecycleManager.update(deltaTime);
  }


  /**
   * Renderizza il gioco
   */
  render(_ctx: CanvasRenderingContext2D): void {
    this.initializeManagers();
    this.lifecycleManager.render(_ctx);
  }

  /**
   * Gestisce input di gioco
   */
  handleInput(_event: Event): void {
    this.initializeManagers();
    this.lifecycleManager.handleInput(_event);
  }

  /**
   * Termina il gameplay
   */
  exit(): void {
    // PLAYTEST METRICS: Log fine sessione con durata
    if (this.sessionStartTime > 0) {
      const sessionDuration = Date.now() - this.sessionStartTime;
      const durationMinutes = Math.round(sessionDuration / 60000 * 100) / 100;
      // console.log(`[PLAYTEST] Session ended after ${durationMinutes} minutes`);
    }

    this.initializeManagers();
    this.lifecycleManager.exit();
  }

  /**
   * Crea l'elemento HTML per mostrare le info del giocatore
   */

  /**
   * Mostra le info del giocatore
   */










  /**
   * Ottiene il rank corrente del player usando RankSystem
   */
  private getPlayerRank(): string {
    this.initializeManagers();
    return this.resourceManager.getPlayerRank();
  }






  /**
   * Aggiorna la posizione del nickname delegando all'UiSystem
   */
  private updateNicknamePosition(): void {
    this.initializeManagers();
    this.resourceManager.updateNicknamePosition();
  }

  /**
   * Aggiorna posizioni e visibilità dei nickname NPC (elementi DOM stabili)
   */
  private updateNpcNicknames(): void {
    this.initializeManagers();
    this.resourceManager.updateNpcNicknames();
  }

  /**
   * Aggiorna posizioni e contenuti dei nickname remote player
   */
  private updateRemotePlayerNicknames(): void {
    this.initializeManagers();
    this.resourceManager.updateRemotePlayerNicknames();
  }













  /**
   * Restituisce il mondo di gioco per accesso esterno
   */
  getWorld(): World {
    return this.world;
  }
}
