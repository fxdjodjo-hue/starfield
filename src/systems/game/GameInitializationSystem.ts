import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { World } from '../../infrastructure/engine/World';
import { MovementSystem } from '../physics/MovementSystem';
import { RenderSystem } from '../rendering/RenderSystem';
import { InputSystem } from '../input/InputSystem';
import { PlayerControlSystem } from '../input/PlayerControlSystem';
import { NpcSelectionSystem } from '../ai/NpcSelectionSystem';
import { CombatSystem } from '../combat/CombatSystem';
import { ExplosionSystem } from '../combat/ExplosionSystem';
import { DamageTextSystem } from '../rendering/DamageTextSystem';
import { ChatTextSystem } from '../rendering/ChatTextSystem';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { MinimapSystem } from '../rendering/MinimapSystem';
import { LogSystem } from '../rendering/LogSystem';
import { NpcStatsManager } from '../../managers/NpcStatsManager';
import { EconomySystem } from '../economy/EconomySystem';
import { RankSystem } from '../rewards/RankSystem';
import { RewardSystem } from '../rewards/RewardSystem';
import { BoundsSystem } from '../physics/BoundsSystem';
import { QuestSystem } from '../quest/QuestSystem';
import { QuestTrackingSystem } from '../quest/QuestTrackingSystem';
import { QuestManager } from '../quest/QuestManager';
import { UiSystem } from '../ui/UiSystem';
import { PlayerStatusDisplaySystem } from '../player/PlayerStatusDisplaySystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { Authority, AuthorityLevel } from '../../entities/spatial/Authority';
import AudioSystem from '../audio/AudioSystem';
import { AUDIO_CONFIG } from '../../config/AudioConfig';
import { ParallaxSystem } from '../rendering/ParallaxSystem';
import { CameraSystem } from '../rendering/CameraSystem';
import { RemoteNpcSystem } from '../multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../multiplayer/RemoteProjectileSystem';
import { Sprite } from '../../entities/Sprite';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { Npc } from '../../entities/ai/Npc';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { getNpcDefinition } from '../../config/NpcConfig';
import { getPlayerDefinition } from '../../config/PlayerConfig';
import { CONFIG } from '../../utils/config/Config';

/**
 * Sistema di orchestrazione per l'inizializzazione del gioco
 * Gestisce creazione e configurazione di tutti i sistemi di gioco
 */
export class GameInitializationSystem extends System {
  private world: World;
  private context: GameContext;
  private questManager: QuestManager;
  private questSystem: QuestSystem;
  private uiSystem: UiSystem | null;
  private movementSystem!: MovementSystem;
  private economySystem: any;
  private playerSystem!: PlayerSystem;
  private audioSystem!: AudioSystem;
  private playerStatusDisplaySystem!: PlayerStatusDisplaySystem;
  private clientNetworkSystem: any = null; // Sistema di rete per notifiche multiplayer
  private combatSystem: any = null; // Riferimento al sistema di combattimento
  private systemsCache: any = null;
  private npcStatsManager: NpcStatsManager;

  private playState: any = null; // Reference to PlayState for saving

  constructor(ecs: ECS, world: World, context: GameContext, questManager: QuestManager, questSystem: QuestSystem, uiSystem: UiSystem | null, playState?: any) {
    super(ecs);
    this.world = world;
    this.context = context;
    this.questManager = questManager;
    this.questSystem = questSystem;
    this.uiSystem = uiSystem;
    this.playState = playState;
    this.npcStatsManager = NpcStatsManager.getInstance();
    // L'economySystem verrà creato in createSystems()
    this.economySystem = null;
  }

