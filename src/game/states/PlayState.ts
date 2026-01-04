import { GameState } from './GameState';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { World } from '../../infrastructure/engine/World';
import { MovementSystem } from '../../systems/physics/MovementSystem';
import { QuestManager } from '../../systems/quest/QuestManager';
import { QuestSystem } from '../../systems/quest/QuestSystem';
import { GameInitializationSystem } from '../../systems/game/GameInitializationSystem';
import { UiSystem } from '../../systems/ui/UiSystem';
import { Transform } from '../../entities/spatial/Transform';
import AudioSystem from '../../systems/audio/AudioSystem';

/**
 * Stato del gameplay attivo
 * Gestisce il mondo di gioco, ECS e tutti i sistemi di gameplay
 */
export class PlayState extends GameState {
  private world: World;
  private uiSystem: UiSystem;
  private gameInitSystem: GameInitializationSystem;
  private context: GameContext;
  private playerEntity: any = null;
  private economySystem: any = null;
  private questSystem: QuestSystem | null = null;
  private questManager: QuestManager | null = null;
  private movementSystem: MovementSystem | null = null;
  private audioSystem: AudioSystem | null = null;
  private nicknameCreated: boolean = false;

  constructor(context: GameContext) {
    super();
    this.context = context;
    // Crea il mondo di gioco
    this.world = new World(context.canvas);

    // Inizializza sistemi UI e Quest per operazioni immediate
    this.questManager = new QuestManager();
    this.questSystem = new QuestSystem(this.world.getECS(), this.questManager);
    // UiSystem riceverà l'EconomySystem e PlayerSystem dopo l'inizializzazione
    this.uiSystem = new UiSystem(this.world.getECS(), this.questSystem, this.context);

    // Crea sistema di inizializzazione
    this.gameInitSystem = new GameInitializationSystem(this.world.getECS(), this.world, this.context, this.questManager, this.questSystem, this.uiSystem);
  }

  /**
   * Avvia il gameplay
   */
  async enter(_context: GameContext): Promise<void> {
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

    // Avvia musica di background e suoni ambientali
    if (this.audioSystem) {
      this.audioSystem.init();
      this.audioSystem.playMusic('background');
      // Piccolo delay prima di avviare ambience per evitare conflitti
      setTimeout(() => {
        if (this.audioSystem) {
          this.audioSystem.playMusic('ambience'); // Suono ambientale in loop
        }
      }, 100);
    }

    // Messaggio di benvenuto nella chat
    setTimeout(() => {
      this.uiSystem.addSystemMessage('🚀 Benvenuto in Starfield! Usa la chat per comunicare.');
    }, 1000);

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
  render(_ctx: CanvasRenderingContext2D): void {
    // Renderizza il mondo di gioco
    this.world.render();
  }

  /**
   * Gestisce input di gioco
   */
  handleInput(_event: Event): void {
    // Gli input sono gestiti dai sistemi ECS (InputSystem)
    // Questo metodo Ã¨ disponibile per input speciali se necessario
  }

  /**
   * Termina il gameplay
   */
  exit(): void {
    // Ferma musica di background e suoni ambientali
    if (this.audioSystem) {
      this.audioSystem.stopSound('background');
      this.audioSystem.stopSound('ambience');
    }

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
    this.audioSystem = systems.audioSystem;

    // Collega l'EconomySystem all'UiSystem
    if (systems.economySystem) {
      this.uiSystem.setEconomySystem(systems.economySystem);
    }

    // Collega il PlayerSystem all'UiSystem
    if (systems.playerSystem) {
      this.uiSystem.setPlayerSystem(systems.playerSystem);
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
      const nickname = this.context.playerNickname || 'Commander';
      const rank = this.getPlayerRank();
      this.uiSystem.createPlayerNicknameElement(`${nickname}\n[${rank}]`);
      this.nicknameCreated = true; // Flag per evitare ricreazione
    }

    const camera = this.movementSystem.getCamera();
    const canvasSize = this.world.getCanvasSize();

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
