import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { UIManager } from '../../presentation/ui/UIManager';
import { PlayerHUD } from '../../presentation/ui/PlayerHUD';
import { LeaderboardPanel } from '../../presentation/ui/LeaderboardPanel';
import { QuestPanel } from '../../presentation/ui/QuestPanel';
import { UpgradePanel } from '../../presentation/ui/UpgradePanel';
import { ChatPanel } from '../../presentation/ui/ChatPanel';
import { ChatManager } from './ChatManager';
import { ChatMessageHandler } from '../../multiplayer/client/handlers/ChatMessageHandler';
import { MESSAGE_TYPES } from '../../config/NetworkConfig';
import { ErrorMessageHandler } from '../../multiplayer/client/handlers/ErrorMessageHandler';
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
  private upgradePanel: UpgradePanel | null = null;
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

  // Player ID per l'HUD
  private playerId: number | null = null;

  // Dati economici locali (fallback)
  private economyData: any = null;

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

    // Imposta i callback per aggiornare l'HUD quando i valori economici cambiano
    if (this.economySystem) {
      this.economySystem.setCreditsChangedCallback((newAmount: number, change: number) => {
        const inventory = {
          credits: newAmount,
          cosmos: this.economySystem?.getPlayerCosmos()?.cosmos || 0,
          experience: this.economySystem?.getPlayerExperience()?.totalExpEarned || 0,
          honor: this.economySystem?.getPlayerHonor()?.honor || 0,
          skillPoints: this.economySystem?.getPlayerSkillPoints?.() || 0
        };

        // Aggiorna UI locale
        this.updatePlayerData({ inventory });

        // Sincronizza con il server - invia solo il campo cambiato per sicurezza
        if (this.clientNetworkSystem && this.context?.authId) {
          this.clientNetworkSystem.sendMessage({
            type: MESSAGE_TYPES.ECONOMY_UPDATE,
            playerId: this.context.authId,
            field: 'credits',
            value: newAmount,
            change: change
          });
        }
      });

      this.economySystem.setCosmosChangedCallback((newAmount: number, change: number) => {
        const inventory = {
          credits: this.economySystem?.getPlayerCredits()?.credits || 0,
          cosmos: newAmount,
          experience: this.economySystem?.getPlayerExperience()?.totalExpEarned || 0,
          honor: this.economySystem?.getPlayerHonor()?.honor || 0,
          skillPoints: this.economySystem?.getPlayerSkillPoints?.() || 0
        };

        this.updatePlayerData({ inventory });

        // Sincronizza con il server - invia solo il campo cambiato per sicurezza
        if (this.clientNetworkSystem && this.context?.authId) {
          this.clientNetworkSystem.sendMessage({
            type: MESSAGE_TYPES.ECONOMY_UPDATE,
            playerId: this.context.authId,
            field: 'cosmos',
            value: newAmount,
            change: change
          });
        }
      });

      this.economySystem.setExperienceChangedCallback((newAmount: number, change: number, leveledUp: boolean) => {
        const inventory = {
          credits: this.economySystem?.getPlayerCredits()?.credits || 0,
          cosmos: this.economySystem?.getPlayerCosmos()?.cosmos || 0,
          experience: newAmount,
          honor: this.economySystem?.getPlayerHonor()?.honor || 0,
          skillPoints: this.economySystem?.getPlayerSkillPoints?.() || 0
        };

        this.updatePlayerData({ inventory });

        // Sincronizza con il server - invia solo il campo cambiato per sicurezza
        if (this.clientNetworkSystem && this.context?.authId) {
          this.clientNetworkSystem.sendMessage({
            type: MESSAGE_TYPES.ECONOMY_UPDATE,
            playerId: this.context.authId,
            field: 'experience',
            value: newAmount,
            change: change
          });
        }
      });

      this.economySystem.setHonorChangedCallback((newAmount: number, change: number, newRank?: string) => {
        const inventory = {
          credits: this.economySystem?.getPlayerCredits()?.credits || 0,
          cosmos: this.economySystem?.getPlayerCosmos()?.cosmos || 0,
          experience: this.economySystem?.getPlayerExperience()?.totalExpEarned || 0,
          honor: newAmount,
          skillPoints: this.economySystem?.getPlayerSkillPoints?.() || 0
        };

        this.updatePlayerData({ inventory });

        // Sincronizza con il server - invia solo il campo cambiato per sicurezza
        if (this.clientNetworkSystem && this.context?.authId) {
          this.clientNetworkSystem.sendMessage({
            type: MESSAGE_TYPES.ECONOMY_UPDATE,
            playerId: this.context.authId,
            field: 'honor',
            value: newAmount,
            change: change
          });
        }
      });
    }
  }

  /**
   * Imposta l'ID del player per l'HUD
   */
  setPlayerId(playerId: number): void {
    this.playerId = playerId;
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
    if (this.upgradePanel) {
      this.upgradePanel.setPlayerSystem(playerSystem);
      if (this.clientNetworkSystem) {
        this.upgradePanel.setClientNetworkSystem(this.clientNetworkSystem);
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

    // Abilita modalità multiplayer per il ChatManager
    this.chatManager.setMultiplayerMode(true, clientNetworkSystem.clientId);

    // Registra callback per inviare messaggi alla rete
    this.chatManager.onMessageSent((message) => {
      if (this.clientNetworkSystem) {
        this.clientNetworkSystem.sendChatMessage(message.content);
      }
    });

    // Registra gli handler per ricevere messaggi dalla rete
    const chatHandler = new ChatMessageHandler(this.chatManager);
    const errorHandler = new ErrorMessageHandler(this.chatManager);
    clientNetworkSystem.getMessageRouter().registerHandler(chatHandler);
    clientNetworkSystem.getMessageRouter().registerHandler(errorHandler);

    // Aggiorna anche i pannelli che ne hanno bisogno
    if (this.upgradePanel) {
      this.upgradePanel.setClientNetworkSystem(clientNetworkSystem);
    }

    // Aggiorna leaderboard panel se esiste
    const leaderboardPanel = this.uiManager.getPanel('leaderboard');
    if (leaderboardPanel && typeof (leaderboardPanel as any).setClientNetworkSystem === 'function') {
      (leaderboardPanel as any).setClientNetworkSystem(clientNetworkSystem);
    }
  }

  /**
   * Resetta tutti gli stati di progresso degli upgrade nel UpgradePanel
   */
  public resetAllUpgradeProgress(): void {
    if (this.upgradePanel && typeof this.upgradePanel.resetUpgradeProgress === 'function') {
      this.upgradePanel.resetUpgradeProgress();
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
    // Crea e registra il pannello leaderboard
    const statsConfig = getPanelConfig('stats');
    const leaderboardPanel = new LeaderboardPanel(statsConfig, this.clientNetworkSystem || null);
    this.uiManager.registerPanel(leaderboardPanel);

    // Crea e registra il pannello delle quest
    const questConfig = getPanelConfig('quest');
    const questPanel = new QuestPanel(questConfig);
    this.uiManager.registerPanel(questPanel);

    // Crea e registra il pannello delle skills
    const upgradeConfig = getPanelConfig('upgrade');
    this.upgradePanel = new UpgradePanel(upgradeConfig, this.ecs, this.playerSystem || undefined, this.clientNetworkSystem || undefined);
    this.uiManager.registerPanel(this.upgradePanel);

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
      container.style.display = 'none'; // NASCONDI durante il caricamento
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
    // Prima priorità: dati dal GameContext (server authoritative)
    let hudData = null;

    if (this.context && this.context.playerInventory) {
      // Calcola livello basato su experience (stessa logica di Experience component)
      const experience = this.context.playerInventory.experience || 0;
      let level = 1;
      let expForNextLevel = 10000; // Livello 2

      // Trova il livello corretto basato sull'experience cumulativa
      const levelRequirements = {
        2: 10000, 3: 30000, 4: 70000, 5: 150000, 6: 310000, 7: 630000,
        8: 1270000, 9: 2550000, 10: 5110000, 11: 10230000, 12: 20470000,
        13: 40950000, 14: 81910000, 15: 163910000, 16: 327750000, 17: 655430000,
        18: 1310790000, 19: 2621710000, 20: 5243410000, 21: 10487010000,
        22: 20973860000, 23: 41951120000, 24: 83902400000, 25: 167808800000,
        26: 335621600000, 27: 671248000000, 28: 1342496000000, 29: 2685000000000,
        30: 5369700000000, 31: 10739200000000, 32: 21478400000000,
        33: 42956800000000, 34: 85913600000000, 35: 171827200000000,
        36: 343654400000000, 37: 687308800000000, 38: 1374617600000000,
        39: 2749235200000000, 40: 5498470400000000, 41: 10996940800000000,
        42: 21993881600000000, 43: 43987763200000000, 44: 87975526400000000
      };

      for (const [lvl, reqExp] of Object.entries(levelRequirements)) {
        if (experience >= reqExp) {
          level = parseInt(lvl);
          expForNextLevel = levelRequirements[parseInt(lvl) + 1] || reqExp * 2;
        } else {
          expForNextLevel = reqExp;
          break;
        }
      }

      hudData = {
        level: level,
        playerId: this.context.playerId || this.playerId || 0,
        credits: this.context.playerInventory.credits || 0,
        cosmos: this.context.playerInventory.cosmos || 0,
        experience: experience,
        expForNextLevel: expForNextLevel - (levelRequirements[level - 1] || 0),
        honor: this.context.playerInventory.honor || 0
      };
    }

    // Seconda priorità: dati dall'EconomySystem (se non abbiamo GameContext)
    if (!hudData) {
      const economyData = this.economySystem?.getPlayerEconomyStatus();
      if (economyData) {
        hudData = {
          level: economyData.level,
          playerId: this.playerId || 0,
          credits: economyData.credits,
          cosmos: economyData.cosmos,
          experience: economyData.experience,
          expForNextLevel: economyData.expForNextLevel,
          honor: economyData.honor
        };
      }
    }

    // Terza priorità: valori di default
    if (!hudData) {
      hudData = {
        level: 1,
        playerId: this.playerId || 0,
        credits: 0,
        cosmos: 0,
        experience: 0,
        expForNextLevel: 100,
        honor: 0
      };
    }

    // Aggiorna sempre l'HUD con i dati disponibili
    this.playerHUD.updateData(hudData);
    this.playerHUD.show();
    
    // Mostra anche la chat (ora che tutto è pronto)
    if (this.chatPanel && this.chatPanel['container']) {
      const container = this.chatPanel['container'];
      const headerHeight = this.chatPanel['header'].offsetHeight || 49;
      container.style.height = headerHeight + 'px';
      container.style.display = 'flex'; // Mostra solo ora
      this.chatPanel['messagesContainer'].style.display = 'none';
      this.chatPanel['inputContainer'].style.display = 'none';
      this.chatPanel['toggleButton'].textContent = '+';
      this.chatPanel['_isVisible'] = false;
    }
  }

  /**
   * Aggiorna i dati del giocatore ricevuti dal server
   */
  updatePlayerData(data: any): void {
    // Aggiorna i dati interni se esistono
    if (data.inventory) {
      this.economyData = {
        ...this.economyData,
        credits: data.inventory.credits || 0,
        cosmos: data.inventory.cosmos || 0,
        experience: data.inventory.experience || 0,
        honor: data.inventory.honor || 0
      };

      // 🔧 CRITICAL FIX: Aggiorna ANCHE il GameContext che l'HUD legge!
      if (this.context) {
        this.context.playerInventory = {
          ...this.context.playerInventory,
          credits: data.inventory.credits || 0,
          cosmos: data.inventory.cosmos || 0,
          experience: data.inventory.experience || 0,
          honor: data.inventory.honor || 0,
          skillPoints: data.inventory.skillPoints || this.context.playerInventory.skillPoints || 0
        };
      }
    }

    // Aggiorna gli upgrades nel GameContext
    if (data.upgrades) {
      if (this.context) {
        this.context.playerUpgrades = {
          ...this.context.playerUpgrades,
          hpUpgrades: data.upgrades.hpUpgrades || 0,
          shieldUpgrades: data.upgrades.shieldUpgrades || 0,
          speedUpgrades: data.upgrades.speedUpgrades || 0,
          damageUpgrades: data.upgrades.damageUpgrades || 0
        };
      }
    }

    // Forza aggiornamento immediato dell'HUD
    this.showPlayerInfo();
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
   * (contenente anche lo stato/behavior in una seconda riga per debug)
   */
  ensureNpcNicknameElement(entityId: number, npcType: string, behavior: string): void {
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
      // Contenuto iniziale: nome + stato sotto (debug)
      element.innerHTML = `
        <div>${npcType}</div>
        <div style="font-size: 11px; color: #00ffcc;">${behavior}</div>
      `;
      document.body.appendChild(element);
      this.npcNicknameElements.set(entityId, element);
    }
  }

  /**
   * Aggiorna il contenuto (nome + stato) del nickname NPC
   */
  updateNpcNicknameContent(entityId: number, npcType: string, behavior: string): void {
    const element = this.npcNicknameElements.get(entityId);
    if (element) {
      element.innerHTML = `
        <div>${npcType}</div>
        <div style="font-size: 11px; color: #00ffcc;">${behavior}</div>
      `;
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
    // Aggiorna pannello Upgrade se ha il metodo updateECS
    const upgradePanel = this.uiManager.getPanel('upgrade-panel');
    if (upgradePanel && typeof (upgradePanel as any).updateECS === 'function') {
      (upgradePanel as any).updateECS(deltaTime);
    }

    // Altri pannelli possono essere aggiunti qui se necessario
  }

  /**
   * Ottiene il pannello Upgrade
   */
  public getUpgradePanel(): UpgradePanel | null {
    return this.uiManager.getPanel('upgrade-panel') as UpgradePanel;
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