  /**
   * Imposta il sistema di rete per notifiche multiplayer
   */
  setClientNetworkSystem(clientNetworkSystem: any): void {
    this.clientNetworkSystem = clientNetworkSystem;

    // Ora che abbiamo il ClientNetworkSystem, impostalo anche nel CombatSystem
    if (this.combatSystem && typeof this.combatSystem.setClientNetworkSystem === 'function') {
      this.combatSystem.setClientNetworkSystem(this.clientNetworkSystem);
    } else {
      console.warn('[INIT] CombatSystem not available or setClientNetworkSystem method missing');
    }

    // Collega RewardSystem all'EntityDestroyedHandler per processare ricompense da server
    if (clientNetworkSystem && typeof clientNetworkSystem.getEntityDestroyedHandler === 'function') {
      const entityDestroyedHandler = clientNetworkSystem.getEntityDestroyedHandler();
      if (entityDestroyedHandler && this.systemsCache?.rewardSystem) {
        entityDestroyedHandler.setRewardSystem(this.systemsCache.rewardSystem);
        console.log('[INIT] RewardSystem collegato a EntityDestroyedHandler');
      }
    }
  }

  /**
   * Inizializza tutti i sistemi di gioco e restituisce il player entity
   */
  async initialize(): Promise<any> {
    // Crea e configura tutti i sistemi
    this.systemsCache = await this.createSystems();

    // Aggiungi sistemi all'ECS nell'ordine corretto
    this.addSystemsToECS(this.systemsCache);

    // Configura le interazioni tra sistemi
    this.configureSystemInteractions(this.systemsCache);

    // Crea le entità di gioco e restituisci il player entity
    const playerEntity = await this.createGameEntities(this.systemsCache);
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
    const frigateImage = await this.context.assetManager.loadImage('/assets/npc_ships/frigate/npc_frigate.png');

    // Crea sistemi
    this.audioSystem = new AudioSystem(AUDIO_CONFIG);
    const cameraSystem = new CameraSystem(this.ecs);
    this.movementSystem = new MovementSystem(this.ecs, cameraSystem);
    const parallaxSystem = new ParallaxSystem(this.ecs, cameraSystem);
    const inputSystem = new InputSystem(this.ecs, this.context.canvas);
    const playerControlSystem = new PlayerControlSystem(this.ecs);
    const npcSelectionSystem = new NpcSelectionSystem(this.ecs);
    const explosionSystem = new ExplosionSystem(this.ecs);
    const chatTextSystem = new ChatTextSystem(this.ecs, cameraSystem);
    const minimapSystem = new MinimapSystem(this.ecs, this.context.canvas);
    const logSystem = new LogSystem(this.ecs);
    this.economySystem = new EconomySystem(this.ecs);
    const rankSystem = new RankSystem(this.ecs);
    const rewardSystem = new RewardSystem(this.ecs, this.playState);
    const boundsSystem = new BoundsSystem(this.ecs, cameraSystem);
    const questTrackingSystem = new QuestTrackingSystem(this.world, this.questManager, this.playState);
    this.playerStatusDisplaySystem = new PlayerStatusDisplaySystem(this.ecs);
    this.playerSystem = new PlayerSystem(this.ecs);
    const renderSystem = new RenderSystem(this.ecs, cameraSystem, this.playerSystem, this.context.assetManager);
    const combatSystem = new CombatSystem(this.ecs, cameraSystem, this.context, this.playerSystem);
    this.combatSystem = combatSystem; // Salva riferimento per setClientNetworkSystem
    const damageTextSystem = new DamageTextSystem(this.ecs, cameraSystem, combatSystem);
    const projectileSystem = new ProjectileSystem(this.ecs, this.playerSystem, this.uiSystem || undefined);

    // Sistema NPC remoti per multiplayer
    const npcSprites = new Map<string, HTMLImageElement>();
    if (scouterImage) npcSprites.set('scouter', scouterImage);
    if (frigateImage) npcSprites.set('frigate', frigateImage);
    const remoteNpcSystem = new RemoteNpcSystem(this.ecs, npcSprites);

    // Sistema proiettili remoti per multiplayer
    const remoteProjectileSystem = new RemoteProjectileSystem(this.ecs);

    const result = {
      cameraSystem,
      movementSystem: this.movementSystem,
      parallaxSystem,
      renderSystem,
      inputSystem,
      playerControlSystem,
      npcSelectionSystem,
      combatSystem,
      explosionSystem,
      damageTextSystem,
      chatTextSystem,
      projectileSystem,
      minimapSystem,
      logSystem,
      economySystem: this.economySystem,
      rankSystem,
      rewardSystem,
      boundsSystem,
      questTrackingSystem,
      questSystem: this.questSystem,
      uiSystem: this.uiSystem,
      playerStatusDisplaySystem: this.playerStatusDisplaySystem,
      playerSystem: this.playerSystem,
      audioSystem: this.audioSystem,
      remoteNpcSystem,
      remoteProjectileSystem,
      assets: { shipImage, mapBackgroundImage, scouterImage, frigateImage }
    };

    return result;
  }

