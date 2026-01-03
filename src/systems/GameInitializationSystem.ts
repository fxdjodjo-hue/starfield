import { System } from '../infrastructure/ecs/System';
import { ECS } from '../infrastructure/ecs/ECS';
import { World } from '../infrastructure/engine/World';
import { MovementSystem } from './physics/MovementSystem';
import { RenderSystem } from './rendering/RenderSystem';
import { InputSystem } from './input/InputSystem';
import { PlayerControlSystem } from './input/PlayerControlSystem';
import { NpcBehaviorSystem } from './ai/NpcBehaviorSystem';
import { NpcSelectionSystem } from './ai/NpcSelectionSystem';
import { CombatSystem } from './combat/CombatSystem';
import { ExplosionSystem } from './combat/ExplosionSystem';
import { DamageTextSystem } from './rendering/DamageTextSystem';
import { ProjectileSystem } from './combat/ProjectileSystem';
import { MinimapSystem } from './rendering/MinimapSystem';
import { LogSystem } from './rendering/LogSystem';
import { EconomySystem } from './EconomySystem';
import { RankSystem } from './RankSystem';
import { RewardSystem } from './RewardSystem';
import { BoundsSystem } from './BoundsSystem';
import { NpcRespawnSystem } from './NpcRespawnSystem';
import { QuestSystem } from './QuestSystem';
import { QuestTrackingSystem } from './QuestTrackingSystem';
import { QuestManager } from './QuestManager';
import { UiSystem } from './UiSystem';
import { PlayerStatusDisplaySystem } from './PlayerStatusDisplaySystem';
import { GameContext } from '../infrastructure/engine/GameContext';
import { ParallaxSystem } from './rendering/ParallaxSystem';
import { Sprite } from '../entities/Sprite';
import { Transform } from '../entities/spatial/Transform';
import { Velocity } from '../entities/spatial/Velocity';
import { Health } from '../entities/combat/Health';
import { Shield } from '../entities/combat/Shield';
import { Damage } from '../entities/combat/Damage';
import { Credits, Cosmos } from '../entities/Currency';
import { Experience } from '../entities/Experience';
import { Honor } from '../entities/Honor';
import { PlayerStats } from '../entities/PlayerStats';
import { SkillPoints } from '../entities/SkillPoints';
import { PlayerUpgrades } from '../entities/PlayerUpgrades';
import { ActiveQuest } from '../entities/quest/ActiveQuest';
import { Npc } from '../entities/ai/Npc';
import { ParallaxLayer } from '../entities/spatial/ParallaxLayer';
import { getNpcDefinition } from '../config/NpcConfig';
import { getPlayerDefinition } from '../config/PlayerConfig';
import { CONFIG } from '../utils/config/Config';

/**
 * Sistema di orchestrazione per l'inizializzazione del gioco
 * Gestisce creazione e configurazione di tutti i sistemi di gioco
 */
export class GameInitializationSystem extends System {
  private world: World;
  private context: GameContext;
  private questManager: QuestManager;
  private questSystem: QuestSystem;
  private uiSystem: UiSystem;
  private movementSystem: MovementSystem;

  constructor(ecs: ECS, world: World, context: GameContext, questManager: QuestManager, questSystem: QuestSystem, uiSystem: UiSystem) {
    super(ecs);
    this.world = world;
    this.context = context;
    this.questManager = questManager;
    this.questSystem = questSystem;
    this.uiSystem = uiSystem;
    // L'economySystem verrà creato in createSystems()
    this.economySystem = null;
  }

  /**
   * Inizializza tutti i sistemi di gioco e restituisce il player entity
   */
  async initialize(): Promise<any> {
    // Crea e configura tutti i sistemi
    const systems = await this.createSystems();

    // Aggiungi sistemi all'ECS nell'ordine corretto
    this.addSystemsToECS(systems);

    // Configura le interazioni tra sistemi
    this.configureSystemInteractions(systems);

    // Crea le entità di gioco e restituisci il player entity
    const playerEntity = await this.createGameEntities(systems);
    return playerEntity;
  }

