import { GameState } from './GameState';
import { GameContext } from '/src/infrastructure/engine/GameContext';
import { World } from '/src/infrastructure/engine/World';
import { MovementSystem } from '/src/systems/physics/MovementSystem';
import { RenderSystem } from '/src/systems/rendering/RenderSystem';
import { InputSystem } from '/src/systems/input/InputSystem';
import { PlayerControlSystem } from '/src/systems/input/PlayerControlSystem';
import { NpcBehaviorSystem } from '/src/systems/ai/NpcBehaviorSystem';
import { NpcSelectionSystem } from '/src/systems/ai/NpcSelectionSystem';
import { CombatSystem } from '/src/systems/combat/CombatSystem';
import { ExplosionSystem } from '/src/systems/combat/ExplosionSystem';
import { ProjectileSystem } from '/src/systems/combat/ProjectileSystem';
import { DamageTextSystem } from '/src/systems/rendering/DamageTextSystem';
import { MinimapSystem } from '/src/systems/rendering/MinimapSystem';
import { LogSystem } from '/src/systems/rendering/LogSystem';
import { ParallaxSystem } from '/src/systems/rendering/ParallaxSystem';
import { EconomySystem } from '/src/systems/EconomySystem';
import { RankSystem } from '/src/systems/RankSystem';
import { RewardSystem } from '/src/systems/RewardSystem';
import { QuestTrackingSystem } from '/src/systems/QuestTrackingSystem';
import { BoundsSystem } from '/src/systems/BoundsSystem';
import { NpcRespawnSystem } from '/src/systems/NpcRespawnSystem';
import { PlayerSystem } from '/src/systems/PlayerSystem';
import { QuestSystem } from '/src/systems/QuestSystem';
import { UiSystem } from '/src/systems/UiSystem';
import { NpcSystem } from '/src/systems/NpcSystem';
import { QuestManager } from '/src/systems/QuestManager';

/**
 * Stato del gameplay attivo - Pura orchestrazione
 * Coordina sistemi senza contenere logica di business
 * Segue Dependency Inversion: delega tutto ai Systems Layer
 */
export class PlayState extends GameState {
  private world: World;
  private context: GameContext;

  // Sistemi dedicati (Plugin Architecture)
  private playerSystem: PlayerSystem;
  private questSystem: QuestSystem;
  private uiSystem: UiSystem;
  private npcSystem: NpcSystem;
  private movementSystem: MovementSystem;
  private renderSystem: RenderSystem;
  private inputSystem: InputSystem;
  private playerControlSystem: PlayerControlSystem;
  private npcBehaviorSystem: NpcBehaviorSystem;
  private npcSelectionSystem: NpcSelectionSystem;
  private combatSystem: CombatSystem;
  private explosionSystem: ExplosionSystem;
  private projectileSystem: ProjectileSystem;
  private damageTextSystem: DamageTextSystem;
  private minimapSystem: MinimapSystem;
  private logSystem: LogSystem;
  private parallaxSystem: ParallaxSystem;
  private economySystem: EconomySystem;
  private rankSystem: RankSystem;
  private rewardSystem: RewardSystem;
  private questTrackingSystem: QuestTrackingSystem;
  private boundsSystem: BoundsSystem;
  private npcRespawnSystem: NpcRespawnSystem;

  constructor(context: GameContext) {
    super();
    this.context = context;
    this.world = new World(context.canvas);
    this.initializeSystems();
  }

  /**
   * Inizializza sistemi - Plugin Architecture
   */
  private initializeSystems(): void {
    const ecs = this.world.getECS();
    const questManager = new QuestManager();

    // Inizializza tutti i sistemi
    this.questSystem = new QuestSystem(ecs, questManager);
    this.uiSystem = new UiSystem(ecs, this.questSystem);
    this.playerSystem = new PlayerSystem(ecs);
    this.npcSystem = new NpcSystem(ecs);
    this.movementSystem = new MovementSystem(ecs, this.world.getCamera());
    this.renderSystem = new RenderSystem(ecs, this.movementSystem);
    this.inputSystem = new InputSystem();
    this.playerControlSystem = new PlayerControlSystem(ecs, this.inputSystem);
    this.npcBehaviorSystem = new NpcBehaviorSystem(ecs);
    this.npcSelectionSystem = new NpcSelectionSystem(ecs, this.inputSystem);
    this.combatSystem = new CombatSystem(ecs);
    this.explosionSystem = new ExplosionSystem(ecs);
    this.projectileSystem = new ProjectileSystem(ecs);
    this.damageTextSystem = new DamageTextSystem(ecs);
    this.minimapSystem = new MinimapSystem(ecs, this.world.getCamera());
    this.logSystem = new LogSystem(ecs);
    this.parallaxSystem = new ParallaxSystem(ecs);
    this.economySystem = new EconomySystem(ecs);
    this.rankSystem = new RankSystem(ecs);
    this.rewardSystem = new RewardSystem(ecs);
    this.questTrackingSystem = new QuestTrackingSystem(ecs, questManager);
    this.boundsSystem = new BoundsSystem(ecs, this.world.getCamera());
    this.npcRespawnSystem = new NpcRespawnSystem(ecs);

    this.registerSystems();
  }