  /**
   * Aggiunge tutti i sistemi all'ECS nell'ordine corretto
   */
  private addSystemsToECS(systems: any): void {
    const { inputSystem, playerControlSystem, npcSelectionSystem, combatSystem,
            cameraSystem, explosionSystem, projectileSystem, movementSystem,
            parallaxSystem, renderSystem, boundsSystem, minimapSystem,
            damageTextSystem, chatTextSystem, logSystem, economySystem, rankSystem,
            rewardSystem, questSystem, uiSystem, playerStatusDisplaySystem,
            playerSystem, remoteNpcSystem, remoteProjectileSystem } = systems;

    // Ordine importante per l'esecuzione
    this.ecs.addSystem(inputSystem);
    this.ecs.addSystem(npcSelectionSystem);
    this.ecs.addSystem(playerControlSystem);
    this.ecs.addSystem(playerSystem);
    this.ecs.addSystem(combatSystem);
    this.ecs.addSystem(explosionSystem);
    this.ecs.addSystem(projectileSystem);
    this.ecs.addSystem(cameraSystem);
    this.ecs.addSystem(movementSystem);
    this.ecs.addSystem(parallaxSystem);
    this.ecs.addSystem(renderSystem);
    this.ecs.addSystem(boundsSystem);
    this.ecs.addSystem(minimapSystem);
    this.ecs.addSystem(damageTextSystem);
    this.ecs.addSystem(chatTextSystem);
    this.ecs.addSystem(logSystem);
    this.ecs.addSystem(economySystem);
    this.ecs.addSystem(rankSystem);
    this.ecs.addSystem(rewardSystem);
    this.ecs.addSystem(questSystem);
    this.ecs.addSystem(remoteNpcSystem); // Sistema NPC remoti per multiplayer
    this.ecs.addSystem(remoteProjectileSystem); // Sistema proiettili remoti per multiplayer
    this.ecs.addSystem(uiSystem);
    this.ecs.addSystem(playerStatusDisplaySystem);
  }

