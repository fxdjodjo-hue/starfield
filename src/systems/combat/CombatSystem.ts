import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { CameraSystem } from '../rendering/CameraSystem';
import { LogSystem } from '../rendering/LogSystem';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { PlayerSystem } from '../player/PlayerSystem';
import { PlayerControlSystem } from '../input/PlayerControlSystem';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import AudioSystem from '../audio/AudioSystem';

// Modular architecture managers
import { CombatStateManager } from './managers/CombatStateManager';
import { CombatProjectileManager } from './managers/CombatProjectileManager';
import { CombatDamageManager } from './managers/CombatDamageManager';
import { CombatExplosionManager } from './managers/CombatExplosionManager';
import { MissileManager } from './managers/MissileManager';

/**
 * Sistema di combattimento - gestisce gli scontri tra entità
 * Gestisce attacchi, danni e logica di combattimento
 */
export class CombatSystem extends BaseSystem {
  private cameraSystem: CameraSystem;
  private playerControlSystem: PlayerControlSystem | null = null;
  private logSystem: LogSystem | null = null;
  private gameContext: GameContext;
  private playerSystem: PlayerSystem;
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private audioSystem: AudioSystem | null = null;
  private explosionFrames: HTMLImageElement[] | null = null;

  // Modular architecture managers (lazy initialization)
  private stateManager!: CombatStateManager;
  private projectileManager!: CombatProjectileManager;
  private missileManager!: MissileManager;
  private damageManager!: CombatDamageManager;
  private explosionManager!: CombatExplosionManager;
  private managersInitialized: boolean = false;

  constructor(ecs: ECS, cameraSystem: CameraSystem, gameContext: GameContext, playerSystem: PlayerSystem, clientNetworkSystem: ClientNetworkSystem | null = null) {
    super(ecs);
    this.cameraSystem = cameraSystem;
    this.gameContext = gameContext;
    this.playerSystem = playerSystem;
    this.clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Initializes managers with dependency injection
   */
  private initializeManagers(): void {
    if (this.managersInitialized) return;

    // Initialize damage manager first (simplest, no dependencies on other managers)
    this.damageManager = new CombatDamageManager(this.ecs, this.playerSystem);

    // Initialize explosion manager
    this.explosionManager = new CombatExplosionManager(
      this.ecs,
      () => this.clientNetworkSystem,
      () => this.explosionFrames,
      (frames) => { this.explosionFrames = frames; }
    );

    // Initialize projectile manager
    this.projectileManager = new CombatProjectileManager(
      this.ecs,
      this.playerSystem,
      () => this.clientNetworkSystem
    );

    // Initialize missile manager
    this.missileManager = new MissileManager(
      this.ecs,
      this.playerSystem,
      () => this.clientNetworkSystem
    );

    // Initialize state manager (most complex, depends on other systems)
    this.stateManager = new CombatStateManager(
      this.ecs,
      this.playerSystem,
      this.cameraSystem,
      this.gameContext,
      () => this.playerControlSystem,
      () => this.clientNetworkSystem,
      () => this.logSystem
    );

    this.managersInitialized = true;
  }

  /**
   * Imposta il sistema di rete per notifiche multiplayer
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Imposta il sistema audio per i suoni di combattimento
   */
  setAudioSystem(audioSystem: AudioSystem): void {
    this.audioSystem = audioSystem;
  }

  /**
   * Imposta il riferimento al sistema di controllo del player
   */
  setPlayerControlSystem(playerControlSystem: PlayerControlSystem): void {
    this.playerControlSystem = playerControlSystem;
  }

  /**
   * Imposta i frame dell'esplosione precaricati per evitare lag
   */
  setPreloadedExplosionFrames(frames: HTMLImageElement[]): void {
    this.explosionFrames = frames;
    this.initializeManagers();
    this.explosionManager.setPreloadedExplosionFrames(frames);
  }


  update(deltaTime: number): void {
    this.initializeManagers();

    // Rimuovi tutte le entità morte
    this.explosionManager.removeDeadEntities();

    // Combattimento automatico per NPC selezionati
    this.stateManager.processPlayerCombat();
  }


  /**
   * Crea un testo di danno (chiamato dal ProjectileSystem quando applica danno)
   */
  createDamageText(targetEntity: Entity, damage: number, isShieldDamage: boolean = false, isBoundsDamage: boolean = false, projectileType?: 'laser' | 'missile' | 'npc_laser'): void {
    this.initializeManagers();
    this.damageManager.createDamageText(targetEntity, damage, isShieldDamage, isBoundsDamage, projectileType);
  }

  /**
   * Decrementa il contatore dei testi di danno attivi per un'entità
   */
  public decrementDamageTextCount(targetEntityId: number, projectileType?: 'laser' | 'missile' | 'npc_laser'): void {
    this.initializeManagers();
    this.damageManager.decrementDamageTextCount(targetEntityId, projectileType);
  }

  /**
   * Cleanup delle risorse per prevenire memory leaks
   * Implementa l'interfaccia System.destroy()
   */
  public destroy(): void {
    if (this.managersInitialized) {
      this.damageManager.clear();
      this.explosionManager.clear();
      this.stateManager.reset();
    }

    // Reset dei riferimenti
    this.playerControlSystem = null;
    this.logSystem = null;
    this.clientNetworkSystem = null;
    this.audioSystem = null;
  }

  /**
   * Ferma immediatamente il combattimento (chiamato quando disattivi manualmente l'attacco)
   */
  public stopCombatImmediately(): void {
    this.initializeManagers();
    
    // Disattiva anche l'attacco nel PlayerControlSystem PRIMA di tutto
    const playerControlSystem = this.ecs.getSystems().find((system) =>
      system instanceof PlayerControlSystem
    ) as PlayerControlSystem | undefined;

    if (playerControlSystem) {
      playerControlSystem.deactivateAttack();
    }

    this.stateManager.stopCombatImmediately(() => {
      // Callback per deactivateAttack (già fatto sopra)
    });

    // 🚀 FIX: Invia messaggio stop_combat al server quando il player smette di attaccare
    this.stateManager.sendStopCombat();
  }

}
