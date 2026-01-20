// SystemFactory - Creazione di tutti i sistemi di gioco
// Responsabilità: Istanziare tutti i sistemi, caricare assets
// Dipendenze: ECS, GameContext, World, QuestManager, QuestSystem, UiSystem, PlayState, ClientNetworkSystem

import { ECS } from '../../infrastructure/ecs/ECS';
import { World } from '../../infrastructure/engine/World';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { QuestManager } from '../../core/domain/quest/QuestManager';
import { QuestSystem } from '../quest/QuestSystem';
import { UiSystem } from '../ui/UiSystem';
import { AtlasParser } from '../../core/utils/AtlasParser';
import { getNpcDefinition } from '../../config/NpcConfig';
import { MovementSystem } from '../physics/MovementSystem';
import { RenderSystem } from '../rendering/RenderSystem';
import { InputSystem } from '../input/InputSystem';
import { PlayerControlSystem } from '../input/PlayerControlSystem';
import { NpcSelectionSystem } from '../ai/NpcSelectionSystem';
import { NpcMovementSystem } from '../ai/NpcMovementSystem';
import { NpcBehaviorSystem } from '../ai/NpcBehaviorSystem';
import { DamageSystem } from '../combat/DamageSystem';
import { ProjectileCreationSystem } from '../combat/ProjectileCreationSystem';
import { CombatStateSystem } from '../combat/CombatStateSystem';
import { ExplosionSystem } from '../combat/ExplosionSystem';
import { DamageTextSystem } from '../rendering/DamageTextSystem';
import { ChatTextSystem } from '../rendering/ChatTextSystem';
import { ProjectileSystem } from '../combat/ProjectileSystem';
import { MinimapSystem } from '../rendering/MinimapSystem';
import { LogSystem } from '../rendering/LogSystem';
import { EconomySystem } from '../economy/EconomySystem';
import { RankSystem } from '../../core/domain/rewards/RankSystem';
import { RewardSystem } from '../rewards/RewardSystem';
import { BoundsSystem } from '../physics/BoundsSystem';
import { QuestTrackingSystem } from '../quest/QuestTrackingSystem';
import { PlayerStatusDisplaySystem } from '../player/PlayerStatusDisplaySystem';
import { PlayerSystem } from '../player/PlayerSystem';
import AudioSystem from '../audio/AudioSystem';
import { PortalSystem } from './PortalSystem';
import { AUDIO_CONFIG } from '../../config/AudioConfig';
import { ParallaxSystem } from '../rendering/ParallaxSystem';
import { CameraSystem } from '../rendering/CameraSystem';
import { RemoteNpcSystem } from '../multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../multiplayer/RemoteProjectileSystem';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { Sprite } from '../../entities/Sprite';

export interface SystemFactoryDependencies {
  ecs: ECS;
  context: GameContext;
  world: World;
  questManager: QuestManager;
  questSystem: QuestSystem;
  uiSystem: UiSystem | null;
  playState?: any;
  clientNetworkSystem?: any;
}

export interface CreatedSystems {
  cameraSystem: CameraSystem;
  movementSystem: MovementSystem;
  parallaxSystem: ParallaxSystem;
  renderSystem: RenderSystem;
  inputSystem: InputSystem;
  playerControlSystem: PlayerControlSystem;
  npcSelectionSystem: NpcSelectionSystem;
  npcMovementSystem: NpcMovementSystem;
  npcBehaviorSystem: NpcBehaviorSystem;
  damageSystem: DamageSystem;
  projectileCreationSystem: ProjectileCreationSystem;
  combatStateSystem: CombatStateSystem;
  explosionSystem: ExplosionSystem;
  repairEffectSystem: any;
  damageTextSystem: DamageTextSystem;
  chatTextSystem: ChatTextSystem;
  projectileSystem: ProjectileSystem;
  minimapSystem: MinimapSystem;
  logSystem: LogSystem;
  economySystem: EconomySystem;
  rankSystem: RankSystem;
  rewardSystem: RewardSystem;
  boundsSystem: BoundsSystem;
  questTrackingSystem: QuestTrackingSystem;
  questSystem: QuestSystem;
  uiSystem: UiSystem | null;
  playerStatusDisplaySystem: PlayerStatusDisplaySystem;
  playerSystem: PlayerSystem;
  audioSystem: AudioSystem;
  portalSystem: PortalSystem;
  clientNetworkSystem?: any;
  remoteNpcSystem: RemoteNpcSystem;
  remoteProjectileSystem: RemoteProjectileSystem;
  assets: {
    playerSprite: AnimatedSprite;
    scouterAnimatedSprite: AnimatedSprite;
    kronosAnimatedSprite: AnimatedSprite;
    guardAnimatedSprite: AnimatedSprite;
    pyramidAnimatedSprite: AnimatedSprite;
    teleportAnimatedSprite: AnimatedSprite;
    engflamesAnimatedSprite: AnimatedSprite;
    spaceStationSprite: Sprite;
  };
}

