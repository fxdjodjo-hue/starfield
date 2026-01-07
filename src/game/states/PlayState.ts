import { GameState } from './GameState';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { World } from '../../infrastructure/engine/World';
import { MovementSystem } from '../../systems/physics/MovementSystem';
import { CameraSystem } from '../../systems/rendering/CameraSystem';
import { InterpolationSystem } from '../../systems/physics/InterpolationSystem';
import { QuestManager } from '../../systems/quest/QuestManager';
import { QuestSystem } from '../../systems/quest/QuestSystem';
import { GameInitializationSystem } from '../../systems/game/GameInitializationSystem';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { NETWORK_CONFIG } from '../../config/NetworkConfig';
import { RemotePlayerSystem } from '../../systems/multiplayer/RemotePlayerSystem';
import { RemoteNpcSystem } from '../../systems/multiplayer/RemoteNpcSystem';
import { RemoteProjectileSystem } from '../../systems/multiplayer/RemoteProjectileSystem';
import { UiSystem } from '../../systems/ui/UiSystem';
import { Transform } from '../../entities/spatial/Transform';
import { Sprite } from '../../entities/Sprite';
import { Npc } from '../../entities/ai/Npc';
import AudioSystem from '../../systems/audio/AudioSystem';

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
  private cameraSystem: CameraSystem | null = null;
  private movementSystem: MovementSystem | null = null;
  private interpolationSystem: InterpolationSystem | null = null;
  private audioSystem: AudioSystem | null = null;
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private remotePlayerSystem: RemotePlayerSystem | null = null;
  private remoteNpcSystem: RemoteNpcSystem | null = null;
  private remoteProjectileSystem: RemoteProjectileSystem | null = null;
  private nicknameCreated: boolean = false;
  private remotePlayerSpriteUpdated: boolean = false;

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

    // Inizializza sistemi multiplayer PRIMA dell'inizializzazione del gioco
    await this.initializeMultiplayerSystems();

    try {
      // Inizializza il mondo e crea il giocatore PRIMA di mostrare l'HUD
      await this.initializeGame();
    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }

    // Inizializza il sistema UI dopo che tutti i sistemi sono stati creati
    this.uiSystem.initialize();

    // I sistemi remoti sono già stati collegati prima dell'inizializzazione del gioco

    // Ora che tutti i sistemi sono collegati, connetti al server
    if (this.clientNetworkSystem && typeof this.clientNetworkSystem.connectToServer === 'function') {
      // console.log('🔌 [PLAYSTATE] Connecting to server after game initialization...');
      this.clientNetworkSystem.connectToServer().catch(error => {
        console.error('❌ [PLAYSTATE] Failed to connect to server:', error);
      });
    }

    // Mostra info del giocatore DOPO l'inizializzazione dei sistemi
    this.uiSystem.showPlayerInfo();

    // Collega l'AudioSystem al ClientNetworkSystem ora che è stato creato
    if (this.clientNetworkSystem && this.audioSystem) {
      this.clientNetworkSystem.setAudioSystem(this.audioSystem);
    }

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
      this.uiSystem.addSystemMessage('Welcome to Starfield! Use the chat to communicate.');
    }, 1000);

    // Il nickname verrà creato al primo update quando tutti i sistemi sono pronti

    // HUD toggle gestito da UiSystem

    // I listener per i pannelli sono ora gestiti da UiSystem e QuestSystem
  }

  /**
   * Inizializza i sistemi multiplayer prima dell'inizializzazione del gioco
   */
  private async initializeMultiplayerSystems(): Promise<void> {
    // Carica gli asset necessari per i sistemi remoti
    const shipImage = await this.context.assetManager.loadImage('/assets/ships/0/0.png');

    // Crea sistema remote player
    this.remotePlayerSystem = new RemotePlayerSystem(this.world.getECS(), shipImage, 32, 32);
    this.world.getECS().addSystem(this.remotePlayerSystem);

    // Prova a ottenere i sistemi remoti (potrebbero essere null se initialize() non è stato chiamato)
    const systems = this.gameInitSystem.getSystems();
    this.remoteNpcSystem = systems.remoteNpcSystem || null;
    this.remoteProjectileSystem = systems.remoteProjectileSystem || null;

    // Inizializza il sistema di rete multiplayer
    this.clientNetworkSystem = new ClientNetworkSystem(
      this.world.getECS(),
      this.context,
      this.remotePlayerSystem,
      NETWORK_CONFIG.DEFAULT_SERVER_URL, // Server configurato
      this.remoteNpcSystem, // Sistema NPC (potrebbe essere null inizialmente)
      this.remoteProjectileSystem, // Sistema proiettili (potrebbe essere null inizialmente)
      this.audioSystem // Sistema audio
    );
    this.world.getECS().addSystem(this.clientNetworkSystem);

    // Imposta informazioni del player nel sistema di rete
    this.clientNetworkSystem.setPlayerInfo(this.context.playerNickname, this.context.playerId);

    // Il ClientNetworkSystem verrà impostato dopo l'inizializzazione del gioco
    // this.setupClientNetworkSystem(); // Spostato dopo initializeGame()

    // Collega il callback per processare le richieste pendenti quando la connessione è stabilita
    if (this.clientNetworkSystem && typeof this.clientNetworkSystem.onConnected === 'function') {
      this.clientNetworkSystem.onConnected(() => {
        // Notifica il CombatSystem che può processare le richieste pendenti
        const systems = this.gameInitSystem.getSystems();
        if (systems.combatSystem && typeof systems.combatSystem.processPendingCombatRequests === 'function') {
          systems.combatSystem.processPendingCombatRequests();
        }
      });
    }

    // Imposta callback per notificare il CombatSystem quando la connessione è stabilita
    if (this.clientNetworkSystem && typeof this.clientNetworkSystem.onConnected === 'function') {
      this.clientNetworkSystem.onConnected(() => {
        // Notifica il CombatSystem che può processare le richieste pendenti
        const combatSystem = this.gameInitSystem.getSystems().combatSystem;
        if (combatSystem && typeof combatSystem.processPendingCombatRequests === 'function') {
          combatSystem.processPendingCombatRequests();
        }
      });
    }
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

    // Aggiorna posizioni nickname NPC e remote player (delegato a UiSystem)
    this.updateNpcNicknames();
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

    // Rimuovi elementi DOM dei nickname (delegato all'UiSystem)

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
   * Imposta il ClientNetworkSystem nel GameInitializationSystem
   */
  private setupClientNetworkSystem(): void {
    if (this.clientNetworkSystem && this.gameInitSystem) {
      this.gameInitSystem.setClientNetworkSystem(this.clientNetworkSystem);
    } else {
      console.warn('[PLAYSTATE] ClientNetworkSystem or GameInitializationSystem not available');
    }
  }

  /**
   * Inizializza il mondo di gioco e crea entitÃ
   */
  private async initializeGame(): Promise<void> {
    // console.log('🚀 [PLAYSTATE] Starting game initialization');

    // Delega l'inizializzazione al GameInitializationSystem e ottieni il player entity
    this.playerEntity = await this.gameInitSystem.initialize();

    // Ora che i sistemi sono stati creati, imposta il ClientNetworkSystem
    this.setupClientNetworkSystem();

    // Ottieni riferimenti ai sistemi creati
    const systems = this.gameInitSystem.getSystems();
    this.questSystem = systems.questSystem;
    this.uiSystem = systems.uiSystem;
    this.questManager = systems.questManager;
    this.cameraSystem = systems.cameraSystem;
    this.movementSystem = systems.movementSystem;

    // Ora che i sistemi sono stati creati, imposta NPC e proiettili remoti nel ClientNetworkSystem
    if (systems.remoteNpcSystem) {
      this.remoteNpcSystem = systems.remoteNpcSystem;
      // Imposta il remoteNpcSystem nel ClientNetworkSystem
      if (this.clientNetworkSystem && typeof this.clientNetworkSystem.setRemoteNpcSystem === 'function') {
        this.clientNetworkSystem.setRemoteNpcSystem(this.remoteNpcSystem);
      }
    }
    if (systems.remoteProjectileSystem) {
      this.remoteProjectileSystem = systems.remoteProjectileSystem;
      // Imposta il remoteProjectileSystem nel ClientNetworkSystem
      if (this.clientNetworkSystem && typeof this.clientNetworkSystem.setRemoteProjectileSystem === 'function') {
        this.clientNetworkSystem.setRemoteProjectileSystem(this.remoteProjectileSystem);
      }
    }


    // Inizializza il sistema di interpolazione per movimenti fluidi
    this.interpolationSystem = new InterpolationSystem(this.world.getECS());
    this.world.getECS().addSystem(this.interpolationSystem);
    this.audioSystem = systems.audioSystem;

    // Collega l'EconomySystem all'UiSystem
    if (systems.economySystem) {
      this.uiSystem.setEconomySystem(systems.economySystem);
    }


    // Collega il PlayerSystem all'UiSystem
    if (systems.playerSystem) {
      this.uiSystem.setPlayerSystem(systems.playerSystem);
    }

    // Collega il ClientNetworkSystem all'UiSystem (per SkillsPanel)
    if (this.clientNetworkSystem) {
      this.uiSystem.setClientNetworkSystem(this.clientNetworkSystem);
    }

    // Collega il PlayerSystem al ClientNetworkSystem (per sincronizzazione upgrade)
    if (systems.playerSystem && this.clientNetworkSystem) {
      this.clientNetworkSystem.setPlayerSystem(systems.playerSystem);
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

    const camera = this.cameraSystem!.getCamera();
    const canvasSize = this.world.getCanvasSize();

    // Delega all'UiSystem
    this.uiSystem.updatePlayerNicknamePosition(transform.x, transform.y, camera, canvasSize);
  }

  /**
   * Aggiorna posizioni e visibilità dei nickname NPC (elementi DOM stabili)
   */
  private updateNpcNicknames(): void {
    if (!this.movementSystem || !this.uiSystem) return;

    const camera = this.cameraSystem!.getCamera();
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
          this.uiSystem.ensureNpcNicknameElement(entity.id, npc.npcType);
          this.uiSystem.updateNpcNicknamePosition(entity.id, screenPos.x, screenPos.y);
        }
      }
    }

    // Rimuovi elementi DOM per NPC non più visibili
    const activeNpcIds = this.uiSystem.getNpcNicknameEntityIds();
    for (const entityId of activeNpcIds) {
      if (!visibleNpcIds.has(entityId)) {
        this.uiSystem.removeNpcNicknameElement(entityId);
      }
    }
  }




  /**
   * Aggiorna l'immagine del sprite per i remote player se necessario
   */
  private updateRemotePlayerSpriteImage(): void {
    if (!this.remotePlayerSystem || !this.playerEntity || this.remotePlayerSpriteUpdated) return;

    const playerSprite = this.world.getECS().getComponent(this.playerEntity, Sprite);
    if (playerSprite && playerSprite.image && playerSprite.isLoaded()) {
      // L'immagine del player è caricata, aggiorna il sprite condiviso dei remote player
      this.remotePlayerSystem.updateSharedSpriteImage(
        playerSprite.image,
        playerSprite.width,
        playerSprite.height
      );
      this.remotePlayerSpriteUpdated = true; // Evita aggiornamenti ripetuti
    }
  }

  /**
   * Aggiorna posizioni e contenuti dei nickname remote player
   */
  private updateRemotePlayerNicknames(): void {
    if (!this.remotePlayerSystem) return;

    // Controlla se dobbiamo aggiornare l'immagine del sprite condiviso
    this.updateRemotePlayerSpriteImage();

    // Per ogni remote player attivo
    for (const clientId of this.remotePlayerSystem.getActiveRemotePlayers()) {
      const entityId = this.remotePlayerSystem.getRemotePlayerEntity(clientId);
      if (!entityId) continue;

      const entity = this.world.getECS().getEntity(entityId);
      if (!entity) continue;

      const transform = this.world.getECS().getComponent(entity, Transform);
      if (!transform) continue;

      // Converti posizione world a schermo
      const camera = this.cameraSystem?.getCamera();
      if (!camera) continue;

      const canvasSize = this.world.getCanvasSize();
      const screenPos = camera.worldToScreen(transform.x, transform.y, canvasSize.width, canvasSize.height);

      // Assicura che esista l'elemento DOM per questo remote player
      const playerInfo = this.remotePlayerSystem.getRemotePlayerInfo(clientId);
      if (playerInfo) {
        this.uiSystem.ensureRemotePlayerNicknameElement(clientId, playerInfo.nickname, playerInfo.rank);
        this.uiSystem.updateRemotePlayerNicknamePosition(clientId, screenPos.x, screenPos.y);
      }
    }

    // Rimuovi elementi per remote player che non esistono più
    const activeClientIds = this.uiSystem.getRemotePlayerNicknameClientIds();
    for (const clientId of activeClientIds) {
      if (!this.remotePlayerSystem.isRemotePlayer(clientId)) {
        this.uiSystem.removeRemotePlayerNicknameElement(clientId);
      }
    }
  }

  /**
   * Assicura che esista un elemento DOM per il nickname del remote player
   */












  /**
   * Restituisce il mondo di gioco per accesso esterno
   */
  getWorld(): World {
    return this.world;
  }
}
