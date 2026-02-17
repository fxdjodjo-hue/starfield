import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { PlayerHUD } from '../../presentation/ui/PlayerHUD';
import { WeaponStatus } from '../../presentation/ui/WeaponStatus';
import { Minimap } from '../../presentation/ui/Minimap';
import { QuestTracker } from '../../presentation/ui/QuestTracker';
import { Damage } from '../../entities/combat/Damage';
import { QuestSystem } from '../quest/QuestSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { UpgradePanel } from '../../presentation/ui/UpgradePanel';

// Modular architecture managers
import { UIPanelManager } from './managers/UIPanelManager';
import { UIHUDManager } from './managers/UIHUDManager';
import { UIChatManager } from './managers/UIChatManager';
import { UINicknameManager } from './managers/UINicknameManager';
import { UIAudioManager } from './managers/UIAudioManager';
import { FpsCounter } from '../../presentation/ui/FpsCounter';
import { NetworkStatsDisplay } from '../../presentation/ui/NetworkStatsDisplay';
import { NotificationPopup } from '../../presentation/ui/NotificationPopup';
import { GameSettings } from '../../core/settings/GameSettings';
import { CONFIG } from '../../core/utils/config/GameConfig';

// ... existing imports ...

export class UiSystem extends System {
  // Modular architecture managers
  private panelManager!: UIPanelManager;
  private hudManager!: UIHUDManager;
  private weaponStatus!: WeaponStatus;
  private chatManager!: UIChatManager;
  private nicknameManager!: UINicknameManager;
  private audioManager!: UIAudioManager;
  private fpsCounter!: FpsCounter;
  private networkStats!: NetworkStatsDisplay;
  private notificationPopup!: NotificationPopup;
  private safeZoneElement: HTMLElement | null = null;
  private blackoutElement: HTMLElement | null = null;
  private blackoutVideoElement: HTMLVideoElement | null = null;
  private currentWarpSound: HTMLAudioElement | null = null;
  private managersInitialized: boolean = false;
  private isWormholeActive: boolean = false;
  private settingsListenersRegistered: boolean = false;
  private settingsChatListener: ((e: any) => void) | null = null;
  private settingsFpsListener: ((e: any) => void) | null = null;
  private systemMessageListener: ((e: any) => void) | null = null;

  // Legacy references (maintained for backward compatibility)
  private context: any = null;
  private playerId: number | null = null;
  private mainTitleElement: HTMLElement | null = null;
  private hudToggleListener: ((event: KeyboardEvent) => void) | null = null;

  private questSystem: QuestSystem;
  private playerSystem: PlayerSystem | null = null;

  constructor(ecs: ECS, questSystem: QuestSystem, context?: any, playerSystem?: PlayerSystem) {
    super(ecs);
    this.ecs = ecs;
    this.context = context;
    this.questSystem = questSystem;
    this.playerSystem = playerSystem || null;

    // Initialize managers
    this.initializeManagers(ecs, questSystem, playerSystem || null, null);
  }

  /**
   * Initializes managers with dependency injection
   */
  private initializeManagers(
    ecs: ECS,
    questSystem: QuestSystem,
    playerSystem: PlayerSystem | null,
    clientNetworkSystem: ClientNetworkSystem | null
  ): void {
    try {
      if (this.managersInitialized) {
        // Update existing managers if systems change
        if (playerSystem) {
          this.hudManager.setPlayerSystem(playerSystem);
          this.panelManager.setPlayerSystem(playerSystem);
          this.chatManager.setPlayerSystem(playerSystem);
        }
        if (clientNetworkSystem) {
          this.panelManager.setClientNetworkSystem(clientNetworkSystem);
          this.chatManager.setClientNetworkSystem(clientNetworkSystem);
          if (this.networkStats) {
            this.networkStats.setNetworkSystem(clientNetworkSystem);
          }
        }
        return;
      }

      // Initialize HUD manager first (needs PlayerHUD)
      const playerHUD = new PlayerHUD();
      const questTracker = new QuestTracker();
      this.weaponStatus = new WeaponStatus();
      this.hudManager = new UIHUDManager(playerHUD, questTracker, this.weaponStatus);
      this.hudManager.setContext(this.context);
      this.hudManager.setPlayerSystem(playerSystem);

      // Initialize panel manager
      this.panelManager = new UIPanelManager(ecs, questSystem, playerSystem, clientNetworkSystem);

      // Initialize chat manager
      this.chatManager = new UIChatManager(ecs, this.context, playerSystem);

      // Initialize nickname manager
      this.nicknameManager = new UINicknameManager();

      // Initialize audio manager
      this.audioManager = new UIAudioManager();

      // Initialize FPS counter
      this.fpsCounter = new FpsCounter();

      // Initialize Network Stats
      this.networkStats = new NetworkStatsDisplay();
      // Initialize Network Stats
      this.networkStats = new NetworkStatsDisplay();
      if (clientNetworkSystem) {
        this.networkStats.setNetworkSystem(clientNetworkSystem);
      }

      // Initialize Notification Popup
      this.notificationPopup = new NotificationPopup();

      // Apply saved settings
      const settings = GameSettings.getInstance();

      // Interface settings
      this.chatManager.setChatVisibility(settings.interface.showChat);
      // damage numbers setting is handled by DamageTextSystem, but we can emit event or handle it there
      // Checking if UiSystem handles damage numbers toggle? 
      // It listens to 'settings:ui:damage_numbers', but doesn't store state itself.
      // We should emit an event to synchronize systems or let them read settings.
      // But since we are here, we can set FPS visibility
      this.fpsCounter.setVisibility(settings.graphics.showFps);

      // Create Safe Zone indicator
      this.createSafeZoneIndicator();

      this.managersInitialized = true;
    } catch (error) {
      console.error('UI Error in UiSystem.initializeManagers():', error);
      // Non bloccare l'esecuzione, continua con fallback
    }
  }

