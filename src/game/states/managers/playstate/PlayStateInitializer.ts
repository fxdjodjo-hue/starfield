import type { GameContext } from '../../../../infrastructure/engine/GameContext';
import { World } from '../../../../infrastructure/engine/World';
import type { GameInitializationSystem } from '../../../../systems/game/GameInitializationSystem';
import { ClientNetworkSystem } from '../../../../multiplayer/client/ClientNetworkSystem';
import { UiSystem } from '../../../../systems/ui/UiSystem';
import { RemotePlayerSystem } from '../../../../systems/multiplayer/RemotePlayerSystem';
import type { RemoteNpcSystem } from '../../../../systems/multiplayer/RemoteNpcSystem';
import type { RemoteProjectileSystem } from '../../../../systems/multiplayer/RemoteProjectileSystem';
import type { Entity } from '../../../../infrastructure/ecs/Entity';
import { NETWORK_CONFIG } from '../../../../config/NetworkConfig';
import { InterpolationSystem } from '../../../../systems/physics/InterpolationSystem';

/**
 * Manages PlayState initialization, setup, and resource loading
 */
export class PlayStateInitializer {
  constructor(
    private readonly context: GameContext,
    private readonly world: World,
    private readonly gameInitSystem: GameInitializationSystem,
    private readonly getUiSystem: () => UiSystem | null,
    private readonly setUiSystem: (uiSystem: UiSystem) => void,
    private readonly getClientNetworkSystem: () => ClientNetworkSystem | null,
    private readonly setClientNetworkSystem: (system: ClientNetworkSystem) => void,
    private readonly getRemotePlayerSystem: () => RemotePlayerSystem | null,
    private readonly setRemotePlayerSystem: (system: RemotePlayerSystem) => void,
    private readonly getRemoteNpcSystem: () => RemoteNpcSystem | null,
    private readonly setRemoteNpcSystem: (system: RemoteNpcSystem | null) => void,
    private readonly getRemoteProjectileSystem: () => RemoteProjectileSystem | null,
    private readonly setRemoteProjectileSystem: (system: RemoteProjectileSystem | null) => void,
    private readonly getPlayerEntity: () => Entity | null,
    private readonly setPlayerEntity: (entity: Entity) => void,
    private readonly getEconomySystem: () => any,
    private readonly setEconomySystem: (system: any) => void,
    private readonly getQuestSystem: () => any,
    private readonly setQuestSystem: (system: any) => void,
    private readonly getQuestManager: () => any,
    private readonly setQuestManager: (manager: any) => void,
    private readonly getCameraSystem: () => any,
    private readonly setCameraSystem: (system: any) => void,
    private readonly getMovementSystem: () => any,
    private readonly setMovementSystem: (system: any) => void,
    private readonly getInterpolationSystem: () => any,
    private readonly setInterpolationSystem: (system: any) => void,
    private readonly getAudioSystem: () => any,
    private readonly setAudioSystem: (system: any) => void
  ) {}

  /**
   * Hides the loading screen
   */
  hideLoadingScreen(): void {
    console.log('[PlayState] hideLoadingScreen() chiamato');
    
    // Nascondi AuthScreen se disponibile
    if (this.context.authScreen && typeof this.context.authScreen.hide === 'function') {
      console.log('[PlayState] Nascondendo AuthScreen tramite metodo hide()');
      this.context.authScreen.hide();
    } else {
      console.warn('[PlayState] AuthScreen.hide() non disponibile, provo fallback');
      // Fallback: cerca e nascondi manualmente
      const authContainer = document.querySelector('[style*="position: fixed"][style*="z-index: 1000"]');
      if (authContainer) {
        console.log('[PlayState] Trovato authContainer, nascondendo...');
        (authContainer as HTMLElement).style.display = 'none';
      } else {
        console.warn('[PlayState] authContainer non trovato nel DOM');
      }
    }
  }