  /**
   * Registra sistemi nel mondo
   */
  private registerSystems(): void {
    const systems = [
      this.movementSystem, this.renderSystem, this.inputSystem, this.playerControlSystem,
      this.npcBehaviorSystem, this.npcSelectionSystem, this.combatSystem, this.explosionSystem,
      this.projectileSystem, this.damageTextSystem, this.minimapSystem, this.logSystem,
      this.parallaxSystem, this.economySystem, this.rankSystem, this.rewardSystem,
      this.questSystem, this.questTrackingSystem, this.boundsSystem, this.npcRespawnSystem,
      this.uiSystem, this.playerSystem, this.npcSystem
    ];
    systems.forEach(system => this.world.registerSystem(system));
  }

  /**
   * Avvia gameplay - Pura orchestrazione
   */
  async enter(context: GameContext): Promise<void> {
    this.uiSystem.hideMainTitle();
    await this.initializeGame();
    this.uiSystem.initialize();
  }

  /**
   * Inizializza mondo e entità
   */
  private async initializeGame(): Promise<void> {
    await this.loadAndCreateEntities();
    this.configureSystemIntegrations();
  }

  /**
   * Carica risorse e crea entità
   */
  private async loadAndCreateEntities(): Promise<void> {
    const shipImage = await this.context.assetManager.loadImage('/assets/ships/0/0.png');
    const shipSprite = new Sprite(shipImage, shipImage.width * 0.2, shipImage.height * 0.2);

    this.playerSystem.createPlayer(0, 0);

    const scouterImage = await this.context.assetManager.loadImage('/assets/npc_ships/scouter/npc_scouter.png');
    const scouterSprite = new Sprite(scouterImage, scouterImage.width * 0.15, scouterImage.height * 0.15);
    this.npcSystem.createScouters(50, scouterSprite);
  }

  /**
   * Configura integrazioni sistemi
   */
  private configureSystemIntegrations(): void {
    const playerEntity = this.playerSystem.getPlayerEntity();

    (this.playerControlSystem as any).setPlayerEntity(playerEntity);
    (this.playerControlSystem as any).setCamera(this.movementSystem.getCamera());

    (this.minimapSystem as any).setCamera(this.movementSystem.getCamera());
    (this.minimapSystem as any).setMoveToCallback((x: number, y: number) =>
      (this.playerControlSystem as any).movePlayerTo(x, y));

    (this.economySystem as any).setPlayerEntity(playerEntity);
    (this.rankSystem as any).setPlayerEntity(playerEntity);
    (this.rewardSystem as any).setPlayerEntity(playerEntity);
    (this.boundsSystem as any).setPlayerEntity(playerEntity);
    (this.npcRespawnSystem as any).setPlayerEntity(playerEntity);

    this.setupEconomyCallbacks();
  }

  /**
   * Setup callbacks economici
   */
  private setupEconomyCallbacks(): void {
    (this.economySystem as any).setExperienceChangedCallback(() => this.uiSystem.updatePanels());
    (this.economySystem as any).setCreditsChangedCallback(() => this.uiSystem.updatePanels());
    (this.economySystem as any).setHonorChangedCallback(() => this.uiSystem.updatePanels());
  }


  /**
   * Aggiorna gioco - Delega ai sistemi
   */
  update(deltaTime: number): void {
    this.world.update(deltaTime);
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (playerEntity) {
      this.updatePlayerNicknamePosition();
    }
  }

  /**
   * Renderizza gioco
   */
  render(ctx: CanvasRenderingContext2D): void {
    this.world.render(ctx);
  }

  /**
   * Esce dal gameplay
   */
  exit(): void {
    this.uiSystem.destroy();
  }

  /**
   * Aggiorna posizione nickname
   */
  private updatePlayerNicknamePosition(): void {
    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const transform = this.world.getECS().getComponent(playerEntity, Transform);
    if (!transform) return;

    this.uiSystem.updatePlayerNicknamePosition(
      transform.x, transform.y,
      this.movementSystem.getCamera(),
      this.world.getCanvasSize()
    );
  }

  /**
   * Accesso al mondo per debug
   */
  getWorld(): World {
    return this.world;
  }
}