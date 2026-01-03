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
import { QuestManager } from '/src/systems/QuestManager';
import { QuestTrackingSystem } from '/src/systems/QuestTrackingSystem';
import { QuestSystem } from '/src/systems/QuestSystem';
import { GameInitializationSystem } from '/src/systems/GameInitializationSystem';
import { BoundsSystem } from '/src/systems/BoundsSystem';
import { NpcRespawnSystem } from '/src/systems/NpcRespawnSystem';
import { PlayerHUD } from '/src/presentation/ui/PlayerHUD';
import type { PlayerHUDData } from '/src/presentation/ui/PlayerHUD';
import { UiSystem } from '/src/systems/UiSystem';
import { Transform } from '/src/entities/spatial/Transform';
import { Velocity } from '/src/entities/spatial/Velocity';
import { Npc } from '/src/entities/ai/Npc';
import { SelectedNpc } from '/src/entities/combat/SelectedNpc';
import { Health } from '/src/entities/combat/Health';
import { Shield } from '/src/entities/combat/Shield';
import { Damage } from '/src/entities/combat/Damage';
import { Credits, Cosmos } from '/src/entities/Currency';
import { Experience } from '/src/entities/Experience';
import { Sprite } from '/src/entities/Sprite';
import { Honor } from '/src/entities/Honor';
import { PlayerStats } from '/src/entities/PlayerStats';
import { ActiveQuest } from '/src/entities/quest/ActiveQuest';
import { ParallaxLayer } from '/src/entities/spatial/ParallaxLayer';
import { CONFIG } from '/src/utils/config/Config';
import { getNpcDefinition } from '/src/config/NpcConfig';

/**
 * Stato del gameplay attivo
 * Gestisce il mondo di gioco, ECS e tutti i sistemi di gameplay
 */
export class PlayState extends GameState {
  private world: World;
  private uiSystem: UiSystem;
  private gameInitSystem: GameInitializationSystem;
  private startTime: number = Date.now();
  private context: GameContext;
  private playerEntity: any = null;
  private economySystem: any = null;
  private logSystem: LogSystem | null = null;
  private questSystem: QuestSystem | null = null;
  private questTrackingSystem: QuestTrackingSystem | null = null;
  private questManager: QuestManager | null = null;
  private movementSystem: MovementSystem | null = null;
  private playerNicknameElement: HTMLElement | null = null;
  private nicknameCreated: boolean = false;

  constructor(context: GameContext) {
    super();
    this.context = context;
    // Crea il mondo di gioco
    this.world = new World(context.canvas);

    // Inizializza sistemi UI e Quest per operazioni immediate
    this.questManager = new QuestManager();
    this.questSystem = new QuestSystem(this.world.getECS(), this.questManager);
    // UiSystem riceverà l'EconomySystem dopo l'inizializzazione
    this.uiSystem = new UiSystem(this.world.getECS(), this.questSystem);

    // Crea sistema di inizializzazione
    this.gameInitSystem = new GameInitializationSystem(this.world.getECS(), this.world, this.context, this.questManager, this.questSystem, this.uiSystem);
  }

  /**
   * Avvia il gameplay
   */
  async enter(context: GameContext): Promise<void> {
    // Nasconde il titolo principale
    this.uiSystem.hideMainTitle();

    try {
      // Inizializza il mondo e crea il giocatore PRIMA di mostrare l'HUD
      await this.initializeGame();
    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }

    // Inizializza il sistema UI dopo che tutti i sistemi sono stati creati
    this.uiSystem.initialize();

    // Mostra info del giocatore DOPO l'inizializzazione dei sistemi
    this.uiSystem.showPlayerInfo();

    // Il nickname verrà creato al primo update quando tutti i sistemi sono pronti

    // HUD toggle gestito da UiSystem

    // I listener per i pannelli sono ora gestiti da UiSystem e QuestSystem
  }




