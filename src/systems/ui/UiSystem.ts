import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { PlayerHUD } from '../../presentation/ui/PlayerHUD';
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
import { GameSettings } from '../../core/settings/GameSettings';
import { CONFIG } from '../../core/utils/config/GameConfig';

/**
 * Sistema di orchestrazione per la gestione dell'interfaccia utente
 * Coordina UIManager, HUD e pannelli UI
 * Uses modular architecture with separate managers for different responsibilities
 */
export class UiSystem extends System {
  // Modular architecture managers
  private panelManager!: UIPanelManager;
  private hudManager!: UIHUDManager;
  private chatManager!: UIChatManager;
  private nicknameManager!: UINicknameManager;
  private audioManager!: UIAudioManager;
  private fpsCounter!: FpsCounter;
  private safeZoneElement: HTMLElement | null = null;
  private managersInitialized: boolean = false;

  // Legacy references (maintained for backward compatibility)
  private context: any = null;
  private playerId: number | null = null;
  private mainTitleElement: HTMLElement | null = null;
  private hudToggleListener: ((event: KeyboardEvent) => void) | null = null;

  private questSystem: QuestSystem;

  constructor(ecs: ECS, questSystem: QuestSystem, context?: any, playerSystem?: PlayerSystem) {
    super(ecs);
    this.ecs = ecs;
    this.context = context;
    this.questSystem = questSystem;

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
          this.panelManager.setPlayerSystem(playerSystem);
          this.chatManager.setPlayerSystem(playerSystem);
        }
        if (clientNetworkSystem) {
          this.panelManager.setClientNetworkSystem(clientNetworkSystem);
          this.chatManager.setClientNetworkSystem(clientNetworkSystem);
        }
        return;
      }

      // Initialize HUD manager first (needs PlayerHUD)
      const playerHUD = new PlayerHUD();
      this.hudManager = new UIHUDManager(playerHUD);
      this.hudManager.setContext(this.context);

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
      this.panelManager.setupQuestPanelIntegration(() => this.panelManager.updatePanels());
      this.chatManager.initialize();

      // Setup listener per impostazioni
      this.setupSettingsListeners();
    } catch (error) {
      console.error('UI Error in UiSystem.initialize():', error);
      // Non bloccare l'esecuzione, sistema UI non funzionante ma app continua
    }
  }

  private setupSettingsListeners(): void {


    document.addEventListener('settings:ui:chat', (e: any) => {
      // Usa il nuovo metodo setChatVisibility per nascondere/mostrare tutto
      this.chatManager.setChatVisibility(e.detail);
    });

    document.addEventListener('settings:graphics:show_fps', (e: any) => {
      if (this.fpsCounter) {
        this.fpsCounter.setVisibility(e.detail);
      }
    });
  }

  /**
   * Imposta il riferimento all'EconomySystem
   */
  setEconomySystem(economySystem: any): void {
    this.hudManager.setEconomySystem(economySystem, (data) => this.hudManager.updatePlayerData(data));
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
    this.initializeManagers(this.ecs, this.questSystem, playerSystem, null);
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
  updatePlayerNicknamePosition(worldX: number, worldY: number, camera: any, canvasSize: any, isZoomAnimating: boolean = false): void {
    this.nicknameManager.updatePlayerNicknamePosition(worldX, worldY, camera, canvasSize, isZoomAnimating);
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
  ensureRemotePlayerNicknameElement(clientId: string, nickname: string, rank: string): void {
    this.nicknameManager.ensureRemotePlayerNicknameElement(clientId, nickname, rank);
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

  update(deltaTime: number): void {
    this.panelManager.updateRealtimePanels(deltaTime);
    // fpsCounter now updates itself using requestAnimationFrame
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
    this.showMainTitle();
    if (this.hudToggleListener) {
      document.removeEventListener('keydown', this.hudToggleListener);
    }
    this.chatManager.destroy();
    this.audioManager.destroy();
    if (this.fpsCounter) {
      this.fpsCounter.destroy();
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
}