  /**
   * Crea tutti i sistemi di gioco
   */
  private async createSystems(): Promise<any> {
    // Load assets
    const shipImage = await this.context.assetManager.loadImage('/assets/ships/0/0.png');
    const mapBackgroundImage = await this.context.assetManager.loadImage('/assets/maps/maps1/1/bg.jpg');
    const scouterImage = await this.context.assetManager.loadImage('/assets/npc_ships/scouter/npc_scouter.png');

    // Crea sistemi
    this.movementSystem = new MovementSystem(this.ecs);
    const parallaxSystem = new ParallaxSystem(this.ecs, this.movementSystem);
    const renderSystem = new RenderSystem(this.ecs, this.movementSystem);
    const inputSystem = new InputSystem(this.ecs, this.context.canvas);
    const playerControlSystem = new PlayerControlSystem(this.ecs);
    const npcBehaviorSystem = new NpcBehaviorSystem(this.ecs);
    const npcSelectionSystem = new NpcSelectionSystem(this.ecs);
    const combatSystem = new CombatSystem(this.ecs, this.movementSystem, this.context);
    const explosionSystem = new ExplosionSystem(this.ecs);
    const damageTextSystem = new DamageTextSystem(this.ecs, this.movementSystem, combatSystem);
    const projectileSystem = new ProjectileSystem(this.ecs);
    const minimapSystem = new MinimapSystem(this.ecs, this.context.canvas);
    const logSystem = new LogSystem(this.ecs);
    this.economySystem = new EconomySystem(this.ecs);
    const rankSystem = new RankSystem(this.ecs);
    const rewardSystem = new RewardSystem(this.ecs);
    const boundsSystem = new BoundsSystem(this.ecs, this.movementSystem);
    const respawnSystem = new NpcRespawnSystem(this.ecs, this.context);
    const questTrackingSystem = new QuestTrackingSystem(this.world, this.questManager);
    const playerStatusDisplaySystem = new PlayerStatusDisplaySystem(this.ecs);

    return {
      movementSystem: this.movementSystem,
      parallaxSystem,
      renderSystem,
      inputSystem,
      playerControlSystem,
      npcBehaviorSystem,
      npcSelectionSystem,
      combatSystem,
      explosionSystem,
      damageTextSystem,
      projectileSystem,
      minimapSystem,
      logSystem,
      economySystem: this.economySystem,
      rankSystem,
      rewardSystem,
      boundsSystem,
      respawnSystem,
      questTrackingSystem,
      questSystem: this.questSystem,
      uiSystem: this.uiSystem,
      playerStatusDisplaySystem,
      assets: { shipImage, mapBackgroundImage, scouterImage }
    };
  }

  /**
   * Aggiunge tutti i sistemi all'ECS nell'ordine corretto
   */
  private addSystemsToECS(systems: any): void {
    const { inputSystem, npcSelectionSystem, playerControlSystem, combatSystem,
            explosionSystem, projectileSystem, npcBehaviorSystem, movementSystem,
            parallaxSystem, renderSystem, boundsSystem, minimapSystem,
            damageTextSystem, logSystem, economySystem, rankSystem,
            respawnSystem, rewardSystem, questSystem, uiSystem, playerStatusDisplaySystem } = systems;

    // Ordine importante per l'esecuzione
    this.ecs.addSystem(inputSystem);
    this.ecs.addSystem(npcSelectionSystem);
    this.ecs.addSystem(playerControlSystem);
    this.ecs.addSystem(combatSystem);
    this.ecs.addSystem(explosionSystem);
    this.ecs.addSystem(projectileSystem);
    this.ecs.addSystem(npcBehaviorSystem);
    this.ecs.addSystem(movementSystem);
    this.ecs.addSystem(parallaxSystem);
    this.ecs.addSystem(renderSystem);
    this.ecs.addSystem(boundsSystem);
    this.ecs.addSystem(minimapSystem);
    this.ecs.addSystem(damageTextSystem);
    this.ecs.addSystem(logSystem);
    this.ecs.addSystem(economySystem);
    this.ecs.addSystem(rankSystem);
    this.ecs.addSystem(respawnSystem);
    this.ecs.addSystem(rewardSystem);
    this.ecs.addSystem(questSystem);
    this.ecs.addSystem(uiSystem);
    this.ecs.addSystem(playerStatusDisplaySystem);
  }

