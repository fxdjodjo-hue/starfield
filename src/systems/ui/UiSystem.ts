import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { UIManager } from '../../presentation/ui/UIManager';
import { PlayerHUD } from '../../presentation/ui/PlayerHUD';
import { PlayerStatsPanel } from '../../presentation/ui/PlayerStatsPanel';
import { QuestPanel } from '../../presentation/ui/QuestPanel';
import { SkillsPanel } from '../../presentation/ui/SkillsPanel';
import { ChatPanel } from '../../presentation/ui/ChatPanel';
import { ChatManager } from './ChatManager';
import { getPanelConfig } from '../../presentation/ui/PanelConfig';
import { QuestSystem } from '../quest/QuestSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';

/**
 * Sistema di orchestrazione per la gestione dell'interfaccia utente
 * Coordina UIManager, HUD e pannelli UI
 */
export class UiSystem extends System {
  private uiManager: UIManager;
  private playerHUD: PlayerHUD;
  private chatPanel: ChatPanel;
  private chatManager: ChatManager;
  private questSystem: QuestSystem;
  private skillsPanel: SkillsPanel | null = null;
  private playerSystem: PlayerSystem | null = null;
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private economySystem: any = null;
  private audioSystem: any = null;
  private playerNicknameElement: HTMLElement | null = null;
  private mainTitleElement: HTMLElement | null = null;
  private context: any = null;

  // Gestione nickname NPC (da PlayState)
  private npcNicknameElements: Map<number, HTMLElement> = new Map();

  // Gestione nickname remote player (da PlayState)
  private remotePlayerNicknameElements: Map<string, HTMLElement> = new Map();

  constructor(ecs: ECS, questSystem: QuestSystem, context?: any, playerSystem?: PlayerSystem) {
    super(ecs);
    this.ecs = ecs;
    this.context = context;
    this.uiManager = new UIManager();
    this.playerHUD = new PlayerHUD();
    this.chatPanel = new ChatPanel(this.ecs, this.context, this.playerSystem || undefined);
    this.chatManager = new ChatManager(this.chatPanel, this.context);
    this.questSystem = questSystem;
    this.playerSystem = playerSystem || null;
  }

  /**
   * Imposta il riferimento all'EconomySystem
   */
  setEconomySystem(economySystem: any): void {
    this.economySystem = economySystem;
  }

  /**
   * Imposta il sistema audio per i suoni UI
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
    this.setupUIClickSounds();
  }

  /**
   * Configura suoni click per tutti gli elementi UI interattivi
   */
  private setupUIClickSounds(): void {
    // Selettori estesi per catturare tutti gli elementi interattivi
    const selectors = [
      'button',           // Tutti i pulsanti
      '.ui-panel button', // Pulsanti nei pannelli
      '.clickable',       // Elementi con classe clickable
      '[role="button"]',  // Elementi con role button
      '.ui-floating-icon', // Icone flottanti (principale!)
      '.upgrade-button',  // Pulsanti upgrade nel skills panel
      '.hud-icon',        // Icone HUD
      '.panel-icon',      // Icone pannelli
      '.ui-icon',         // Icone UI generiche
      '[data-clickable="true"]', // Elementi con attributo data
      '.icon-button',     // Pulsanti a forma di icona
      '[onclick]',        // Elementi con onclick
      '.interactive'      // Elementi interattivi
    ];

    const selectorString = selectors.join(', ');
    const clickableElements = document.querySelectorAll(selectorString);

    clickableElements.forEach(element => {
      // Evita duplicati se già ha il listener
      if (!(element as any)._uiClickSoundAdded) {
        element.addEventListener('click', (event) => {
          // Evita suoni per elementi disabilitati
          if ((event.target as HTMLElement).hasAttribute('disabled') ||
              (event.target as HTMLElement).classList.contains('disabled')) {
            return;
          }

          if (this.audioSystem) {
            this.audioSystem.playSound('click', 0.3, false, true, 'ui');
          }
        });
        (element as any)._uiClickSoundAdded = true;
      }
    });

    // Osserva per nuovi elementi aggiunti dinamicamente
    this.setupMutationObserver();
  }

  /**
   * Osserva cambiamenti DOM per aggiungere suoni ai nuovi elementi
   */
  private setupMutationObserver(): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            // Selettori estesi per nuovi elementi
            const selectors = [
              'button', '.ui-panel button', '.clickable', '[role="button"]',
              '.ui-floating-icon', '.upgrade-button', '.hud-icon', '.panel-icon',
              '.ui-icon', '[data-clickable="true"]', '.icon-button', '[onclick]', '.interactive'
            ];

