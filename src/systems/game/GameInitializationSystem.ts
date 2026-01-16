// GameInitializationSystem - Orchestratore inizializzazione gioco
// Responsabilità: Coordinamento moduli specializzati per inizializzazione
// Dipendenze: SystemFactory, SystemConfigurator, EntityFactory

import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { World } from '../../infrastructure/engine/World';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { QuestManager } from '../quest/QuestManager';
import { QuestSystem } from '../quest/QuestSystem';
import { UiSystem } from '../ui/UiSystem';
import { MovementSystem } from '../physics/MovementSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import AudioSystem from '../audio/AudioSystem';
import { PlayerStatusDisplaySystem } from '../player/PlayerStatusDisplaySystem';
import { DamageSystem } from '../combat/DamageSystem';
import { ProjectileCreationSystem } from '../combat/ProjectileCreationSystem';
import { CombatStateSystem } from '../combat/CombatStateSystem';
import { SystemFactory } from './SystemFactory';
import type { CreatedSystems } from './SystemFactory';
import { SystemConfigurator } from './SystemConfigurator';
import { EntityFactory } from './EntityFactory';

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
  private clientNetworkSystem: any = null;
  private damageSystem: DamageSystem | null = null;
  private projectileCreationSystem: ProjectileCreationSystem | null = null;
  private combatStateSystem: CombatStateSystem | null = null;
  private minimapSystem: any = null;
  private systemsCache: CreatedSystems | null = null;
  private playState: any = null;

  constructor(
    ecs: ECS,
    world: World,
    context: GameContext,
    questManager: QuestManager,
    questSystem: QuestSystem,
    uiSystem: UiSystem | null,
    playState?: any
  ) {
    super(ecs);
    this.world = world;
    this.context = context;
    this.questManager = questManager;
    this.questSystem = questSystem;
    this.uiSystem = uiSystem;
    this.playState = playState;
    this.economySystem = null;
  }

  /**
   * Imposta il sistema di rete per notifiche multiplayer
   */
  setClientNetworkSystem(clientNetworkSystem: any): void {
    this.clientNetworkSystem = clientNetworkSystem;

    // Configura ClientNetworkSystem nei sistemi se già creati
    if (this.systemsCache) {
      SystemConfigurator.configureClientNetworkSystem(
        this.ecs,
        clientNetworkSystem,
        this.systemsCache,
        this.systemsCache
      );
    }
  }

  /**
   * Inizializza tutti i sistemi di gioco e restituisce il player entity
   */
  async initialize(): Promise<any> {
    // Crea tutti i sistemi
    this.systemsCache = await SystemFactory.createSystems({
      ecs: this.ecs,
      context: this.context,
      world: this.world,
      questManager: this.questManager,
      questSystem: this.questSystem,
      uiSystem: this.uiSystem,
      playState: this.playState,
      clientNetworkSystem: this.clientNetworkSystem
    });

    // Salva riferimenti per backward compatibility
    this.movementSystem = this.systemsCache.movementSystem;
    this.economySystem = this.systemsCache.economySystem;
    this.playerSystem = this.systemsCache.playerSystem;
    this.audioSystem = this.systemsCache.audioSystem;
    this.playerStatusDisplaySystem = this.systemsCache.playerStatusDisplaySystem;
    this.damageSystem = this.systemsCache.damageSystem;
    this.projectileCreationSystem = this.systemsCache.projectileCreationSystem;
    this.combatStateSystem = this.systemsCache.combatStateSystem;
    this.minimapSystem = this.systemsCache.minimapSystem;

    // Aggiungi sistemi all'ECS nell'ordine corretto
    SystemConfigurator.addSystemsToECS(this.ecs, this.systemsCache);

    // Configura le interazioni tra sistemi
    SystemConfigurator.configureSystemInteractions({
      ecs: this.ecs,
      context: this.context,
      systems: this.systemsCache,
      playerStatusDisplaySystem: this.playerStatusDisplaySystem
    });

    // Crea le entità di gioco e restituisci il player entity
    const playerEntity = await EntityFactory.createGameEntities({
      ecs: this.ecs,
      context: this.context,
      systems: this.systemsCache
    });

    // Imposta il player entity in tutti i sistemi che ne hanno bisogno
    EntityFactory.setPlayerEntityInSystems(playerEntity, this.systemsCache);

    return playerEntity;
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
      movementSystem: this.movementSystem,
      damageSystem: this.damageSystem,
      projectileCreationSystem: this.projectileCreationSystem,
      combatStateSystem: this.combatStateSystem,
      playerStatusDisplaySystem: this.playerStatusDisplaySystem
    };
  }

  update(deltaTime: number): void {
    // Questo sistema non ha aggiornamenti periodici
  }
}