  /**
   * Configura le interazioni e dipendenze tra sistemi
   */
  private configureSystemInteractions(systems: any): void {
    const {
      movementSystem, playerControlSystem, minimapSystem, economySystem,
      rankSystem, rewardSystem, combatSystem, logSystem, boundsSystem,
      respawnSystem, questTrackingSystem, inputSystem, npcSelectionSystem
    } = systems;

    // Configura sistemi che richiedono riferimenti ad altri sistemi
    playerControlSystem.setCamera(this.movementSystem.getCamera());
    minimapSystem.setCamera(this.movementSystem.getCamera());
    economySystem.setRankSystem(rankSystem);
    rankSystem.setPlayerEntity(null); // Sarà impostato dopo creazione player
    rewardSystem.setEconomySystem(economySystem);
    rewardSystem.setLogSystem(logSystem);
    combatSystem.setLogSystem(logSystem);
    boundsSystem.setPlayerEntity(null); // Sarà impostato dopo creazione player
    respawnSystem.setPlayerEntity(null); // Sarà impostato dopo creazione player
    rewardSystem.setRespawnSystem(respawnSystem);
    rewardSystem.setQuestTrackingSystem(questTrackingSystem);
    questTrackingSystem.setEconomySystem(economySystem);
    questTrackingSystem.setLogSystem(logSystem);
    questTrackingSystem.setPlayerEntity(null); // Sarà impostato dopo creazione player

    // Configura callbacks per minimappa
    minimapSystem.setMoveToCallback((worldX, worldY) => {
      playerControlSystem.movePlayerTo(worldX, worldY);
    });

    playerControlSystem.setMinimapMovementCompleteCallback(() => {
      minimapSystem.clearDestination();
    });

    // Configura input handlers
    inputSystem.setMouseStateCallback((pressed, x, y) => {
      if (pressed) {
        this.context.canvas.focus();

        // Minimappa ha priorità
        const minimapHandled = minimapSystem.handleMouseDown(x, y);
        if (!minimapHandled) {
          minimapSystem.clearDestination();
          const canvasSize = this.world.getCanvasSize();
          const worldPos = this.movementSystem.getCamera().screenToWorld(x, y, canvasSize.width, canvasSize.height);
          const npcSelected = npcSelectionSystem.handleMouseClick(worldPos.x, worldPos.y);

          if (!npcSelected) {
            playerControlSystem.handleMouseState(pressed, x, y);
          }
        }
      } else {
        minimapSystem.handleMouseUp();
        playerControlSystem.handleMouseState(pressed, x, y);
      }
    });

    inputSystem.setMouseMoveWhilePressedCallback((x, y) => {
      const minimapHandled = minimapSystem.handleMouseMove(x, y);
      if (!minimapHandled) {
        playerControlSystem.handleMouseMoveWhilePressed(x, y);
      }
    });
  }

  /**
   * Crea le entità principali del gioco (player, NPC, map background)
   * Restituisce il player entity creato
   */
  private async createGameEntities(systems: any): Promise<any> {
    const { assets } = systems;

    // Crea la nave player
    const playerShip = this.createPlayerShip(assets.shipImage);
    this.setPlayerEntityInSystems(playerShip, systems);

    // Crea l'entità background della mappa
    this.createMapBackground(assets.mapBackgroundImage);

    // Crea NPC
    this.createScouter(50, assets.scouterImage);

    return playerShip;
  }

  /**
   * Imposta il riferimento al player in tutti i sistemi che ne hanno bisogno
   */
  private setPlayerEntityInSystems(playerEntity: any, systems: any): void {
    const {
      playerControlSystem, economySystem, rankSystem, rewardSystem,
      boundsSystem, respawnSystem, questTrackingSystem, playerStatusDisplaySystem
    } = systems;

    playerControlSystem.setPlayerEntity(playerEntity);
    economySystem.setPlayerEntity(playerEntity);
    rankSystem.setPlayerEntity(playerEntity);
    rewardSystem.setPlayerEntity(playerEntity);
    boundsSystem.setPlayerEntity(playerEntity);
    respawnSystem.setPlayerEntity(playerEntity);
    questTrackingSystem.setPlayerEntity(playerEntity);
    playerStatusDisplaySystem.setPlayerEntity(playerEntity);
  }