            const selectorString = selectors.join(', ');
            const newClickableElements = element.querySelectorAll(selectorString);

            newClickableElements.forEach(clickableElement => {
              if (!(clickableElement as any)._uiClickSoundAdded) {
                clickableElement.addEventListener('click', (event) => {
                  // Evita suoni per elementi disabilitati
                  if ((event.target as HTMLElement).hasAttribute('disabled') ||
                      (event.target as HTMLElement).classList.contains('disabled')) {
                    return;
                  }

                  if (this.audioSystem) {
                    this.audioSystem.playSound('click', 0.3, false, true, 'ui');
                  }
                });
                (clickableElement as any)._uiClickSoundAdded = true;
              }
            });

            // Se l'elemento stesso è cliccabile
            const isClickable = selectors.some(selector => {
              if (selector.startsWith('.')) {
                return element.classList.contains(selector.substring(1));
              } else if (selector.startsWith('[')) {
                const attr = selector.substring(1, selector.indexOf('=') || selector.indexOf(']'));
                return element.hasAttribute(attr);
              } else {
                return element.tagName === selector.toUpperCase();
              }
            });

            if (isClickable && !(element as any)._uiClickSoundAdded) {
              element.addEventListener('click', (event) => {
                // Evita suoni per elementi disabilitati
                if ((event.target as HTMLElement).hasAttribute('disabled') ||
                    (event.target as HTMLElement).classList.contains('disabled')) {
                  return;
                }

                if (this.audioSystem) {
                  this.audioSystem.playSound('click', 0.3, false, true, 'ui');
                }
              });
              (element as any)._uiClickSoundAdded = true;
            }
          }
        });
      });
    });

    // Osserva tutto il documento per cambiamenti
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Imposta il riferimento al PlayerSystem
   */
  setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
    // Aggiorna anche i pannelli che ne hanno bisogno
    if (this.skillsPanel) {
      this.skillsPanel.setPlayerSystem(playerSystem);
      if (this.clientNetworkSystem) {
        this.skillsPanel.setClientNetworkSystem(this.clientNetworkSystem);
      }
    }
    if (this.chatPanel) {
      this.chatPanel.setPlayerSystem(playerSystem);
    }
  }

  /**
   * Imposta il riferimento al ClientNetworkSystem
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
    // Aggiorna anche i pannelli che ne hanno bisogno
    if (this.skillsPanel) {
      this.skillsPanel.setClientNetworkSystem(clientNetworkSystem);
    }
  }

  /**
   * Resetta tutti gli stati di progresso degli upgrade nel SkillsPanel
   */
  public resetAllUpgradeProgress(): void {
    if (this.skillsPanel && typeof this.skillsPanel.resetUpgradeProgress === 'function') {
      this.skillsPanel.resetUpgradeProgress();
    }
  }

  /**
   * Inizializza il sistema UI
   */
  initialize(): void {
    this.initializePanels();
    this.setupQuestPanelIntegration();
    this.initializeChat();
  }

  /**
   * Inizializza i pannelli UI
   */
  private initializePanels(): void {
    // Crea e registra il pannello delle statistiche giocatore
    const statsConfig = getPanelConfig('stats');
    const statsPanel = new PlayerStatsPanel(statsConfig);
    this.uiManager.registerPanel(statsPanel);

    // Crea e registra il pannello delle quest
    const questConfig = getPanelConfig('quest');
    const questPanel = new QuestPanel(questConfig);
    this.uiManager.registerPanel(questPanel);

    // Crea e registra il pannello delle skills
    const skillsConfig = getPanelConfig('skills');
    this.skillsPanel = new SkillsPanel(skillsConfig, this.ecs, this.playerSystem || undefined, this.clientNetworkSystem || undefined);
    this.uiManager.registerPanel(this.skillsPanel);

    // Collega il pannello quest al sistema quest
    this.questSystem.setQuestPanel(questPanel);
  }

  /**
   * Inizializza la chat
   */
  private initializeChat(): void {
    // Assicurati che il pannello chat sia nel DOM anche se nascosto
    if (!document.body.contains(this.chatPanel['container'])) {
      // Imposta gli stili per lo stato nascosto prima di aggiungere al DOM
      const container = this.chatPanel['container'];
      const headerHeight = this.chatPanel['header'].offsetHeight || 49;
      container.style.height = headerHeight + 'px';
      container.style.display = 'flex';
      this.chatPanel['messagesContainer'].style.display = 'none';
      this.chatPanel['inputContainer'].style.display = 'none';
      this.chatPanel['toggleButton'].textContent = '+';
      this.chatPanel['_isVisible'] = false;

      document.body.appendChild(container);
    }
  }

  /**
   * Imposta l'integrazione tra pannello quest e sistema quest
   */
  private setupQuestPanelIntegration(): void {
    const questPanel = this.uiManager.getPanel('quest-panel') as QuestPanel;
    if (questPanel) {
      // Sovrascrivi il metodo show per aggiornare dati prima di mostrare
      const originalShow = questPanel.show.bind(questPanel);
      questPanel.show = () => {
        originalShow();
        // Aggiorna l'UI con i dati attuali delle quest
        setTimeout(() => this.updatePanels(), 100);
      };
    }
  }

  /**
   * Mostra le informazioni del giocatore
   */
  showPlayerInfo(): void {
    // Ottieni i dati economici dal sistema
    const economyData = this.economySystem?.getPlayerEconomyStatus();

    if (economyData) {
      // Prepara i dati per l'HUD
      const hudData = {
        level: economyData.level,
        credits: economyData.credits,
        cosmos: economyData.cosmos,
        experience: economyData.experience,
        expForNextLevel: economyData.expForNextLevel,
        honor: economyData.honor
      };

      // Aggiorna e mostra l'HUD
      this.playerHUD.updateData(hudData);
      this.playerHUD.show();
    } else {
      // Mostra comunque l'HUD con valori di default
      const defaultData = {
        level: 1,
        credits: 0,
        cosmos: 0,
        experience: 0,
        expForNextLevel: 100,
        honor: 0
      };
      this.playerHUD.updateData(defaultData);
      this.playerHUD.show();
    }
  }

  /**
   * Nasconde le informazioni del giocatore
   */
  hidePlayerInfo(): void {
    this.playerHUD.hide();
  }

  /**
   * Mostra l'HUD espanso
   */
  showExpandedHud(): void {
    this.playerHUD.expand();
  }

  /**
   * Nasconde l'HUD espanso
   */
  hideExpandedHud(): void {
    this.playerHUD.collapse();
  }

  /**
   * Imposta il listener per il toggle dell'HUD
   */
  setupHudToggle(): void {
    const toggleHandler = (event: KeyboardEvent) => {
      if (event.key === 'h' || event.key === 'H') {
        this.toggleHud();
      }
    };

    document.addEventListener('keydown', toggleHandler);

    // Store reference for cleanup
    (this as any).hudToggleListener = toggleHandler;
  }

  /**
   * Toggle dell'HUD
   */
  private toggleHud(): void {
    if (this.playerHUD.isExpanded()) {
      this.hideExpandedHud();
    } else {
      this.showExpandedHud();
    }
  }

  /**
   * Crea l'elemento nickname del giocatore
   */
  createPlayerNicknameElement(nickname: string): void {
    if (this.playerNicknameElement) return;

    this.playerNicknameElement = document.createElement('div');
    this.playerNicknameElement.id = 'player-nickname-uisystem';
    this.playerNicknameElement.style.cssText = `
      position: fixed;
      color: rgba(255, 255, 255, 0.9);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-weight: 500;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      user-select: none;
      z-index: 50;
      text-align: center;
      line-height: 1.4;
      white-space: nowrap;
      border-radius: 5px;
    `;

    this.updatePlayerNicknameContent(nickname);
    document.body.appendChild(this.playerNicknameElement);

  }

  /**
   * Aggiorna il contenuto del nickname
   */
  updatePlayerNicknameContent(nickname: string): void {
    if (this.playerNicknameElement) {
      // Formatta il nickname su due righe: nome sopra, rank sotto
      const parts = nickname.split('\n');
      this.playerNicknameElement.innerHTML = `
        <div style="font-size: 14px; font-weight: 600;">${parts[0] || 'Commander'}</div>
        <div style="font-size: 12px; font-weight: 400; opacity: 0.8;">${parts[1] || '[Recruit]'}</div>
      `;
    }
  }

  /**
   * Aggiorna la posizione del nickname del giocatore basata sulla posizione world
   */
  updatePlayerNicknamePosition(worldX: number, worldY: number, camera: any, canvasSize: any): void {
    if (!this.playerNicknameElement) return;

    // Converte coordinate mondo in coordinate schermo
    const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

    // Forza la visibilità e ricalcola dimensioni
    this.playerNicknameElement.style.display = 'block';

    // Posiziona il nickname centrato orizzontalmente sotto la nave
    const nicknameX = screenPos.x - this.playerNicknameElement.offsetWidth / 2;
    const nicknameY = screenPos.y + 45; // Sotto la nave

    this.playerNicknameElement.style.left = `${nicknameX}px`;
    this.playerNicknameElement.style.top = `${nicknameY}px`;
    this.playerNicknameElement.style.transform = 'none';
    this.playerNicknameElement.style.display = 'block';


  }

  /**
   * Rimuove l'elemento nickname
   */
  removePlayerNicknameElement(): void {
    if (this.playerNicknameElement) {
      document.body.removeChild(this.playerNicknameElement);
      this.playerNicknameElement = null;
    }
  }

  /**
   * Nasconde il titolo principale
   */
  hideMainTitle(): void {
    this.mainTitleElement = document.getElementById('main-title');
    if (this.mainTitleElement) {
      this.mainTitleElement.style.display = 'none';
    }
  }

  /**
   * Mostra il titolo principale
   */
  showMainTitle(): void {
    if (this.mainTitleElement) {
      this.mainTitleElement.style.display = 'block';
    }
  }

  /**
   * Aggiorna tutti i pannelli UI
   */
  updatePanels(): void {
    const questData = this.questSystem.getQuestUIData();
    if (questData) {
      // Trigger update event
      const event = new CustomEvent('updateQuestPanel', { detail: questData });
      document.dispatchEvent(event);
    }
  }

  /**
   * Restituisce l'UIManager
   */
  getUIManager(): UIManager {
    return this.uiManager;
  }

  /**
   * Restituisce il PlayerHUD
   */
  getPlayerHUD(): PlayerHUD {
    return this.playerHUD;
  }

  // ===== GESTIONE NICKNAME NPC =====

  /**
   * Assicura che esista un elemento DOM per il nickname dell'NPC
   */
  ensureNpcNicknameElement(entityId: number, npcType: string): void {
    if (!this.npcNicknameElements.has(entityId)) {
      const element = document.createElement('div');
      element.id = `npc-nickname-${entityId}`;
      element.style.cssText = `
        position: fixed;
        color: rgba(255, 0, 0, 0.9);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 400;
        font-size: 12px;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
        pointer-events: none;
        user-select: none;
        z-index: 40;
        text-align: center;
        line-height: 1.2;
        white-space: nowrap;
        border-radius: 3px;
        padding: 2px 4px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;
      element.textContent = npcType;
      document.body.appendChild(element);
      this.npcNicknameElements.set(entityId, element);
    }
  }

  /**
   * Aggiorna la posizione dell'elemento DOM del nickname NPC
   */
  updateNpcNicknamePosition(entityId: number, screenX: number, screenY: number): void {
    const element = this.npcNicknameElements.get(entityId);
    if (element) {
      // Forza la visibilità e ricalcola dimensioni
      element.style.display = 'block';

      // Posiziona il nickname centrato orizzontalmente sotto l'NPC (come player)
      const nicknameX = screenX - element.offsetWidth / 2;
      const nicknameY = screenY + 45; // Sotto l'NPC

      element.style.left = `${nicknameX}px`;
      element.style.top = `${nicknameY}px`;
      element.style.transform = 'none';
      element.style.display = 'block';
    }
  }

  /**
   * Rimuove l'elemento DOM per il nickname di un NPC specifico
   */
  removeNpcNicknameElement(entityId: number): void {
    const element = this.npcNicknameElements.get(entityId);
    if (element) {
      document.body.removeChild(element);
      this.npcNicknameElements.delete(entityId);
    }
  }

  /**
   * Rimuove tutti gli elementi DOM dei nickname NPC
   */
  removeAllNpcNicknameElements(): void {
    for (const [entityId, element] of this.npcNicknameElements) {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.npcNicknameElements.clear();
  }

  /**
   * Ottiene gli entityId degli NPC che hanno elementi nickname attivi
   */
  getNpcNicknameEntityIds(): number[] {
    return Array.from(this.npcNicknameElements.keys());
  }

  // ===== GESTIONE NICKNAME REMOTE PLAYER =====

  /**
   * Assicura che esista un elemento DOM per il nickname del remote player
   */
  ensureRemotePlayerNicknameElement(clientId: string, nickname: string, rank: string): void {
    if (!this.remotePlayerNicknameElements.has(clientId)) {
      const element = document.createElement('div');
      element.id = `remote-player-nickname-${clientId}`;
      element.style.cssText = `
        position: fixed;
        color: rgba(255, 255, 255, 0.9);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-weight: 500;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
        pointer-events: none;
        user-select: none;
        z-index: 45;
        text-align: center;
        line-height: 1.4;
        white-space: nowrap;
        border-radius: 5px;
      `;

      // Formatta il nickname su due righe: nome sopra, rank sotto
      element.innerHTML = `
        <div style="font-size: 14px; font-weight: 600;">${nickname}</div>
        <div style="font-size: 12px; font-weight: 400; opacity: 0.8;">[${rank}]</div>
      `;

      document.body.appendChild(element);
      this.remotePlayerNicknameElements.set(clientId, element);
    } else {
      // Aggiorna il contenuto se già esiste
      const element = this.remotePlayerNicknameElements.get(clientId)!;
      element.innerHTML = `
        <div style="font-size: 14px; font-weight: 600;">${nickname}</div>
        <div style="font-size: 12px; font-weight: 400; opacity: 0.8;">[${rank}]</div>
      `;
    }
  }

  /**
   * Aggiorna la posizione dell'elemento DOM del nickname remote player
   */
  updateRemotePlayerNicknamePosition(clientId: string, screenX: number, screenY: number): void {
    const element = this.remotePlayerNicknameElements.get(clientId);
    if (element) {
      // Forza la visibilità e ricalcola dimensioni
      element.style.display = 'block';

      // Posiziona il nickname centrato orizzontalmente sotto il remote player
      const nicknameX = screenX - element.offsetWidth / 2;
      const nicknameY = screenY + 45; // Sotto il remote player

      element.style.left = `${nicknameX}px`;
      element.style.top = `${nicknameY}px`;
      element.style.transform = 'none';
      element.style.display = 'block';
    }
  }

  /**
   * Rimuove l'elemento DOM per il nickname di un remote player specifico
   */
  removeRemotePlayerNicknameElement(clientId: string): void {
    const element = this.remotePlayerNicknameElements.get(clientId);
    if (element) {
      document.body.removeChild(element);
      this.remotePlayerNicknameElements.delete(clientId);
    }
  }

  /**
   * Rimuove tutti gli elementi DOM dei nickname remote player
   */
  removeAllRemotePlayerNicknameElements(): void {
    for (const [clientId, element] of this.remotePlayerNicknameElements) {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.remotePlayerNicknameElements.clear();
  }

  /**
   * Ottiene i clientId dei remote player che hanno elementi nickname attivi
   */
  getRemotePlayerNicknameClientIds(): string[] {
    return Array.from(this.remotePlayerNicknameElements.keys());
  }

  update(deltaTime: number): void {
    // Aggiorna i pannelli che richiedono aggiornamenti periodici
    this.updateRealtimePanels(deltaTime);
  }

  /**
   * Aggiorna i pannelli che supportano aggiornamenti real-time
   */
  private updateRealtimePanels(deltaTime: number): void {
    // Aggiorna pannello Skills se ha il metodo updateECS
    const skillsPanel = this.uiManager.getPanel('skills-panel');
    if (skillsPanel && typeof (skillsPanel as any).updateECS === 'function') {
      (skillsPanel as any).updateECS(deltaTime);
    }

    // Altri pannelli possono essere aggiunti qui se necessario
  }

  /**
   * Ottiene il pannello Skills
   */
  public getSkillsPanel(): SkillsPanel | null {
    return this.uiManager.getPanel('skills-panel') as SkillsPanel;
  }

  /**
   * Aggiunge un messaggio di sistema alla chat
   */
  addSystemMessage(message: string): void {
    this.chatPanel.addSystemMessage(message);
  }

  /**
   * Metodi per il supporto multiplayer della chat
   */

  /**
   * Abilita/disabilita la modalità multiplayer
   */
  setChatMultiplayerMode(enabled: boolean, playerId?: string): void {
    this.chatManager.setMultiplayerMode(enabled, playerId);
  }

  /**
   * Registra un callback per i messaggi inviati (per invio alla rete)
   */
  onChatMessageSent(callback: (message: any) => void): void {
    this.chatManager.onMessageSent(callback);
  }

  /**
   * Riceve un messaggio dalla rete (multiplayer)
   */
  receiveChatMessage(message: any): void {
    this.chatManager.receiveNetworkMessage(message);
  }

  /**
   * Simula un messaggio dalla rete (per testing)
   */
  simulateChatMessage(content: string, senderName?: string): void {
    this.chatManager.simulateNetworkMessage(content, senderName);
  }

  /**
   * Ottiene lo stato della chat
   */
  getChatStatus(): any {
    return this.chatManager.getStatus();
  }

  /**
   * Cleanup delle risorse UI
   */
  destroy(): void {
    this.removePlayerNicknameElement();
    this.removeAllNpcNicknameElements();
    this.removeAllRemotePlayerNicknameElements();
    this.showMainTitle();

    // Rimuovi event listeners
    if ((this as any).hudToggleListener) {
      document.removeEventListener('keydown', (this as any).hudToggleListener);
    }

    // Distruggi la chat
    this.chatPanel.destroy();
  }
}
