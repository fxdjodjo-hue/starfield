import { GameState } from './GameState';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { World } from '../../infrastructure/engine/World';
import { MovementSystem } from '../../systems/physics/MovementSystem';
import { QuestManager } from '../../systems/quest/QuestManager';
import { QuestSystem } from '../../systems/quest/QuestSystem';
import { GameInitializationSystem } from '../../systems/game/GameInitializationSystem';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { RemotePlayerSystem } from '../../systems/multiplayer/RemotePlayerSystem';
import { UiSystem } from '../../systems/ui/UiSystem';
import { Transform } from '../../entities/spatial/Transform';
import { Sprite } from '../../entities/Sprite';
import { Npc } from '../../entities/ai/Npc';
import AudioSystem from '../../systems/audio/AudioSystem';
import { PlayerUpgrades } from '../../entities/player/PlayerUpgrades';
import { Credits, Cosmos } from '../../entities/currency/Currency';
import { Experience } from '../../entities/currency/Experience';
import { SkillPoints } from '../../entities/currency/SkillPoints';

/**
 * Stato del gameplay attivo
 * Gestisce il mondo di gioco, ECS e tutti i sistemi di gameplay
 */
export class PlayState extends GameState {

  private world!: World;
  private uiSystem!: UiSystem;
  private gameInitSystem!: GameInitializationSystem;
  private context: GameContext;
  private playerEntity: any = null;
  private economySystem: any = null;
  private questSystem: QuestSystem | null = null;
  private questManager: QuestManager | null = null;
  private movementSystem: MovementSystem | null = null;
  private audioSystem: AudioSystem | null = null;
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private remotePlayerSystem: RemotePlayerSystem | null = null;
  private nicknameCreated: boolean = false;