  /**
   * Waits for player data to be ready (RecentHonor available)
   */
  async waitForPlayerDataReady(): Promise<void> {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 200; // 20 secondi max (200 * 100ms)
      const checkInterval = 100; // Controlla ogni 100ms

      console.log('[PlayState] waitForPlayerDataReady() iniziato');

      const checkDataReady = () => {
        attempts++;

        const economySystem = this.getEconomySystem();

        // Verifica se RecentHonor è disponibile nel context
        // Controlla anche se è stato impostato in RankSystem tramite EconomySystem
        let hasRecentHonor = this.context.playerInventory?.recentHonor !== undefined;
        
        // Verifica anche in RankSystem (potrebbe essere impostato prima che arrivi nel context)
        if (!hasRecentHonor && economySystem) {
          const rankSystem = (economySystem as any).rankSystem;
          if (rankSystem && (rankSystem as any).recentHonor !== null && (rankSystem as any).recentHonor !== undefined) {
            hasRecentHonor = true;
            console.log('[PlayState] RecentHonor trovato in RankSystem:', (rankSystem as any).recentHonor);
          }
        }

        const hasInventory = this.context.playerInventory !== undefined && 
                            this.context.playerInventory.experience > 0;

        // Log ogni 10 tentativi (ogni secondo)
        if (attempts % 10 === 0) {
          const seconds = Math.floor(attempts / 10);
          console.log(`[PlayState] Tentativo ${attempts} (${seconds}s):`, {
            hasRecentHonor,
            hasInventory,
            recentHonorInContext: this.context.playerInventory?.recentHonor,
            experience: this.context.playerInventory?.experience,
            economySystem: !!economySystem,
            rankSystemRecentHonor: economySystem ? (economySystem as any).rankSystem?.recentHonor : 'N/A'
          });
        }

        // Aggiorna il testo di loading se AuthScreen è disponibile
        if (this.context.authScreen && typeof this.context.authScreen.updateLoadingText === 'function') {
          if (attempts % 10 === 0) { // Ogni secondo
            const seconds = Math.floor(attempts / 10);
            if (hasRecentHonor) {
              console.log('[PlayState] RecentHonor disponibile! Mostrando "Ready!"');
              this.context.authScreen.updateLoadingText('Ready!');
              // Piccolo delay prima di risolvere per mostrare "Ready!"
              setTimeout(() => {
                console.log('[PlayState] Risolvendo waitForPlayerDataReady()');
                resolve();
              }, 300);
              return;
            } else {
              this.context.authScreen.updateLoadingText(`Loading player data... (${seconds}s)`);
            }
          }
        }

        if (hasRecentHonor || attempts >= maxAttempts) {
          // Dati pronti o timeout raggiunto
          if (hasRecentHonor) {
            console.log('[PlayState] RecentHonor trovato, risolvendo...');
            resolve();
          } else {
            // Timeout: procedi comunque
            console.warn('[PlayState] Timeout waiting for RecentHonor, proceeding anyway');
            if (this.context.authScreen && typeof this.context.authScreen.updateLoadingText === 'function') {
              this.context.authScreen.updateLoadingText('Ready! (using default values)');
            }
            setTimeout(() => {
              console.log('[PlayState] Risolvendo waitForPlayerDataReady() dopo timeout');
              resolve();
            }, 300);
          }
        } else {
          setTimeout(checkDataReady, checkInterval);
        }
      };

      checkDataReady();
    });
  }

  /**
   * Sets up ClientNetworkSystem in GameInitializationSystem
   */
  setupClientNetworkSystem(): void {
    const clientNetworkSystem = this.getClientNetworkSystem();
    if (clientNetworkSystem && this.gameInitSystem) {
      this.gameInitSystem.setClientNetworkSystem(clientNetworkSystem);
    } else {
      console.warn('[PLAYSTATE] ClientNetworkSystem or GameInitializationSystem not available');
    }
  }

  /**
   * Initializes multiplayer systems before game initialization
   */
  async initializeMultiplayerSystems(): Promise<void> {
    // Carica AnimatedSprite per i remote player (stesso del player normale)
    const remotePlayerSprite = await this.context.assetManager.createAnimatedSprite('/assets/ships/ship106/ship106', 0.7);

    // Crea sistema remote player
    const remotePlayerSystem = new RemotePlayerSystem(this.world.getECS(), remotePlayerSprite);
    this.world.getECS().addSystem(remotePlayerSystem);
    this.setRemotePlayerSystem(remotePlayerSystem);

    // Prova a ottenere i sistemi remoti (potrebbero essere null se initialize() non è stato chiamato)
    const systems = this.gameInitSystem.getSystems();
    const remoteNpcSystem = systems.remoteNpcSystem || null;
    const remoteProjectileSystem = systems.remoteProjectileSystem || null;
    this.setRemoteNpcSystem(remoteNpcSystem);
    this.setRemoteProjectileSystem(remoteProjectileSystem);

    const audioSystem = this.getAudioSystem();

    // Inizializza il sistema di rete multiplayer
    const clientNetworkSystem = new ClientNetworkSystem(
      this.world.getECS(),
      this.context,
      remotePlayerSystem,
      NETWORK_CONFIG.DEFAULT_SERVER_URL,
      remoteNpcSystem,
      remoteProjectileSystem,
      audioSystem
    );
    this.world.getECS().addSystem(clientNetworkSystem);
    this.setClientNetworkSystem(clientNetworkSystem);

    // Collega il callback per processare le richieste pendenti quando la connessione è stabilita
    if (clientNetworkSystem && typeof clientNetworkSystem.onConnected === 'function') {
      clientNetworkSystem.onConnected(() => {
        // Notifica il CombatStateSystem che può processare le richieste pendenti
        const systems = this.gameInitSystem.getSystems();
        if (systems.combatStateSystem && typeof systems.combatStateSystem.processPlayerCombat === 'function') {
          // Il CombatStateSystem gestisce automaticamente il processamento delle richieste nel suo update
        }
      });
    }
  }

  /**
   * Initializes the game world and creates entities
   */
  async initializeGame(): Promise<void> {
    console.log('[PlayStateInitializer] initializeGame() iniziato');
    
    try {
      // Delega l'inizializzazione al GameInitializationSystem e ottieni il player entity
      console.log('[PlayStateInitializer] Chiamando gameInitSystem.initialize()...');
      const playerEntity = await this.gameInitSystem.initialize();
      console.log('[PlayStateInitializer] gameInitSystem.initialize() completato, playerEntity:', playerEntity);
      this.setPlayerEntity(playerEntity);

      // Ora che i sistemi sono stati creati, imposta il ClientNetworkSystem
      console.log('[PlayStateInitializer] Impostando ClientNetworkSystem...');
      this.setupClientNetworkSystem();
      console.log('[PlayStateInitializer] ClientNetworkSystem impostato');

    // Ottieni riferimenti ai sistemi creati
    console.log('[PlayStateInitializer] Ottenendo riferimenti ai sistemi...');
    const systems = this.gameInitSystem.getSystems();
    console.log('[PlayStateInitializer] Sistemi ottenuti:', Object.keys(systems));
    this.setQuestSystem(systems.questSystem);
    const uiSystem = this.getUiSystem();
    if (!uiSystem && systems.uiSystem) {
      this.setUiSystem(systems.uiSystem);
    }
    this.setQuestManager(systems.questManager);
    this.setCameraSystem(systems.cameraSystem);
    this.setMovementSystem(systems.movementSystem);
    console.log('[PlayStateInitializer] Riferimenti sistemi impostati');

    // Ora che i sistemi sono stati creati, imposta NPC e proiettili remoti nel ClientNetworkSystem
    if (systems.remoteNpcSystem) {
      this.setRemoteNpcSystem(systems.remoteNpcSystem);
      const clientNetworkSystem = this.getClientNetworkSystem();
      if (clientNetworkSystem && typeof clientNetworkSystem.setRemoteNpcSystem === 'function') {
        clientNetworkSystem.setRemoteNpcSystem(systems.remoteNpcSystem);
      }
    }
    if (systems.remoteProjectileSystem) {
      this.setRemoteProjectileSystem(systems.remoteProjectileSystem);
      const clientNetworkSystem = this.getClientNetworkSystem();
      if (clientNetworkSystem && typeof clientNetworkSystem.setRemoteProjectileSystem === 'function') {
        clientNetworkSystem.setRemoteProjectileSystem(systems.remoteProjectileSystem);
      }
    }

    // Inizializza il sistema di interpolazione per movimenti fluidi
    const interpolationSystem = new InterpolationSystem(this.world.getECS());
    this.world.getECS().addSystem(interpolationSystem);
    this.setInterpolationSystem(interpolationSystem);
    this.setAudioSystem(systems.audioSystem);

    // Collega l'EconomySystem all'UiSystem
    if (systems.economySystem) {
      this.setEconomySystem(systems.economySystem);
      const uiSystem = this.getUiSystem();
      if (uiSystem) {
        uiSystem.setEconomySystem(systems.economySystem);
      }
    }

    // Collega il PlayerSystem all'UiSystem
    if (systems.playerSystem) {
      const uiSystem = this.getUiSystem();
      if (uiSystem) {
        uiSystem.setPlayerSystem(systems.playerSystem);
      }
    }

    // Collega il ClientNetworkSystem all'UiSystem (per UpgradePanel)
    console.log('[PlayStateInitializer] Collegando ClientNetworkSystem all\'UiSystem...');
    const clientNetworkSystem = this.getClientNetworkSystem();
    if (clientNetworkSystem) {
      const uiSystem = this.getUiSystem();
      if (uiSystem) {
        uiSystem.setClientNetworkSystem(clientNetworkSystem);
        // 🔧 FIX RACE CONDITION: Usa il nuovo sistema di inizializzazione sequenziale
        console.log('[PlayStateInitializer] Inizializzando sistema di rete...');
        await this.initializeNetworkSystem();
        console.log('[PlayStateInitializer] Sistema di rete inizializzato');
      }
    } else {
      console.warn('[PlayStateInitializer] ClientNetworkSystem non disponibile');
    }

    // Collega il PlayerSystem al ClientNetworkSystem (per sincronizzazione upgrade)
    if (systems.playerSystem && clientNetworkSystem) {
      clientNetworkSystem.setPlayerSystem(systems.playerSystem);
    }
    
    console.log('[PlayStateInitializer] initializeGame() completato');
    } catch (error) {
      console.error('[PlayStateInitializer] Errore in initializeGame():', error);
      throw error;
    }
  }

  /**
   * 🔧 FIX RACE CONDITION: Inizializza il sistema di rete con gestione sequenziale
   * per prevenire callback chiamati prima che i sistemi siano pronti
   */
  async initializeNetworkSystem(): Promise<void> {
    const clientNetworkSystem = this.getClientNetworkSystem();
    if (!clientNetworkSystem) {
      console.warn('[PlayStateInitializer] initializeNetworkSystem: ClientNetworkSystem non disponibile');
      return;
    }

    try {
      // Inizializza il sistema di rete
      console.log('[PlayStateInitializer] Chiamando clientNetworkSystem.initialize()...');
      await clientNetworkSystem.initialize();
      console.log('[PlayStateInitializer] clientNetworkSystem.initialize() completato');

      // Ora che il sistema è inizializzato, possiamo configurare i callback in sicurezza
      clientNetworkSystem.setOnPlayerIdReceived((playerId: number) => {
        const questManager = this.getQuestManager();
        const uiSystem = this.getUiSystem();
        if (questManager) {
          questManager.setPlayerId(playerId);
        }
        if (uiSystem) {
          uiSystem.setPlayerId(playerId);
        }
      });

      // Verifica se abbiamo già ricevuto il playerId (caso di riconnessione)
      if (clientNetworkSystem.isSystemInitialized() && clientNetworkSystem.gameContext.playerId) {
        // Richiama manualmente il callback per i sistemi che potrebbero essere stati inizializzati dopo
        const questManager = this.getQuestManager();
        const uiSystem = this.getUiSystem();
        if (questManager) {
          questManager.setPlayerId(clientNetworkSystem.gameContext.playerId);
        }
        if (uiSystem) {
          uiSystem.setPlayerId(clientNetworkSystem.gameContext.playerId);
        }
      }
    } catch (error) {
      console.error('❌ [PLAYSTATE] Network system initialization failed:', error);
    }
  }

  /**
   * Main entry point for PlayState initialization
   */
  async enter(): Promise<void> {
    console.log('[PlayState] enter() chiamato');
    
    // Assicurati che lo spinner sia visibile fin dall'inizio
    if (this.context.authScreen && typeof this.context.authScreen.updateLoadingText === 'function') {
      this.context.authScreen.updateLoadingText('Initializing game systems...');
    }
    
    // Crea UiSystem solo ora (quando si entra nel PlayState)
    let uiSystem = this.getUiSystem();
    if (!uiSystem) {
      console.log('[PlayState] Creando UiSystem...');
      const questSystem = this.getQuestSystem();
      if (!questSystem) {
        throw new Error('QuestSystem not available');
      }
      uiSystem = new UiSystem(this.world.getECS(), questSystem, this.context);
      this.setUiSystem(uiSystem);
      // Aggiorna il sistema di inizializzazione con l'UiSystem appena creato
      (this.gameInitSystem as any).uiSystem = uiSystem;
    }

    // Aggiorna il testo di loading durante l'inizializzazione
    if (this.context.authScreen && typeof this.context.authScreen.updateLoadingText === 'function') {
      this.context.authScreen.updateLoadingText('Loading multiplayer systems...');
    }
    
    console.log('[PlayState] Inizializzando sistemi multiplayer...');
    await this.initializeMultiplayerSystems();
    console.log('[PlayState] Sistemi multiplayer inizializzati');

    // Aggiorna il testo di loading durante l'inizializzazione del gioco
    if (this.context.authScreen && typeof this.context.authScreen.updateLoadingText === 'function') {
      this.context.authScreen.updateLoadingText('Initializing game world...');
    }

    try {
      console.log('[PlayState] Inizializzando gioco...');
      await this.initializeGame();
      console.log('[PlayState] Gioco inizializzato');
    } catch (error) {
      console.error('[PlayState] Failed to initialize game:', error);
      throw error;
    }

    // Aggiorna il testo di loading prima della connessione
    if (this.context.authScreen && typeof this.context.authScreen.updateLoadingText === 'function') {
      this.context.authScreen.updateLoadingText('Connecting to server...');
    } else {
      console.warn('[PlayState] AuthScreen non disponibile o updateLoadingText non disponibile!');
    }

    // Ora che tutti i sistemi sono collegati, connetti al server e ASPETTA
    const clientNetworkSystem = this.getClientNetworkSystem();
    if (clientNetworkSystem && typeof clientNetworkSystem.connectToServer === 'function') {
      try {
        console.log('[PlayState] Connessione al server...');
        await clientNetworkSystem.connectToServer();
        console.log('[PlayState] Connesso al server');
        
        // Aggiorna il testo durante l'attesa della risposta del server
        if (this.context.authScreen && typeof this.context.authScreen.updateLoadingText === 'function') {
          this.context.authScreen.updateLoadingText('Synchronizing with server...');
        }
        
        // Piccolo delay per dare tempo al server di processare la connessione
        console.log('[PlayState] Attendo 500ms per processare connessione...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Aggiorna il testo di loading dopo la connessione
        if (this.context.authScreen && typeof this.context.authScreen.updateLoadingText === 'function') {
          this.context.authScreen.updateLoadingText('Loading player data...');
        }
        console.log('[PlayState] Testo aggiornato a "Loading player data..."');
      } catch (error) {
        console.error('❌ [PLAYSTATE] Failed to connect to server:', error);
        // Continua comunque, ma mostra errore
        if (this.context.authScreen && typeof this.context.authScreen.updateLoadingText === 'function') {
          this.context.authScreen.updateLoadingText('Connection error. Retrying...');
        }
      }
    } else {
      console.warn('[PlayState] ClientNetworkSystem o connectToServer non disponibile!');
    }

    // Aspetta che RecentHonor sia disponibile prima di procedere
    console.log('[PlayState] Aspettando dati player (RecentHonor)...');
    await this.waitForPlayerDataReady();
    console.log('[PlayState] Dati player pronti!');

    // Nascondi lo spinner di loading (se ancora visibile)
    console.log('[PlayState] Nascondendo loading screen...');
    this.hideLoadingScreen();

    // SOLO ORA inizializza e mostra l'UI - dopo che lo spinner è nascosto
    console.log('[PlayState] Inizializzando UI system...');
    uiSystem = this.getUiSystem();
    if (uiSystem) {
      uiSystem.initialize();
      uiSystem.hideMainTitle();
      uiSystem.showPlayerInfo();
    }
    console.log('[PlayState] enter() completato');

    // Collega l'AudioSystem al ClientNetworkSystem ora che è stato creato
    const audioSystem = this.getAudioSystem();
    if (clientNetworkSystem && audioSystem) {
      clientNetworkSystem.setAudioSystem(audioSystem);
    }

    // Avvia musica di background e suoni ambientali
    if (audioSystem) {
      audioSystem.init();
      audioSystem.playMusic('background');
      // Piccolo delay prima di avviare ambience per evitare conflitti
      setTimeout(() => {
        if (audioSystem) {
          audioSystem.playMusic('ambience');
        }
      }, 100);
    }

    // Messaggio di benvenuto nella chat
    setTimeout(() => {
      if (uiSystem) {
        uiSystem.addSystemMessage('Welcome to Starfield! Use the chat to communicate.');
      }
    }, 1000);
  }
}