  /**
   * Configura le interazioni e dipendenze tra sistemi
   */
  private configureSystemInteractions(systems: any): void {
    const {
      movementSystem, playerControlSystem, npcSelectionSystem, minimapSystem, economySystem,
      rankSystem, rewardSystem, combatSystem, logSystem, boundsSystem,
      questTrackingSystem, inputSystem,
      chatTextSystem, uiSystem, cameraSystem
    } = systems;

    // Configura sistemi che richiedono riferimenti ad altri sistemi
    playerControlSystem.setCamera(cameraSystem.getCamera());
    playerControlSystem.setAudioSystem(this.audioSystem);
    minimapSystem.setCamera(cameraSystem.getCamera());

    // Collega AudioSystem ai sistemi di combattimento
    if (combatSystem && typeof combatSystem.setAudioSystem === 'function') {
      combatSystem.setAudioSystem(this.audioSystem);
    }

    // ClientNetworkSystem verrà impostato successivamente tramite setClientNetworkSystem()

    // Collega AudioSystem al sistema bounds
    if (boundsSystem && typeof boundsSystem.setAudioSystem === 'function') {
      boundsSystem.setAudioSystem(this.audioSystem);
    }

    // Collega AudioSystem al sistema UI
    if (uiSystem && typeof uiSystem.setAudioSystem === 'function') {
      uiSystem.setAudioSystem(this.audioSystem);
    }
    economySystem.setRankSystem(rankSystem);
    rankSystem.setPlayerEntity(null); // Sarà impostato dopo creazione player
    rewardSystem.setEconomySystem(economySystem);
    rewardSystem.setLogSystem(logSystem);
    combatSystem.setLogSystem(logSystem);
    boundsSystem.setPlayerEntity(null); // Sarà impostato dopo creazione player
    rewardSystem.setQuestTrackingSystem(questTrackingSystem);
    questTrackingSystem.setEconomySystem(economySystem);
    questTrackingSystem.setLogSystem(logSystem);
    questTrackingSystem.setPlayerEntity(null); // Sarà impostato dopo creazione player

    // Configura callbacks per minimappa
    minimapSystem.setMoveToCallback((worldX: number, worldY: number) => {
      playerControlSystem.movePlayerTo(worldX, worldY);
    });

    playerControlSystem.setMinimapMovementCompleteCallback(() => {
      minimapSystem.clearDestination();
    });

    // Configura input handlers
    inputSystem.setMouseStateCallback((pressed: boolean, x: number, y: number) => {
      if (pressed) {
        this.context.canvas.focus();

        // Minimappa ha priorità
        const minimapHandled = minimapSystem.handleMouseDown(x, y);

        // Controlla se il click è nel pannello glass della minimappa (anche nei bordi)
        const inMinimapGlassPanel = minimapSystem.isClickInGlassPanel(x, y);

        // Controlla se il click è nell'HUD del player status
        const inPlayerStatusHUD = this.playerStatusDisplaySystem.isClickInHUD(x, y);

        if (!minimapHandled && !inMinimapGlassPanel && !inPlayerStatusHUD) {
          // Converti coordinate schermo in coordinate mondo per la selezione NPC
          const worldPos = cameraSystem.getCamera().screenToWorld(x, y, this.context.canvas.width, this.context.canvas.height);

          // Prova prima la selezione NPC
          const npcSelected = npcSelectionSystem.handleMouseClick(worldPos.x, worldPos.y);

          if (!npcSelected) {
            // Se non è stato selezionato un NPC, gestisci movimento player
            minimapSystem.clearDestination();
            playerControlSystem.handleMouseState(pressed, x, y);
          }
        }
      } else {
        minimapSystem.handleMouseUp();
        playerControlSystem.handleMouseState(pressed, x, y);
      }
    });

    inputSystem.setMouseMoveWhilePressedCallback((x: number, y: number) => {
      const minimapHandled = minimapSystem.handleMouseMove(x, y);
      if (!minimapHandled) {
        playerControlSystem.handleMouseMoveWhilePressed(x, y);
      }
    });

    // Configura selezione NPC
    npcSelectionSystem.setOnNpcClickCallback((npcEntity) => {
      // Per ora semplice log, in futuro potremmo aggiungere feedback visivo
      console.log(`🎯 [NPC SELECTION] NPC selezionato: ${npcEntity.id}`);
    });
  }

  /**
   * Crea le entità principali del gioco (player, NPC, map background)
   * Restituisce il player entity creato
   */
  private async createGameEntities(systems: any): Promise<any> {
    const { assets, playerSystem } = systems;

    // Crea il player usando il PlayerSystem
    const worldCenterX = 0;
    const worldCenterY = 0;
    const playerEntity = playerSystem.createPlayer(worldCenterX, worldCenterY);

    // Aggiungi autorità multiplayer al player (client può predire, server corregge)
    const playerAuthority = new Authority(this.context.localClientId, AuthorityLevel.CLIENT_PREDICTIVE);
    this.ecs.addComponent(playerEntity, Authority, playerAuthority);

    // Imposta lo sprite del player
    const sprite = this.ecs.getComponent(playerEntity, Sprite);
    const playerDef = getPlayerDefinition();
    if (sprite) {
      sprite.image = assets.shipImage;
      sprite.width = playerDef.spriteSize.width;
      sprite.height = playerDef.spriteSize.height;
    }

    this.setPlayerEntityInSystems(playerEntity, systems);

    // Crea l'entità background della mappa
    this.createMapBackground(assets.mapBackgroundImage);

    // Nota: Gli NPC ora vengono creati e gestiti dal server
    // Non creiamo più NPC locali per garantire consistenza multiplayer

    return playerEntity;
  }