  // Gestione elementi DOM per nickname NPC (stabili come il player)
  private npcNicknameElements: Map<number, HTMLDivElement> = new Map();
  // Gestione elementi DOM per nickname remote player
  private remotePlayerNicknameElements: Map<string, HTMLDivElement> = new Map();


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
   * Avvia il gameplay
   */
  async enter(_context: GameContext): Promise<void> {
    // Crea UiSystem solo ora (quando si entra nel PlayState)
    if (!this.uiSystem) {
      this.uiSystem = new UiSystem(this.world.getECS(), this.questSystem!, this.context);
      // Aggiorna il sistema di inizializzazione con l'UiSystem appena creato
      (this.gameInitSystem as any).uiSystem = this.uiSystem;
    }

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

    // Sistemi multiplayer verranno inizializzati dopo la creazione del player

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
      this.uiSystem.addSystemMessage('🚀 Welcome to Starfield! Use the chat to communicate.');
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

    // Aggiorna posizione del nickname del player
    this.updateNicknamePosition();

    // Aggiorna posizioni nickname NPC (DOM-based per stabilità)
    this.updateNpcNicknames();

    // Aggiorna posizioni nickname remote player
    this.updateRemotePlayerNicknames();

    // Aggiorna il sistema di rete multiplayer
    if (this.clientNetworkSystem) {
      this.clientNetworkSystem.update(deltaTime);
    }
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

    // Rimuovi elemento nickname del player (delegato all'UiSystem)
    // Rimuovi elementi DOM dei nickname NPC
    this.cleanupNpcNicknames();

    // Rimuovi elementi DOM dei nickname remote player
    this.cleanupRemotePlayerNicknames();

    // Rimuovi eventuali riferimenti ai timer di comportamento (ora non usati)

    this.uiSystem.showMainTitle();
    // Qui potremmo fare altro cleanup se necessario
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
   * Inizializza sistemi multiplayer dopo la creazione del player
   */
  private initializeMultiplayerSystems(): void {
    if (!this.playerEntity) {
      console.error('Player entity not found, cannot initialize multiplayer systems');
      return;
    }

    // Ottieni sprite info dal player locale
    const playerSprite = this.world.getECS().getComponent(this.playerEntity, Sprite);
    const shipImage = playerSprite?.image || null;
    const shipWidth = playerSprite?.width || 32;
    const shipHeight = playerSprite?.height || 32;

    // Inizializza il sistema per i giocatori remoti
    this.remotePlayerSystem = new RemotePlayerSystem(this.world.getECS(), shipImage, shipWidth, shipHeight);
    this.world.getECS().addSystem(this.remotePlayerSystem);

    // Inizializza il sistema di rete multiplayer
    this.clientNetworkSystem = new ClientNetworkSystem(this.world.getECS(), this.context, this.remotePlayerSystem);

    // Imposta informazioni del player nel sistema di rete
    this.clientNetworkSystem.setPlayerInfo(this.context.playerNickname, this.context.playerId);
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

    // Inizializza sistemi multiplayer dopo che il player è stato creato
    this.initializeMultiplayerSystems();

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
      const nickname = this.context.localPlayer?.nickname || 'Commander';
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
   * Aggiorna posizioni e visibilità dei nickname NPC (elementi DOM stabili)
   */
  private updateNpcNicknames(): void {
    if (!this.movementSystem || !this.uiSystem) return;

    const camera = this.movementSystem.getCamera();
    const canvasSize = this.world.getCanvasSize();
    const ecs = this.world.getECS();

    // Trova tutti gli NPC nel sistema
    const npcs = ecs.getEntitiesWithComponents(Npc, Transform);

    // Track quali NPC sono ancora visibili per cleanup
    const visibleNpcIds = new Set<number>();

    for (const entity of npcs) {
      const npc = ecs.getComponent(entity, Npc);
      const transform = ecs.getComponent(entity, Transform);

      if (npc && transform) {
        // Verifica se l'NPC è visibile sulla schermata
        const screenPos = camera.worldToScreen(transform.x, transform.y, canvasSize.width, canvasSize.height);
        const isVisible = screenPos.x >= -100 && screenPos.x <= canvasSize.width + 100 &&
                         screenPos.y >= -100 && screenPos.y <= canvasSize.height + 100;

        if (isVisible) {
          visibleNpcIds.add(entity.id);
          this.ensureNpcNicknameElement(entity.id, npc.npcType);
          this.updateNpcNicknamePosition(entity.id, screenPos.x, screenPos.y);
        }
      }
    }

    // Rimuovi elementi DOM per NPC non più visibili
    for (const [entityId, element] of this.npcNicknameElements) {
      if (!visibleNpcIds.has(entityId)) {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
        this.npcNicknameElements.delete(entityId);
      }
    }
  }

  /**
   * Assicura che esista un elemento DOM per il nickname dell'NPC
   */
  private ensureNpcNicknameElement(entityId: number, npcType: string): void {
    if (!this.npcNicknameElements.has(entityId)) {
      const element = document.createElement('div');
      element.id = `npc-nickname-${entityId}`;
      element.style.cssText = `
        position: fixed;
        color: rgba(255, 68, 68, 0.9);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 500;
        font-size: 12px;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        pointer-events: none;
        z-index: 100;
        white-space: nowrap;
      `;
      element.textContent = npcType;
      document.body.appendChild(element);
      this.npcNicknameElements.set(entityId, element);
    }
  }

  /**
   * Aggiorna la posizione dell'elemento DOM del nickname NPC
   */
  private updateNpcNicknamePosition(entityId: number, screenX: number, screenY: number): void {
    const element = this.npcNicknameElements.get(entityId);
    if (element) {
      const nicknameX = screenX - element.offsetWidth / 2;
      const nicknameY = screenY + 55;

      element.style.left = `${nicknameX}px`;
      element.style.top = `${nicknameY}px`;
      element.style.display = 'block';
    }
  }

  /**
   * Rimuove tutti gli elementi DOM dei nickname NPC (cleanup)
   */
  private cleanupNpcNicknames(): void {
    for (const [entityId, element] of this.npcNicknameElements) {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.npcNicknameElements.clear();
  }

  /**
   * Aggiorna posizioni e contenuti dei nickname remote player
   */
  private updateRemotePlayerNicknames(): void {
    if (!this.remotePlayerSystem) return;

    // Per ogni remote player attivo
    for (const clientId of this.remotePlayerSystem.getActiveRemotePlayers()) {
      const entityId = this.remotePlayerSystem.getRemotePlayerEntity(clientId);
      if (!entityId) continue;

      const entity = this.world.getECS().getEntity(entityId);
      if (!entity) continue;

      const transform = this.world.getECS().getComponent(entity, Transform);
      if (!transform) continue;

      // Converti posizione world a schermo
      const camera = this.movementSystem?.getCamera();
      if (!camera) continue;

      const canvasSize = { width: 800, height: 600 }; // Valori di default, potrebbero essere dinamici
      const screenPos = camera.worldToScreen(transform.x, transform.y, canvasSize.width, canvasSize.height);

      // Assicura che esista l'elemento DOM per questo remote player
      const playerInfo = this.remotePlayerSystem.getRemotePlayerInfo(clientId);
      if (playerInfo) {
        this.ensureRemotePlayerNicknameElement(clientId, playerInfo.nickname, playerInfo.rank);
        this.updateRemotePlayerNicknamePosition(clientId, screenPos.x, screenPos.y);
      }
    }

    // Rimuovi elementi per remote player che non esistono più
    for (const [clientId, element] of this.remotePlayerNicknameElements) {
      if (!this.remotePlayerSystem.isRemotePlayer(clientId)) {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
        this.remotePlayerNicknameElements.delete(clientId);
      }
    }
  }

  /**
   * Assicura che esista un elemento DOM per il nickname del remote player
   */
  private ensureRemotePlayerNicknameElement(clientId: string, nickname: string, rank: string): void {
    if (!this.remotePlayerNicknameElements.has(clientId)) {
      const element = document.createElement('div');
      element.id = `remote-player-nickname-${clientId}`;
      element.style.cssText = `
        position: absolute;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        font-weight: bold;
        color: #00ff88;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        text-align: center;
        pointer-events: none;
        z-index: 1000;
        white-space: pre-line;
      `;

      // Formatta come due righe: nickname sopra, [rank] sotto
      element.textContent = `${nickname}\n[${rank}]`;

      document.body.appendChild(element);
      this.remotePlayerNicknameElements.set(clientId, element);
    }
  }

  /**
   * Aggiorna la posizione dell'elemento DOM del nickname remote player
   */
  private updateRemotePlayerNicknamePosition(clientId: string, screenX: number, screenY: number): void {
    const element = this.remotePlayerNicknameElements.get(clientId);
    if (element) {
      const nicknameX = screenX - element.offsetWidth / 2;
      const nicknameY = screenY + 55; // Sotto la nave, come gli NPC

      element.style.left = `${nicknameX}px`;
      element.style.top = `${nicknameY}px`;
    }
  }

  /**
   * Rimuove tutti gli elementi DOM dei nickname remote player (cleanup)
   */
  private cleanupRemotePlayerNicknames(): void {
    for (const [clientId, element] of this.remotePlayerNicknameElements) {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.remotePlayerNicknameElements.clear();
  }









  /**
   * Restituisce il mondo di gioco per accesso esterno
   */
  getWorld(): World {
    return this.world;
  }
}