  /**
   * Crea la nave player controllabile
   */
  private createPlayerShip(sprite: HTMLImageElement): any {
    const ship = this.ecs.createEntity();
    const playerDef = getPlayerDefinition();

    // Spawna il player al centro del mondo (0,0)
    const worldCenterX = 0;
    const worldCenterY = 0;

    // Aggiungi componenti usando la configurazione
    const transform = new Transform(worldCenterX, worldCenterY, 0);
    const velocity = new Velocity(0, 0, 0);

    // Applica bonus dagli upgrade alle statistiche base
    const hpBonus = playerUpgrades.getHPBonus();
    const shieldBonus = playerUpgrades.getShieldBonus();
    const speedBonus = playerUpgrades.getSpeedBonus();

    const baseHealth = Math.floor(playerDef.stats.health * hpBonus);
    const baseShield = playerDef.stats.shield ? Math.floor(playerDef.stats.shield * shieldBonus) : undefined;
    const baseSpeed = Math.floor(playerDef.stats.speed * speedBonus);

    const health = new Health(baseHealth, baseHealth);
    const damage = new Damage(playerDef.stats.damage, playerDef.stats.range, playerDef.stats.cooldown);

    // Condizionale per scudi (se presenti nella config)
    let shield: Shield | undefined;
    if (baseShield && baseShield > 0) {
      shield = new Shield(baseShield, baseShield);
    }

    const credits = new Credits(playerDef.startingResources.credits);
    const cosmos = new Cosmos(playerDef.startingResources.cosmos);
    const experience = new Experience(playerDef.startingResources.experience, playerDef.startingResources.level);
    const honor = new Honor(playerDef.startingResources.honor);
    const skillPoints = new SkillPoints(playerDef.startingResources.skillPoints, playerDef.startingResources.skillPoints);
    const playerUpgrades = new PlayerUpgrades();
    const playerStats = new PlayerStats(0, 0, 0, 0); // Statistiche iniziali
    const activeQuest = new ActiveQuest(); // Sistema quest
    const shipSprite = new Sprite(sprite, sprite.width * 0.2, sprite.height * 0.2);

    // Aggiungi componenti
    this.ecs.addComponent(ship, Transform, transform);
    this.ecs.addComponent(ship, Velocity, velocity);
    this.ecs.addComponent(ship, Health, health);
    this.ecs.addComponent(ship, Damage, damage);

    // Aggiungi scudi solo se definiti
    if (shield) {
      this.ecs.addComponent(ship, Shield, shield);
    }

    this.ecs.addComponent(ship, Credits, credits);
    this.ecs.addComponent(ship, Cosmos, cosmos);
    this.ecs.addComponent(ship, Experience, experience);
    this.ecs.addComponent(ship, Honor, honor);
    this.ecs.addComponent(ship, PlayerStats, playerStats);
    this.ecs.addComponent(ship, SkillPoints, skillPoints);
    this.ecs.addComponent(ship, PlayerUpgrades, playerUpgrades);
    this.ecs.addComponent(ship, ActiveQuest, activeQuest);
    this.ecs.addComponent(ship, Sprite, shipSprite);

    return ship;
  }