  /**
   * Aggiorna il gameplay
   */
  update(deltaTime: number): void {
    // Aggiorna il mondo di gioco
    this.world.update(deltaTime);

    // Aggiorna le informazioni del player (HP)
    this.uiSystem.showPlayerInfo();

    // Aggiorna posizione del nickname
    this.updateNicknamePosition();
  }

  /**
   * Renderizza il gioco
   */
  render(ctx: CanvasRenderingContext2D): void {
    // Renderizza il mondo di gioco
    this.world.render();
  }

  /**
   * Gestisce input di gioco
   */
  handleInput(event: Event): void {
    // Gli input sono gestiti dai sistemi ECS (InputSystem)
    // Questo metodo Ã¨ disponibile per input speciali se necessario
  }

  /**
   * Termina il gameplay
   */
  exit(): void {
    // Cleanup completo dell'HUD
    this.uiSystem.destroy();

    // Rimuovi elemento nickname (delegato all'UiSystem)

    this.uiSystem.showMainTitle();
    // Qui potremmo salvare lo stato di gioco, cleanup, etc.
  }

  /**
   * Crea l'elemento HTML per mostrare le info del giocatore
   */

  /**
   * Mostra le info del giocatore
   */








  /**
   * Crea l'elemento nickname delegando all'UiSystem
   */
  private createPlayerNicknameElement(): void {
    const nickname = this.context.playerNickname || 'Commander';
    const rank = this.getPlayerRank();
    this.uiSystem.createPlayerNicknameElement(`${nickname}\n[${rank}]`);
  }


  /**
   * Ottiene il rank corrente del player
   */
  private getPlayerRank(): string {
    if (!this.economySystem) return 'Recruit';

    // Ottieni il componente Honor del player per il rank
    const honor = this.economySystem.getPlayerHonor?.();
    if (honor && typeof honor.getRank === 'function') {
      return honor.getRank();
    }

    return 'Recruit';
  }



  /**
   * Inizializza il mondo di gioco e crea entitÃ 
   */
  private async initializeGame(): Promise<void> {
    // Delega l'inizializzazione al GameInitializationSystem e ottieni il player entity
    this.playerEntity = await this.gameInitSystem.initialize();

    // Ottieni riferimenti ai sistemi creati
    const systems = this.gameInitSystem.getSystems();
    this.questSystem = systems.questSystem;
    this.uiSystem = systems.uiSystem;
    this.questManager = systems.questManager;
    this.movementSystem = systems.movementSystem;

    // Collega l'EconomySystem all'UiSystem
    if (systems.economySystem) {
      this.uiSystem.setEconomySystem(systems.economySystem);
    }
  }

  /**
   * Aggiorna la posizione del nickname delegando all'UiSystem
   */
  private updateNicknamePosition(): void {
    if (!this.playerEntity) return;

    // Ottieni le coordinate del player
    const transform = this.world.getECS().getComponent(this.playerEntity, Transform);
    if (!transform) return;

    // Usa il MovementSystem referenziato
    if (!this.movementSystem) return;

    // Crea il nickname se non è ancora stato creato (solo una volta)
    if (!this.nicknameCreated) {
      console.log('DEBUG: Creating nickname element now that systems are ready');
      const nickname = this.context.playerNickname || 'Commander';
      const rank = this.getPlayerRank();
      this.uiSystem.createPlayerNicknameElement(`${nickname}\n[${rank}]`);
      this.nicknameCreated = true; // Flag per evitare ricreazione
    }

    const camera = this.movementSystem.getCamera();
    const canvasSize = this.world.getCanvasSize();

    console.log(`DEBUG: Player position: (${transform.x}, ${transform.y}), Camera: (${camera.x}, ${camera.y})`);

    // Delega all'UiSystem
    this.uiSystem.updatePlayerNicknamePosition(transform.x, transform.y, camera, canvasSize);
  }


  /**
   * Restituisce il mondo di gioco per accesso esterno
   */
  getWorld(): World {
    return this.world;
  }
}