  /**
   * Imposta il riferimento al player in tutti i sistemi che ne hanno bisogno
   */
  private setPlayerEntityInSystems(playerEntity: any, systems: any): void {
    const {
      playerControlSystem, economySystem, rankSystem, rewardSystem,
      boundsSystem, respawnSystem, questTrackingSystem, playerStatusDisplaySystem,
      playerSystem, uiSystem
    } = systems;

    playerControlSystem.setPlayerEntity(playerEntity);
    economySystem.setPlayerEntity(playerEntity);
    rankSystem.setPlayerEntity(playerEntity);
    rewardSystem.setPlayerEntity(playerEntity);
    boundsSystem.setPlayerEntity(playerEntity);
    questTrackingSystem.setPlayerEntity(playerEntity);
    playerStatusDisplaySystem.setPlayerEntity(playerEntity);

    // Imposta il riferimento al PlayerSystem nel UiSystem (per pannelli che ne hanno bisogno)
    uiSystem.setPlayerSystem(playerSystem);
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
      this.ecs.addComponent(streuner, Health, new Health(this.npcStatsManager.getHealth('Scouter'), this.npcStatsManager.getHealth('Scouter')));
      this.ecs.addComponent(streuner, Shield, new Shield(this.npcStatsManager.getShield('Scouter'), this.npcStatsManager.getShield('Scouter')));
      const scouterStats = this.npcStatsManager.getStats('Scouter')!;
      this.ecs.addComponent(streuner, Damage, new Damage(scouterStats.damage, scouterStats.range, scouterStats.cooldown));
      this.ecs.addComponent(streuner, Npc, new Npc(npcDef.type, npcDef.defaultBehavior));

      if (sprite) {
        const scouterSprite = new Sprite(sprite, sprite.width * 0.15, sprite.height * 0.15);
        this.ecs.addComponent(streuner, Sprite, scouterSprite);
      }
    }
  }

  /**
   * Crea Frigate distribuite uniformemente su tutta la mappa
   */
  private createFrigate(count: number, sprite?: HTMLImageElement): void {
    const minDistance = 150; // Distanza minima tra Frigate (più grandi degli Scouter)
    const minDistanceFromPlayer = 300; // Distanza minima dal player (più lontane)
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

        // Verifica che non sia troppo vicino ad altre Frigate
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
      }

      positions.push({ x, y });

      // Crea l'entità Frigate
      const frigate = this.ecs.createEntity();

      const npcDef = getNpcDefinition('Frigate');

      if (!npcDef) {
        console.error('NPC definition not found for Frigate');
        continue;
      }

      // Aggiungi componenti alla Frigate
      this.ecs.addComponent(frigate, Transform, new Transform(x, y, 0));
      this.ecs.addComponent(frigate, Velocity, new Velocity(0, 0, 0));
      this.ecs.addComponent(frigate, Health, new Health(this.npcStatsManager.getHealth('Frigate'), this.npcStatsManager.getHealth('Frigate')));
      this.ecs.addComponent(frigate, Shield, new Shield(this.npcStatsManager.getShield('Frigate'), this.npcStatsManager.getShield('Frigate')));
      const frigateStats = this.npcStatsManager.getStats('Frigate')!;
      this.ecs.addComponent(frigate, Damage, new Damage(frigateStats.damage, frigateStats.range, frigateStats.cooldown));
      this.ecs.addComponent(frigate, Npc, new Npc(npcDef.type, npcDef.defaultBehavior));

      if (sprite) {
        const frigateSprite = new Sprite(sprite, sprite.width * 0.16, sprite.height * 0.16); // Frigate leggermente più grandi degli Scouter
        this.ecs.addComponent(frigate, Sprite, frigateSprite);
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
    return this.systemsCache || {
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