  /**
   * Inizializza il sistema UI
   */
  initialize(): void {
    try {
      this.panelManager.initializePanels();
      this.panelManager.setupQuestPanelIntegration(() => this.panelManager.updatePanels());
      this.chatManager.initialize();

      // Setup listener per impostazioni
      this.setupSettingsListeners();

      // Preload warp sound
      if (!this.currentWarpSound) {
        this.currentWarpSound = new Audio('assets/teleport/warpSoundEffect.mp3');
        this.currentWarpSound.preload = 'auto';
        this.currentWarpSound.volume = 0.5;
        this.currentWarpSound.load(); // Force load
      }
    } catch (error) {
      console.error('UI Error in UiSystem.initialize():', error);
      // Non bloccare l'esecuzione, sistema UI non funzionante ma app continua
    }
  }

  private setupSettingsListeners(): void {
    if (this.settingsListenersRegistered) {
      return;
    }

    this.settingsChatListener = (e: any) => {
      // Usa il nuovo metodo setChatVisibility per nascondere/mostrare tutto
      this.chatManager.setChatVisibility(e.detail);
    };

    this.settingsFpsListener = (e: any) => {
      if (this.fpsCounter) {
        this.fpsCounter.setVisibility(e.detail);
      }
      // Network stats decoupled from FPS counter - kept hidden for production
      // if (this.networkStats) {
      //   this.networkStats.setVisibility(e.detail);
      // }
    };

    // Ascolta messaggi di sistema globali da qualsiasi componente
    this.systemMessageListener = (e: any) => {
      if (e.detail && typeof e.detail.content === 'string') {
        // Usa il popup invece della chat per messaggi di sistema critici
        if (this.notificationPopup) {
          this.notificationPopup.show(e.detail.content);
        } else {
          // Fallback se popup non pronto
          this.addSystemMessage(e.detail.content);
        }
      } else if (typeof e.detail === 'string') {
        if (this.notificationPopup) {
          this.notificationPopup.show(e.detail);
        }
      }
    };

    document.addEventListener('settings:ui:chat', this.settingsChatListener);
    document.addEventListener('settings:graphics:show_fps', this.settingsFpsListener);
    document.addEventListener('ui:system-message', this.systemMessageListener);
    this.settingsListenersRegistered = true;
  }

  private teardownSettingsListeners(): void {
    if (!this.settingsListenersRegistered) {
      return;
    }

    if (this.settingsChatListener) {
      document.removeEventListener('settings:ui:chat', this.settingsChatListener);
      this.settingsChatListener = null;
    }
    if (this.settingsFpsListener) {
      document.removeEventListener('settings:graphics:show_fps', this.settingsFpsListener);
      this.settingsFpsListener = null;
    }
    if (this.systemMessageListener) {
      document.removeEventListener('ui:system-message', this.systemMessageListener);
      this.systemMessageListener = null;
    }
    this.settingsListenersRegistered = false;
  }

  /**
   * Imposta il riferimento all'EconomySystem
   */
  setEconomySystem(economySystem: any): void {
    this.hudManager.setEconomySystem(
      economySystem,
      (data) => this.hudManager.updatePlayerData(data),
      (newRank) => {
        // Aggiorna il nickname con il nuovo rank
        const playerName = this.context?.playerNickname || 'Commander';
        const newNickname = `${playerName}\n[${newRank}]`;
        this.updatePlayerNicknameContent(newNickname);
      }
    );
  }