  /**
   * Crea Scouter distribuiti uniformemente su tutta la mappa
   */
  private createScouter(count: number, sprite?: HTMLImageElement): void {
    const minDistance = 100; // Distanza minima tra Scouter
    const minDistanceFromPlayer = 200; // Distanza minima dal player (centro)
    const worldWidth = CONFIG.WORLD_WIDTH;
    const worldHeight = CONFIG.WORLD_HEIGHT;
    const positions: { x: number, y: number }[] = [];

    // Dividi la mappa in una griglia per distribuzione uniforme
    const gridCols = Math.ceil(Math.sqrt(count * worldWidth / worldHeight));
    const gridRows = Math.ceil(count / gridCols);

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let validPosition = false;
      let x = 0, y = 0;

      // Trova una posizione valida distribuita uniformemente
      while (!validPosition && attempts < 100) {
        const gridX = i % gridCols;
        const gridY = Math.floor(i / gridCols);

        const cellWidth = worldWidth / gridCols;
        const cellHeight = worldHeight / gridRows;

        const baseX = gridX * cellWidth + cellWidth / 2 - worldWidth / 2;
        const baseY = gridY * cellHeight + cellHeight / 2 - worldHeight / 2;

        const variationX = (Math.random() - 0.5) * cellWidth * 0.8;
        const variationY = (Math.random() - 0.5) * cellHeight * 0.8;

        x = baseX + variationX;
        y = baseY + variationY;

        // Verifica che non sia troppo vicino al player
        const distanceFromPlayer = Math.sqrt(x * x + y * y);
        if (distanceFromPlayer < minDistanceFromPlayer) {
          attempts++;
          continue;
        }

        // Verifica che non sia troppo vicino ad altri Scouter
        validPosition = positions.every(pos => {
          const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
          return distance >= minDistance;
        });

        attempts++;
      }

      // Fallback: posizione casuale
      if (!validPosition) {
        x = (Math.random() - 0.5) * worldWidth;
        y = (Math.random() - 0.5) * worldHeight;

        const distanceFromPlayer = Math.sqrt(x * x + y * y);
        if (distanceFromPlayer < minDistanceFromPlayer) {
          x = x * (worldWidth / 2 / distanceFromPlayer);
          y = y * (worldWidth / 2 / distanceFromPlayer);
        }
      }

      positions.push({ x, y });

      const streuner = this.ecs.createEntity();
      const npcDef = getNpcDefinition('Scouter');

      if (!npcDef) {
        console.error('NPC definition not found for Scouter');
        continue;
      }

      // Aggiungi componenti allo Scouter
      this.ecs.addComponent(streuner, Transform, new Transform(x, y, 0));
      this.ecs.addComponent(streuner, Velocity, new Velocity(0, 0, 0));
      this.ecs.addComponent(streuner, Health, new Health(npcDef.stats.health, npcDef.stats.health));
      this.ecs.addComponent(streuner, Shield, new Shield(npcDef.stats.shield, npcDef.stats.shield));
      this.ecs.addComponent(streuner, Damage, new Damage(npcDef.stats.damage, npcDef.stats.range, npcDef.stats.cooldown));
      this.ecs.addComponent(streuner, Npc, new Npc(npcDef.type, npcDef.defaultBehavior));

      if (sprite) {
        const scouterSprite = new Sprite(sprite, sprite.width * 0.15, sprite.height * 0.15);
        this.ecs.addComponent(streuner, Sprite, scouterSprite);
      }
    }
  }

  /**
   * Crea l'entità background della mappa come elemento parallax
   */
  private createMapBackground(backgroundImage: HTMLImageElement): any {
    const backgroundEntity = this.ecs.createEntity();

    // Posiziona l'immagine al centro del mondo (0,0)
    const transform = new Transform(0, 0, 0);
    const parallaxLayer = new ParallaxLayer(0.05, 0.05, 0, 0, -1);
    const backgroundSprite = new Sprite(backgroundImage, backgroundImage.width, backgroundImage.height);

    // Aggiungi componenti
    this.ecs.addComponent(backgroundEntity, Transform, transform);
    this.ecs.addComponent(backgroundEntity, Sprite, backgroundSprite);
    this.ecs.addComponent(backgroundEntity, ParallaxLayer, parallaxLayer);

    return backgroundEntity;
  }

  /**
   * Restituisce i sistemi esistenti
   */
  getSystems(): any {
    return {
      questSystem: this.questSystem,
      uiSystem: this.uiSystem,
      questManager: this.questManager,
      economySystem: this.economySystem,
      movementSystem: this.movementSystem
    };
  }

  update(deltaTime: number): void {
    // Questo sistema non ha aggiornamenti periodici
  }
}