export class SystemFactory {
  /**
   * Crea tutti i sistemi di gioco
   */
  static async createSystems(deps: SystemFactoryDependencies): Promise<CreatedSystems> {
    const { ecs, context, world, questManager, questSystem, uiSystem, playState, clientNetworkSystem } = deps;

    // Load assets - use spritesheet for player ship
    const playerSprite = await context.assetManager.createAnimatedSprite('/assets/ships/ship106/ship106', 0.8);
    
    // Carica sprite NPC usando scala dal config (single source of truth)
    const scouterDef = getNpcDefinition('Scouter');
    const kronosDef = getNpcDefinition('Kronos');
    const guardDef = getNpcDefinition('Guard');
    const pyramidDef = getNpcDefinition('Pyramid');
    const scouterAnimatedSprite = await context.assetManager.createAnimatedSprite('/assets/npc_ships/scouter/alien120', scouterDef?.spriteScale || 0.8);
    const kronosAnimatedSprite = await context.assetManager.createAnimatedSprite('/assets/npc_ships/kronos/alien90', kronosDef?.spriteScale || 0.16);
    const guardAnimatedSprite = await context.assetManager.createAnimatedSprite('/assets/npc_ships/guard/alien60', guardDef?.spriteScale || 0.8);
    const pyramidAnimatedSprite = await context.assetManager.createAnimatedSprite('/assets/npc_ships/pyramid/alien90', pyramidDef?.spriteScale || 1.5);
    const teleportAnimatedSprite = await context.assetManager.createAnimatedSprite('/assets/teleport/teleport', 1.0);
    console.log(`[DEBUG_FLAMES] Creating engflames AnimatedSprite...`);
    const engflamesAnimatedSprite = await context.assetManager.createAnimatedSprite('/assets/engflames/engflames', 0.5);
    console.log(`[DEBUG_FLAMES] engflames AnimatedSprite created:`, engflamesAnimatedSprite ? 'SUCCESS' : 'FAILED');
    const spaceStationSprite = await context.assetManager.createSprite('/assets/spacestation/spacestation.png');

    // Crea sistemi
    const audioSystem = new AudioSystem(ecs, AUDIO_CONFIG);
    const cameraSystem = new CameraSystem(ecs);
    const movementSystem = new MovementSystem(ecs, cameraSystem);
    const parallaxSystem = new ParallaxSystem(ecs, cameraSystem);
    const inputSystem = new InputSystem(ecs, context.canvas);
    const playerControlSystem = new PlayerControlSystem(ecs);
    const npcSelectionSystem = new NpcSelectionSystem(ecs);
    const npcMovementSystem = new NpcMovementSystem(ecs);
    const npcBehaviorSystem = new NpcBehaviorSystem(ecs, npcMovementSystem);
    const explosionSystem = new ExplosionSystem(ecs);
    const { RepairEffectSystem } = await import('../../systems/combat/RepairEffectSystem');
    const repairEffectSystem = new RepairEffectSystem(ecs);
    const chatTextSystem = new ChatTextSystem(ecs, cameraSystem);
    const minimapSystem = new MinimapSystem(ecs, context.canvas);
    const logSystem = new LogSystem(ecs);
    const economySystem = new EconomySystem(ecs);
    const rankSystem = new RankSystem(ecs);
    const rewardSystem = new RewardSystem(ecs, playState);
    const boundsSystem = new BoundsSystem(ecs, cameraSystem);
    const questTrackingSystem = new QuestTrackingSystem(world, questManager, playState);
    const playerStatusDisplaySystem = new PlayerStatusDisplaySystem(ecs);
    const playerSystem = new PlayerSystem(ecs);
    const portalSystem = new PortalSystem(ecs, playerSystem);
    const renderSystem = new RenderSystem(ecs, cameraSystem, playerSystem, context.assetManager);

    // Ensure assetManager is set on renderSystem if not provided in constructor
    if (context.assetManager && (!renderSystem as any).assetManager) {
      (renderSystem as any).setAssetManager(context.assetManager);
    }

    renderSystem.setEngflamesSprite(engflamesAnimatedSprite);
    
    // Sistemi di combattimento modulari
    const damageSystem = new DamageSystem(ecs);
    const projectileCreationSystem = new ProjectileCreationSystem(ecs);
    const combatStateSystem = new CombatStateSystem(ecs);

    // Carica explosion frames
    let explosionFrames: any[] = [];
    try {
      const explosionAtlasData = await AtlasParser.parseAtlas('/assets/explosions/explosions_npc/explosion.atlas');
      explosionFrames = await AtlasParser.extractFrames(explosionAtlasData);

      // Explosion frames sono gestiti dal ClientNetworkSystem per sincronizzazione
      if (clientNetworkSystem && typeof clientNetworkSystem.setPreloadedExplosionFrames === 'function') {
        clientNetworkSystem.setPreloadedExplosionFrames(explosionFrames);
      }
    } catch (error) {
      // Error loading explosion frames - continue without them
    }

    const damageTextSystem = new DamageTextSystem(ecs, cameraSystem, damageSystem);
    
    // Collega il DamageTextSystem al RenderSystem per il rendering
    if (renderSystem && typeof renderSystem.setDamageTextSystem === 'function') {
      renderSystem.setDamageTextSystem(damageTextSystem);
    }
    
    // Collega l'AudioSystem al PortalSystem
    portalSystem.setAudioSystem(audioSystem);

    const projectileSystem = new ProjectileSystem(ecs, playerSystem, uiSystem || undefined);

    // Sistema NPC remoti per multiplayer
    const npcSprites = new Map<string, HTMLImageElement>();
    const remoteNpcSystem = new RemoteNpcSystem(ecs, npcSprites, context.assetManager);
    
    // Registra AnimatedSprite per Scouter, Kronos, Guard e Pyramid
    if (scouterAnimatedSprite) {
      remoteNpcSystem.registerNpcAnimatedSprite('Scouter', scouterAnimatedSprite);
    }
    if (kronosAnimatedSprite) {
      remoteNpcSystem.registerNpcAnimatedSprite('Kronos', kronosAnimatedSprite);
    }
    if (guardAnimatedSprite) {
      remoteNpcSystem.registerNpcAnimatedSprite('Guard', guardAnimatedSprite);
    }
    if (pyramidAnimatedSprite) {
      remoteNpcSystem.registerNpcAnimatedSprite('Pyramid', pyramidAnimatedSprite);
    }

    // Sistema proiettili remoti per multiplayer
    const remoteProjectileSystem = new RemoteProjectileSystem(ecs);

    // Collega sistemi ai sistemi di combattimento modulari
    if (combatStateSystem) {
      combatStateSystem.setPlayerControlSystem(playerControlSystem);
      combatStateSystem.setCameraSystem(cameraSystem);
      combatStateSystem.setPlayerSystem(playerSystem);
      combatStateSystem.setLogSystem(logSystem);
      combatStateSystem.setDamageSystem(damageSystem);
      combatStateSystem.setAssetManager(context.assetManager);
    }

    if (projectileCreationSystem) {
      projectileCreationSystem.setPlayerSystem(playerSystem);
      projectileCreationSystem.setAudioSystem(audioSystem);
    }

    // Collega ClientNetworkSystem ai sistemi che ne hanno bisogno
    if (clientNetworkSystem) {
      if (combatStateSystem) {
        combatStateSystem.setClientNetworkSystem(clientNetworkSystem);
      }
      if (projectileCreationSystem) {
        projectileCreationSystem.setClientNetworkSystem(clientNetworkSystem);
      }
    }

    return {
      cameraSystem,
      movementSystem,
      parallaxSystem,
      renderSystem,
      inputSystem,
      playerControlSystem,
      npcSelectionSystem,
      npcMovementSystem,
      npcBehaviorSystem,
      damageSystem,
      projectileCreationSystem,
      combatStateSystem,
      explosionSystem,
      repairEffectSystem,
      damageTextSystem,
      chatTextSystem,
      projectileSystem,
      minimapSystem,
      logSystem,
      economySystem,
      rankSystem,
      rewardSystem,
      boundsSystem,
      questTrackingSystem,
      questSystem,
      uiSystem,
      playerStatusDisplaySystem,
      playerSystem,
      audioSystem,
      portalSystem,
      clientNetworkSystem,
      remoteNpcSystem,
      remoteProjectileSystem,
      assets: {
        playerSprite,
        scouterAnimatedSprite,
        kronosAnimatedSprite,
        guardAnimatedSprite,
        pyramidAnimatedSprite,
        teleportAnimatedSprite,
        engflamesAnimatedSprite,
        spaceStationSprite
      }
    };
  }
}