  /**
   * Imposta l'ID del player per l'HUD
   */
  setPlayerId(playerId: number): void {
    this.playerId = playerId;
    this.hudManager.setPlayerId(playerId);
  }

  /**
   * Imposta il sistema audio per i suoni UI
   */
  setAudioSystem(audioSystem: any): void {
    this.audioManager.setAudioSystem(audioSystem);
  }

  /**
   * Imposta il riferimento al PlayerSystem
   */
  setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
    this.initializeManagers(this.ecs, this.questSystem, playerSystem, null);
    this.hudManager.setPlayerSystem(playerSystem);
    this.panelManager.setPlayerSystem(playerSystem);
    this.chatManager.setPlayerSystem(playerSystem);
  }

  /**
   * Imposta il riferimento al ClientNetworkSystem
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.initializeManagers(this.ecs, this.questSystem, null, clientNetworkSystem);
    this.panelManager.setClientNetworkSystem(clientNetworkSystem);
    this.chatManager.setClientNetworkSystem(clientNetworkSystem);

    // Inject NetworkSystem into QuestSystem for objective sync
    if (this.questSystem) {
      this.questSystem.setClientNetworkSystem(clientNetworkSystem);
    }
  }

  /**
   * Resetta tutti gli stati di progresso degli upgrade nel UpgradePanel
   */
  public resetAllUpgradeProgress(): void {
    this.panelManager.resetAllUpgradeProgress();
  }

  /**
   * Mostra le informazioni del giocatore
   */
  showPlayerInfo(showChat: boolean = true): void {
    if (showChat) {
      this.hudManager.showPlayerInfo(() => this.chatManager.show());
    } else {
      this.hudManager.showPlayerInfo();
    }
  }

  /**
   * Mostra il tracker delle quest
   */
  showQuestTracker(): void {
    const questTracker = this.hudManager.getQuestTracker();
    if (questTracker && typeof questTracker.show === 'function') {
      questTracker.show();
    }
  }

  /**
   * Mostra la chat
   */
  showChat(): void {
    if (this.chatManager && typeof this.chatManager.show === 'function') {
      this.chatManager.show();
    }
  }

  /**
   * Aggiorna i dati del giocatore ricevuti dal server
   */
  updatePlayerData(data: any): void {
    this.hudManager.updatePlayerData(data);
  }

  /**
   * Nasconde le informazioni del giocatore
   */
  hidePlayerInfo(): void {
    this.hudManager.hidePlayerInfo();
  }

  /**
   * Mostra l'HUD espanso
   */
  showExpandedHud(): void {
    this.hudManager.showExpandedHud();
  }

  /**
   * Nasconde l'HUD espanso
   */
  hideExpandedHud(): void {
    this.hudManager.hideExpandedHud();
  }

  /**
   * Imposta lo stato della Safe Zone nell'HUD (centrato in alto)
   */
  setSafeZone(isSafe: boolean): void {
    if (this.safeZoneElement) {
      const safeIndicator = document.getElementById('safe-zone-text-indicator');

      if (isSafe) {
        if (safeIndicator) safeIndicator.style.display = 'block';
        this.safeZoneElement.style.display = 'flex';

        requestAnimationFrame(() => {
          if (this.safeZoneElement) {
            this.safeZoneElement.style.opacity = '1';
          }
        });
      } else {
        this.safeZoneElement.style.opacity = '0';

        // ASPETTA che la dissolvenza finisca prima di togliere il display
        // Questo evita che SAFEZONE sparisca di scatto
        setTimeout(() => {
          if (this.safeZoneElement && this.safeZoneElement.style.opacity === '0') {
            this.safeZoneElement.style.display = 'none';
            if (safeIndicator) safeIndicator.style.display = 'none';
          }
        }, 850); // Leggermente più della transizione (0.8s)
      }
    }
  }

  /**
   * Mostra il nome della mappa durante la transizione (cambio mappa via portale)
   */
  showMapTransitionName(mapName: string, displayDuration: number = 3000): void {
    // Trasforma mapId in nome display
    const displayName = this.getMapDisplayName(mapName);

    // Aggiorna l'elemento del nome mappa
    const mapNameElement = document.getElementById('map-name-indicator');
    if (mapNameElement) {
      mapNameElement.textContent = displayName;
    }

    // Mostra temporaneamente l'indicatore (senza SAFEZONE)
    if (this.safeZoneElement) {
      const safeIndicator = document.getElementById('safe-zone-text-indicator');
      if (safeIndicator) safeIndicator.style.display = 'none'; // Nascondi SAFEZONE durante transizione

      this.safeZoneElement.style.display = 'flex';

      requestAnimationFrame(() => {
        if (this.safeZoneElement) {
          this.safeZoneElement.style.opacity = '1';
        }
      });

      // Nascondi dopo la durata specificata
      setTimeout(() => {
        if (this.safeZoneElement) {
          this.safeZoneElement.style.opacity = '0';
          setTimeout(() => {
            if (this.safeZoneElement && this.safeZoneElement.style.opacity === '0') {
              this.safeZoneElement.style.display = 'none';
            }
          }, 850);
        }
      }, displayDuration);
    }

    // console.log(`[UiSystem] Showing map transition: ${displayName}`);
  }

  /**
   * Crea l'overlay nero per le transizioni
   */
  private createBlackoutOverlay(): void {
    if (this.blackoutElement) return;

    this.blackoutElement = document.createElement('div');
    this.blackoutElement.id = 'transition-blackout';
    this.blackoutElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: #000;
      z-index: 20000; /* Sopra a tutto, inclusi death popup (10000) */
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
    `;
    document.body.appendChild(this.blackoutElement);
  }

  /**
   * Oscura lo schermo (fade out)
   */
  fadeToBlack(duration: number = 300): void {
    if (!this.blackoutElement) this.createBlackoutOverlay();

    if (this.blackoutElement) {
      this.blackoutElement.style.transition = `opacity ${duration}ms ease-in-out`;
      // Force reflow
      void this.blackoutElement.offsetWidth;
      this.blackoutElement.style.opacity = '1';
    }
  }

  /**
   * Ritorna alla visione normale (fade in)
   */
  fadeFromBlack(duration: number = 800, delay: number = 500): void {
    if (!this.blackoutElement) return;

    setTimeout(() => {
      if (this.blackoutElement) {
        this.blackoutElement.style.transition = `opacity ${duration}ms ease-in-out`;
        this.blackoutElement.style.opacity = '0';
      }
    }, delay);
  }

  /**
   * Crea l'elemento video per l'overlay wormhole
   */
  private createVideoOverlay(): void {
    if (this.blackoutVideoElement) return;

    this.blackoutVideoElement = document.createElement('video');
    this.blackoutVideoElement.id = 'transition-video';
    this.blackoutVideoElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      z-index: 998; /* Stesso livello del blackout */
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.5s ease-in-out;
      background-color: black;
    `;
    // Pre-load settings
    this.blackoutVideoElement.src = 'assets/teleport/footagecrate-space-slipstream-loop.mp4';
    this.blackoutVideoElement.muted = false; // Suono attivo per effetto wow
    this.blackoutVideoElement.loop = true; // Abilita loop per sicurezza dato che è un loop video
    this.blackoutVideoElement.preload = 'auto'; // Precarica per essere pronto
    // Importante: alcune policy browser bloccano autoplay non mutato, ma in-game user interaction c'è già stata

    document.body.appendChild(this.blackoutVideoElement);
  }

  /**
   * Avvia la riproduzione del suono warp
   * Safe da chiamare più volte (controlla se già in riproduzione)
   */
  public playWarpSound(): void {
    try {
      // Inizializza istanza singola se non esiste (Singleton pattern per questo suono)
      if (!this.currentWarpSound) {
        this.currentWarpSound = new Audio('assets/teleport/warpSoundEffect.mp3');
        this.currentWarpSound.preload = 'auto'; // Assicura caricamento
      }

      const audio = this.currentWarpSound;

      // Se è già in riproduzione e non è vicino alla fine, non riavviarlo
      // Questo evita il salto audio se chiamato più volte durante la transizione (es. da MapChangeHandler)
      if (!audio.paused && audio.currentTime < audio.duration - 0.5 && audio.volume > 0.1) {
        return;
      }

      // Se stava finendo o era in pausa, resetta e riparti
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.5; // Volume bilanciato

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.warn('Warp sound play failed:', e));
      }

      // Limit to max 5 seconds as requested (fading out last second)
      setTimeout(() => {
        if (this.currentWarpSound && !this.currentWarpSound.paused) {
          this.fadeToSilence(this.currentWarpSound, 1000);
        }
      }, 4000);

    } catch (e) {
      console.warn('Error creating/playing warp audio:', e);
    }
  }

  /**
   * Avvia la modalità Warp Layered (Video DIETRO, Nave SOPRA)
   */
  public startWarpMode(): void {
    if (this.isWormholeActive) return;
    this.isWormholeActive = true;

    // 1. Assicura che il video esista
    if (!this.blackoutVideoElement) {
      this.createVideoOverlay();
    }

    if (this.blackoutVideoElement) {
      // 2. Configura per stare DIETRO al gioco
      this.blackoutVideoElement.style.zIndex = '-1';
      this.blackoutVideoElement.style.opacity = '1';
      this.blackoutVideoElement.style.display = 'block';

      // Enforce full screen coverage (Fix for "half screen" issue)
      this.blackoutVideoElement.style.position = 'fixed';
      this.blackoutVideoElement.style.top = '0';
      this.blackoutVideoElement.style.left = '0';
      this.blackoutVideoElement.style.width = '100vw'; // Use vw/vh for safer fullscreen
      this.blackoutVideoElement.style.height = '100vh';
      this.blackoutVideoElement.style.objectFit = 'cover';

      // 3. Play
      this.blackoutVideoElement.play().catch(e => console.warn('Video play failed:', e));
    }

    // 4. Suono
    this.playWarpSound();

    // 5. HUD? Possiamo lasciarlo o nasconderlo.
    // Per immersione totale, meglio nascondere l'HUD ma lasciare la nave
    this.setHudVisibility(false);
  }

  /**
   * Ferma la modalità Warp
   */
  public stopWarpMode(duration: number = 1000): void {
    if (!this.isWormholeActive) return;
    this.isWormholeActive = false;

    // Fade out video
    if (this.blackoutVideoElement) {
      this.blackoutVideoElement.style.transition = `opacity ${duration}ms ease-in-out`;
      this.blackoutVideoElement.style.opacity = '0';

      setTimeout(() => {
        if (this.blackoutVideoElement) {
          this.blackoutVideoElement.pause();
          this.blackoutVideoElement.style.display = 'none';
          // Reset z-index per non interferire
          this.blackoutVideoElement.style.zIndex = '998';
        }
      }, duration);
    }

    // Fade out audio
    if (this.currentWarpSound) {
      // ... existing audio fade logic ...
      const audio = this.currentWarpSound;
      const startVolume = audio.volume;
      const steps = 20;
      const volStep = startVolume / steps;
      const stepTime = duration / steps;

      const fadeInterval = setInterval(() => {
        if (audio.volume > volStep) {
          audio.volume -= volStep;
        } else {
          audio.volume = 0;
          audio.pause();
          clearInterval(fadeInterval);
        }
      }, stepTime);
    }

    // Restore System
    setTimeout(() => {
      const portalSystem = this.ecs.getSystems().find((s: any) => s.constructor.name === 'PortalSystem') as any;
      if (portalSystem && typeof portalSystem.setSoundsDisabled === 'function') {
        portalSystem.setSoundsDisabled(false);
      }
      this.setHudVisibility(true);
      document.dispatchEvent(new CustomEvent('uiPanelClosed'));
    }, duration);
  }

  /**
   * Avvia la transizione video wormhole -- ORA SOLO BLACK FADE (Legacy/Fallback)
   */
  playWormholeTransition(duration: number = 500): void {
    // ... existing logic ...
    // Manteniamo questo metodo per compatibilità o fallback
    if (this.isWormholeActive) return;
    this.isWormholeActive = true;
    this.playWarpSound();
    this.setHudVisibility(false);
    this.fadeToBlack(duration);
  }

  /**
   * Ferma l'effetto wormhole (dissolvenza) - ORA FADE FROM BLACK
   */
  stopWormholeTransition(duration: number = 1000): void {
    // ... existing logic ...
    if (typeof this.stopWarpMode === 'function' && this.blackoutVideoElement && this.blackoutVideoElement.style.opacity === '1') {
      // Se siamo in Warp Mode video, usa stopWarpMode
      this.stopWarpMode(duration);
      return;
    }

    // Altrimenti usa logica fade black standard
    if (!this.isWormholeActive) return;
    this.isWormholeActive = false;
    this.fadeFromBlack(duration);

    // ... audio fade logic duplicated/shared ...
    if (this.currentWarpSound) {
      const audio = this.currentWarpSound;
      const startVolume = audio.volume;
      const audioFadeDuration = 2500;
      const fadeStep = 50;
      const steps = audioFadeDuration / fadeStep;
      const volStep = startVolume / steps;

      const fadeInterval = setInterval(() => {
        if (audio.paused || audio !== this.currentWarpSound) {
          clearInterval(fadeInterval);
          return;
        }
        if (audio.volume > volStep) {
          audio.volume = Math.max(0, audio.volume - volStep);
        } else {
          audio.volume = 0;
          audio.pause();
          clearInterval(fadeInterval);
        }
      }, fadeStep);
    }

    setTimeout(() => {
      const portalSystem = this.ecs.getSystems().find((s: any) => s.constructor.name === 'PortalSystem') as any;
      if (portalSystem && typeof portalSystem.setSoundsDisabled === 'function') {
        portalSystem.setSoundsDisabled(false);
      }
      this.setHudVisibility(true);
      document.dispatchEvent(new CustomEvent('uiPanelClosed'));
    }, duration);
  }

  /**
   * Imposta la visibilità di tutta l'interfaccia utente (HUD, Chat, Minimappa)
   */
  private setHudVisibility(visible: boolean): void {
    if (visible) {
      // Show
      if (this.hudManager) this.hudManager.showHud();

      // Restore settings-based visibility for optional elements
      const settings = GameSettings.getInstance();
      if (this.chatManager) this.chatManager.setChatVisibility(settings.interface.showChat);
      if (this.fpsCounter) this.fpsCounter.setVisibility(settings.graphics.showFps);

      // Show Minimap (via System interactions)
      const minimapSystem = this.ecs.getSystems().find((s: any) => s.constructor.name === 'MinimapSystem') as any;
      if (minimapSystem && typeof minimapSystem.show === 'function') {
        minimapSystem.show();
      }

      // Show Player Status Display (HP/Shield)
      const playerStatusSystem = this.ecs.getSystems().find((s: any) => s.constructor.name === 'PlayerStatusDisplaySystem') as any;
      if (playerStatusSystem && typeof playerStatusSystem.show === 'function') {
        playerStatusSystem.show();
      }

      // Show Floating Icons (Inventory, Settings, etc.)
      if (this.panelManager) {
        this.panelManager.setIconsVisibility(true);
      }

      // Show Network Stats if enabled
      if (this.networkStats) this.networkStats.show();

    } else {
      // Hide
      if (this.hudManager) this.hudManager.hidePlayerInfo();
      if (this.chatManager) this.chatManager.setChatVisibility(false);
      if (this.fpsCounter) this.fpsCounter.setVisibility(false);

      // Hide Minimap
      const minimapSystem = this.ecs.getSystems().find((s: any) => s.constructor.name === 'MinimapSystem') as any;
      if (minimapSystem && typeof minimapSystem.hide === 'function') {
        minimapSystem.hide();
      }

      // Hide Player Status Display
      const playerStatusSystem = this.ecs.getSystems().find((s: any) => s.constructor.name === 'PlayerStatusDisplaySystem') as any;
      if (playerStatusSystem && typeof playerStatusSystem.hide === 'function') {
        playerStatusSystem.hide();
      }

      // Hide Floating Icons
      if (this.panelManager) {
        this.panelManager.setIconsVisibility(false);
      }

      // Hide Network Stats
      if (this.networkStats) this.networkStats.hide();
    }
  }

  /**
   * Converte l'ID della mappa in un nome display leggibile
   */
  public getMapDisplayName(mapId: string): string {
    const mapNames: Record<string, string> = {
      'palantir': 'PALANTIR',
      'singularity': 'SINGULARITY'
    };
    return mapNames[mapId] || mapId.toUpperCase();
  }

  /**
   * Aggiorna l'indicatore della mappa (senza animazioni di transizione)
   */
  public updateMapIndicator(mapId: string): void {
    const displayName = this.getMapDisplayName(mapId);
    const mapNameElement = document.getElementById('map-name-indicator');
    if (mapNameElement) {
      mapNameElement.textContent = displayName;
    }
    // console.log(`[UiSystem] Map indicator updated to: ${displayName}`);
  }

  /**
   * Crea l'elemento DOM per l'indicatore della mappa e Safe Zone centrato
   */
  private createSafeZoneIndicator(): void {
    if (this.safeZoneElement) return;

    // Container per le info sulla posizione globale
    this.safeZoneElement = document.createElement('div');
    this.safeZoneElement.id = 'world-location-indicator';

    // Stile minimalista centrato in alto - Più in basso e più grande
    this.safeZoneElement.style.cssText = `
      position: fixed;
      top: 100px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      z-index: 999;
      pointer-events: none;
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.8s ease-in-out;
    `;

    // Nome della mappa - Molto più grande
    const mapName = document.createElement('div');
    mapName.id = 'map-name-indicator';
    mapName.textContent = CONFIG.CURRENT_MAP.toUpperCase();
    mapName.style.cssText = `
      color: #ffffff;
      font-family: 'Segoe UI', Roboto, sans-serif;
      font-size: 32px;
      font-weight: 200;
      letter-spacing: 12px;
      text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8);
      margin-left: 12px; /* Compensa l'ultimo spacing */
    `;

    // Testo SAFEZONE - Più grande e grassetto
    const safeZoneText = document.createElement('div');
    safeZoneText.id = 'safe-zone-text-indicator';
    safeZoneText.textContent = 'SAFEZONE';
    safeZoneText.style.cssText = `
      color: #ffffff;
      font-family: 'Segoe UI', Roboto, sans-serif;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 6px;
      margin-top: 2px;
      text-shadow: 0 0 15px rgba(255, 255, 255, 0.4);
      opacity: 0.8;
      margin-left: 6px;
    `;

    this.safeZoneElement.appendChild(mapName);
    this.safeZoneElement.appendChild(safeZoneText);
    document.body.appendChild(this.safeZoneElement);
  }

  /**
   * Imposta il listener per il toggle dell'HUD
   */
  setupHudToggle(): void {
    this.hudToggleListener = this.hudManager.setupHudToggle();
  }

  createPlayerNicknameElement(nickname: string): void {
    this.nicknameManager.createPlayerNicknameElement(nickname);
  }
  updatePlayerNicknameContent(nickname: string): void {
    this.nicknameManager.updatePlayerNicknameContent(nickname);
  }
  setPlayerLeaderboardPodiumRank(rank: number): void {
    this.nicknameManager.setPlayerLeaderboardPodiumRank(rank);
  }
  updatePlayerNicknamePosition(worldX: number, worldY: number, camera: any, canvasSize: any, isZoomAnimating: boolean = false, isVisible: boolean = true): void {
    this.nicknameManager.updatePlayerNicknamePosition(worldX, worldY, camera, canvasSize, isZoomAnimating, isVisible);
  }
  removePlayerNicknameElement(): void {
    this.nicknameManager.removePlayerNicknameElement();
  }
  hideMainTitle(): void {
    this.mainTitleElement = document.getElementById('main-title');
    if (this.mainTitleElement) {
      this.mainTitleElement.style.display = 'none';
    }
  }
  showMainTitle(): void {
    if (this.mainTitleElement) {
      this.mainTitleElement.style.display = 'block';
    }
  }
  updatePanels(): void {
    this.panelManager.updatePanels();
  }
  getUIManager(): any {
    return this.panelManager.getUIManager();
  }

  /**
   * Mostra le icone dei pannelli UI
   */
  showPanelIcons(): void {
    const uiManager = this.panelManager.getUIManager();
    if (uiManager && typeof uiManager.showUI === 'function') {
      uiManager.showUI();
    }
  }
  getPlayerHUD(): PlayerHUD {
    return this.hudManager.getPlayerHUD();
  }

  getWeaponStatus(): WeaponStatus {
    return this.weaponStatus;
  }

  // ===== GESTIONE NICKNAME NPC =====
  ensureNpcNicknameElement(entityId: number, npcType: string, behavior: string): void {
    this.nicknameManager.ensureNpcNicknameElement(entityId, npcType, behavior);
  }
  updateNpcNicknameContent(entityId: number, npcType: string, behavior: string): void {
    this.nicknameManager.updateNpcNicknameContent(entityId, npcType, behavior);
  }
  updateNpcNicknamePosition(entityId: number, screenX: number, screenY: number): void {
    this.nicknameManager.updateNpcNicknamePosition(entityId, screenX, screenY);
  }
  removeNpcNicknameElement(entityId: number): void {
    this.nicknameManager.removeNpcNicknameElement(entityId);
  }
  removeAllNpcNicknameElements(): void {
    this.nicknameManager.removeAllNpcNicknameElements();
  }
  getNpcNicknameEntityIds(): number[] {
    return this.nicknameManager.getNpcNicknameEntityIds();
  }

  // ===== GESTIONE NICKNAME REMOTE PLAYER =====
  ensureRemotePlayerNicknameElement(clientId: string, nickname: string, rank: string, leaderboardPodiumRank?: number): void {
    this.nicknameManager.ensureRemotePlayerNicknameElement(clientId, nickname, rank, leaderboardPodiumRank);
  }
  updateRemotePlayerNicknamePosition(clientId: string, screenX: number, screenY: number): void {
    this.nicknameManager.updateRemotePlayerNicknamePosition(clientId, screenX, screenY);
  }
  removeRemotePlayerNicknameElement(clientId: string): void {
    this.nicknameManager.removeRemotePlayerNicknameElement(clientId);
  }
  removeAllRemotePlayerNicknameElements(): void {
    this.nicknameManager.removeAllRemotePlayerNicknameElements();
  }
  getRemotePlayerNicknameClientIds(): string[] {
    return this.nicknameManager.getRemotePlayerNicknameClientIds();
  }

  // ===== GESTIONE NICKNAME PET =====
  ensurePetNicknameElement(entityId: number, petNickname: string): void {
    this.nicknameManager.ensurePetNicknameElement(entityId, petNickname);
  }
  updatePetNicknameContent(entityId: number, petNickname: string): void {
    this.nicknameManager.updatePetNicknameContent(entityId, petNickname);
  }
  updatePetNicknamePosition(entityId: number, screenX: number, screenY: number): void {
    this.nicknameManager.updatePetNicknamePosition(entityId, screenX, screenY);
  }
  removePetNicknameElement(entityId: number): void {
    this.nicknameManager.removePetNicknameElement(entityId);
  }
  removeAllPetNicknameElements(): void {
    this.nicknameManager.removeAllPetNicknameElements();
  }
  getPetNicknameEntityIds(): number[] {
    return this.nicknameManager.getPetNicknameEntityIds();
  }

  update(deltaTime: number): void {
    this.panelManager.updateRealtimePanels(deltaTime);
    this.hudManager.updatePlayerCombatStatus();

    // Aggiorna progress cooldown armi nell'HUD
    const playerEntity = this.playerSystem?.getPlayerEntity();
    if (playerEntity) {
      const damage = this.ecs.getComponent(playerEntity, Damage) as Damage;
      if (damage) {
        const now = Date.now();

        // Laser progress (0.0 to 1.0)
        const laserElapsed = now - (damage.lastAttackTime || 0);
        const laserProgress = damage.attackCooldown > 0 ? Math.min(1, laserElapsed / damage.attackCooldown) : 1;
        const laserRemaining = damage.getCooldownRemaining(now);

        // Missile progress (0.0 to 1.0)
        const missileElapsed = now - (damage.lastMissileTime || 0);
        const missileProgress = damage.missileCooldown > 0 ? Math.min(1, missileElapsed / damage.missileCooldown) : 1;
        const missileRemaining = damage.getMissileCooldownRemaining(now);

        this.hudManager.updateWeaponCooldowns(laserProgress, missileProgress, laserRemaining, missileRemaining);
      }
    }
  }
  public getUpgradePanel(): UpgradePanel | null {
    return this.panelManager.getUpgradePanel();
  }
  addSystemMessage(message: string): void {
    this.chatManager.addSystemMessage(message);
  }
  setChatMultiplayerMode(enabled: boolean, playerId?: string): void {
    this.chatManager.setMultiplayerMode(enabled, playerId);
  }
  getChatManager(): any {
    return this.chatManager.getChatManager();
  }
  onChatMessageSent(callback: (message: any) => void): void {
    this.chatManager.onMessageSent(callback);
  }
  receiveChatMessage(message: any): void {
    this.chatManager.receiveMessage(message);
  }
  simulateChatMessage(content: string, senderName?: string): void {
    this.chatManager.simulateMessage(content, senderName);
  }
  getChatStatus(): any {
    return this.chatManager.getStatus();
  }
  destroy(): void {
    this.nicknameManager.removePlayerNicknameElement();
    this.nicknameManager.removeAllNpcNicknameElements();
    this.nicknameManager.removeAllRemotePlayerNicknameElements();
    this.nicknameManager.removeAllPetNicknameElements();
    this.showMainTitle();
    if (this.hudToggleListener) {
      document.removeEventListener('keydown', this.hudToggleListener);
    }
    this.teardownSettingsListeners();
    if (this.panelManager && typeof this.panelManager.destroy === 'function') {
      this.panelManager.destroy();
    }
    this.chatManager.destroy();
    this.audioManager.destroy();
    if (this.fpsCounter) {
      this.fpsCounter.destroy();
    }
    if (this.networkStats) {
      this.networkStats.destroy();
    }
    if (this.weaponStatus) {
      this.weaponStatus.destroy();
    }
  }

  // ========== REMOVED METHODS - Now in managers ==========
  // All private methods have been extracted to managers:
  // - initializePanels() -> UIPanelManager.initializePanels()
  // - setupQuestPanelIntegration() -> UIPanelManager.setupQuestPanelIntegration()
  // - initializeChat() -> UIChatManager.initialize()
  // - showPlayerInfo() -> UIHUDManager.showPlayerInfo()
  // - updatePlayerData() -> UIHUDManager.updatePlayerData()
  // - setupUIClickSounds() -> UIAudioManager.setupUIClickSounds()
  // - setupMutationObserver() -> UIAudioManager.setupMutationObserver()
  // - toggleHud() -> UIHUDManager.toggleHud()
  // - All nickname methods -> UINicknameManager
  // - All chat methods -> UIChatManager
  /**
   * Helper to fade out audio element
   */
  private fadeToSilence(audio: HTMLAudioElement, duration: number): void {
    const startVolume = audio.volume;
    const steps = 20;
    const volStep = startVolume / steps;
    const stepTime = duration / steps;

    const fadeInterval = setInterval(() => {
      if (audio.volume > volStep) {
        audio.volume -= volStep;
      } else {
        audio.volume = 0;
        audio.pause();
        clearInterval(fadeInterval);
      }
    }, stepTime);
  }
}
