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
import { BoundsSystem } from '/src/systems/BoundsSystem';
import { NpcRespawnSystem } from '/src/systems/NpcRespawnSystem';
import { PlayerHUD } from '/src/ui/PlayerHUD';
import type { PlayerHUDData } from '/src/ui/PlayerHUD';
import { UIManager } from '/src/ui/UIManager';
import { PlayerStatsPanel } from '/src/ui/PlayerStatsPanel';
import { QuestPanel } from '/src/ui/QuestPanel';
import type { PanelData } from '/src/ui/UIManager';
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
import { ParallaxLayer } from '/src/entities/spatial/ParallaxLayer';
import { CONFIG } from '/src/utils/config/Config';
import { getNpcDefinition } from '/src/config/NpcConfig';

/**
 * Stato del gameplay attivo
 * Gestisce il mondo di gioco, ECS e tutti i sistemi di gameplay
 */
export class PlayState extends GameState {
  private world: World;
  private playerHUD: PlayerHUD;
  private uiManager: UIManager;
  private startTime: number = Date.now();
  private expandedHudElement: HTMLElement | null = null;
  private context: GameContext;
  private playerEntity: any = null;
  private hudExpanded: boolean = false;
  private hudToggleListener: ((event: KeyboardEvent) => void) | null = null;
  private economySystem: any = null;
  private logSystem: LogSystem | null = null;
  private playerNicknameElement: HTMLElement | null = null;

  constructor(context: GameContext) {
    super();
    this.context = context;
    // Crea il mondo di gioco
    this.world = new World(context.canvas);

    // Crea l'HUD del giocatore (separazione presentazione/logica)
    this.playerHUD = new PlayerHUD();
    this.uiManager = new UIManager();
  }

  /**
   * Avvia il gameplay
   */
  async enter(context: GameContext): Promise<void> {
    // Nasconde il titolo principale
    this.hideMainTitle();

    try {
      // Inizializza il mondo e crea il giocatore PRIMA di mostrare l'HUD
      await this.initializeGame();
    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }

    // Mostra info del giocatore DOPO l'inizializzazione dei sistemi
    this.showPlayerInfo();

    // Crea elemento nickname sotto la nave
    this.createPlayerNicknameElement();

    // Setup HUD toggle listener
    this.setupHudToggle();

    // Inizializza il sistema UI
    this.initializeUI();
  }

  /**
   * Inizializza il sistema UI con pannelli e icone
   */
  private initializeUI(): void {
    // Configurazione singola fonte di verità per il pannello statistiche
    const statsConfig = {
      id: 'player-stats',
      icon: '📊',
      title: 'Statistiche Giocatore',
      position: 'center-left' as const,
      size: { width: 1300, height: 750 }
    };

    // Crea il pannello con la configurazione e registralo
    const statsPanel = new PlayerStatsPanel(statsConfig);
    this.uiManager.registerPanel(statsPanel);

    // Crea e registra il pannello delle quest (stesse dimensioni del pannello stats)
    const questConfig = {
      id: 'quest-panel',
      icon: '📋',
      title: 'Missioni & Quest',
      position: 'center-left-below' as const,
      size: { width: 1300, height: 750 }
    };

    const questPanel = new QuestPanel(questConfig);
    this.uiManager.registerPanel(questPanel);

    console.log('UI System initialized with player stats and quest panels');
  }

  /**
   * Aggiorna i pannelli UI con dati aggiornati
   */
  private updateUIPanels(): void {
    const playerEntity = this.world.getECS().getPlayerEntity();
    if (!playerEntity) return;

    const health = this.world.getECS().getComponent(playerEntity, Health);
    const experience = this.world.getECS().getComponent(playerEntity, Experience);
    const credits = this.world.getECS().getComponent(playerEntity, Credits);
    const honor = this.world.getECS().getComponent(playerEntity, Honor);

    // Raccogli i dati per il pannello delle statistiche
    const statsData: PanelData = {
      level: experience?.level || 1,
      experience: experience?.amount || 0,
      experienceForNext: experience?.getExpRequiredForLevel(experience?.level || 1) || 1000,
      credits: credits?.credits || 0,
      honor: honor?.amount || 0,
      kills: 0, // TODO: Implementare contatore uccisioni
      playtime: Math.floor((Date.now() - this.startTime) / 60000) // minuti
    };

    // Dati di esempio per le quest (saranno sostituiti dal vero sistema quest)
    const questData = {
      activeQuests: [
        {
          id: 'kill-scouters',
          title: 'Caccia ai Ricognitori',
          description: 'Elimina 5 Scouter nemici per proteggere la tua nave.',
          type: 'kill' as const,
          objectives: [{ id: 'kill-objective', description: 'Uccidi Scouter', current: 2, target: 5, type: 'kill' }],
          rewards: [{ type: 'credits' as const, amount: 500 }, { type: 'experience' as const, amount: 250 }],
          progress: 40,
          isCompleted: false,
          isActive: true
        },
        {
          id: 'survive-5min',
          title: 'Sopravvivenza',
          description: 'Rimani in vita per 5 minuti consecutivi.',
          type: 'survival' as const,
          objectives: [{ id: 'time-objective', description: 'Sopravvivi', current: 180, target: 300, type: 'time' }],
          rewards: [{ type: 'experience' as const, amount: 150 }],
          progress: 60,
          isCompleted: false,
          isActive: true,
          timeRemaining: 120
        }
      ],
      completedQuests: [
        {
          id: 'first-kill',
          title: 'Primo Contatto',
          description: 'Uccidi il tuo primo nemico spaziale.',
          type: 'achievement' as const,
          objectives: [{ id: 'first-kill-obj', description: 'Primo nemico sconfitto', current: 1, target: 1, type: 'kill' }],
          rewards: [{ type: 'experience' as const, amount: 50 }],
          progress: 100,
          isCompleted: true,
          isActive: false
        }
      ],
      availableQuests: [
        {
          id: 'collect-resources',
          title: 'Raccoglitore di Risorse',
          description: 'Raccogli 1000 crediti totali.',
          type: 'collection' as const,
          objectives: [{ id: 'credits-objective', description: 'Raccogli crediti', current: 450, target: 1000, type: 'credits' }],
          rewards: [{ type: 'experience' as const, amount: 300 }],
          progress: 45,
          isCompleted: false,
          isActive: false
        }
      ]
    };

    // Aggiorna i pannelli UI
    this.uiManager.updatePanels({
      'player-stats': statsData,
      'quest-panel': questData
    });
  }

  /**
   * Aggiorna il gameplay
   */
  update(deltaTime: number): void {
    // Aggiorna il mondo di gioco
    this.world.update(deltaTime);

    // Aggiorna le informazioni del player (HP)
    this.showPlayerInfo();

    // Aggiorna posizione del nickname
    this.updatePlayerNicknamePosition();

    // Aggiorna i pannelli UI
    this.updateUIPanels();
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
    // Questo metodo è disponibile per input speciali se necessario
  }

  /**
   * Termina il gameplay
   */
  exit(): void {
    // Rimuovi listener HUD toggle
    if (this.hudToggleListener) {
      document.removeEventListener('keydown', this.hudToggleListener);
      this.hudToggleListener = null;
    }

    // Cleanup completo dell'HUD
    this.playerHUD.destroy();
    this.hidePlayerInfo();

    // Rimuovi elemento nickname
    this.removePlayerNicknameElement();

    this.showMainTitle();
    // Qui potremmo salvare lo stato di gioco, cleanup, etc.
  }

  /**
   * Crea l'elemento HTML per mostrare le info del giocatore
   */
  /**
   * Raccoglie i dati del giocatore per l'HUD
   * Separazione netta: logica di business fornisce dati, UI presenta
   */
  private collectPlayerHUDData(): PlayerHUDData {
    // Dati di default
    const hudData: PlayerHUDData = {
      level: 1,
      credits: 0,
      cosmos: 0,
      experience: 0,
      expForNextLevel: 100,
      honor: 0
    };

    // Aggiorna dati economici se disponibili
    const economyStatus = this.economySystem?.getPlayerEconomyStatus();
    if (economyStatus) {
      hudData.level = economyStatus.level;
      hudData.credits = economyStatus.credits;
      hudData.cosmos = economyStatus.cosmos;
      hudData.experience = economyStatus.experience;
      hudData.expForNextLevel = economyStatus.expForNextLevel;
      hudData.honor = economyStatus.honor;
    }

    return hudData;
  }

  /**
   * Mostra le info del giocatore
   */
  /**
   * Mostra l'HUD del giocatore
   * Architettura pulita: PlayState fornisce dati, PlayerHUD presenta
   */
  private showPlayerInfo(): void {
    // Raccogli dati dalla logica di business
    const hudData = this.collectPlayerHUDData();

    // Passa dati alla presentazione (separazione responsabilità)
    this.playerHUD.updateData(hudData);
    this.playerHUD.show();

    // HUD espanso: informazioni aggiuntive (se necessario in futuro)
    if (this.hudExpanded) {
      this.showExpandedHud();
    } else {
      this.hideExpandedHud();
    }
  }

  /**
   * Mostra HUD espanso con informazioni aggiuntive
   */
  private showExpandedHud(): void {
    if (!this.expandedHudElement) {
      this.expandedHudElement = this.createExpandedHudElement();
      // Aggiungi l'elemento al DOM quando viene creato
      document.body.appendChild(this.expandedHudElement);
    }

    let infoText = '';

    // Posizione del player
    if (this.playerEntity) {
      const transform = this.world.getECS().getComponent(this.playerEntity, Transform);
      if (transform) {
        infoText += `Pos: (${Math.round(transform.x)}, ${Math.round(transform.y)})\n`;
      }

      // Danno e cooldown
      const damage = this.world.getECS().getComponent(this.playerEntity, Damage);
      if (damage) {
        const cooldownRemaining = damage.getCooldownRemaining(Date.now()) / 1000; // Converte in secondi
        const canAttack = damage.canAttack(Date.now());
        infoText += `Damage: ${damage.damage}\n`;
        infoText += `Status: ${canAttack ? 'Ready' : cooldownRemaining.toFixed(1) + 's'}\n`;
      }
    }

    // Conteggio nemici e selezione
    const npcEntities = this.world.getECS().getEntitiesWithComponents(Npc);
    const selectedNpcs = this.world.getECS().getEntitiesWithComponents(SelectedNpc);
    infoText += `Enemies: ${npcEntities.length}`;
    if (selectedNpcs.length > 0) {
      infoText += ` (1 selected)`;
    }

    this.expandedHudElement.textContent = infoText;
    this.expandedHudElement.style.display = 'block';
  }

  /**
   * Nasconde HUD espanso
   */
  private hideExpandedHud(): void {
    if (this.expandedHudElement) {
      this.expandedHudElement.style.display = 'none';
    }
  }

  /**
   * Crea elemento HUD espanso
   */
  private createExpandedHudElement(): HTMLElement {
    const element = document.createElement('div');
    element.id = 'expanded-hud';
    element.style.cssText = `
      position: fixed;
      top: 60px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff88;
      padding: 10px 15px;
      border-radius: 8px;
      border: 1px solid #00ff88;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      z-index: 100;
      display: none;
      white-space: pre-line;
    `;
    return element;
  }

  /**
   * Setup listener per toggle HUD
   */
  private setupHudToggle(): void {
    this.hudToggleListener = (event: KeyboardEvent) => {
      if (event.key === 'h' || event.key === 'H') {
        this.toggleHud();
      }
    };

    document.addEventListener('keydown', this.hudToggleListener);
  }

  /**
   * Toggle tra HUD minimal ed espanso
   */
  private toggleHud(): void {
    this.hudExpanded = !this.hudExpanded;
    this.showPlayerInfo();

    // Gestisci anche la visibilità delle UI
    if (this.hudExpanded) {
      this.uiManager.showUI();
    } else {
      this.uiManager.hideUI();
    }

    // Nota: Lo styling dell'HUD è ora gestito da PlayerHUD
    // Il toggle riguarda HUD espanso e UI
  }


  /**
   * Nasconde l'HUD del giocatore
   */
  private hidePlayerInfo(): void {
    // Usa PlayerHUD per nascondere (separazione responsabilità)
    this.playerHUD.hide();

    // Nasconde anche HUD espanso
    this.hideExpandedHud();
    if (this.expandedHudElement && document.body.contains(this.expandedHudElement)) {
      document.body.removeChild(this.expandedHudElement);
    }
  }

  /**
   * Nasconde il titolo principale
   */
  private hideMainTitle(): void {
    const titleElement = document.querySelector('h1');
    if (titleElement) {
      titleElement.style.display = 'none';
    }
  }

  /**
   * Mostra il titolo principale
   */
  private showMainTitle(): void {
    const titleElement = document.querySelector('h1');
    if (titleElement) {
      titleElement.style.display = 'block';
    }
  }

  /**
   * Crea l'elemento DOM per mostrare il nickname sotto la nave del player
   */
  private createPlayerNicknameElement(): void {
    this.playerNicknameElement = document.createElement('div');
    this.playerNicknameElement.id = 'player-nickname';
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
    `;
    document.body.appendChild(this.playerNicknameElement);
    this.updatePlayerNicknameContent();
  }

  /**
   * Aggiorna il contenuto del nickname con rank
   */
  private updatePlayerNicknameContent(): void {
    if (!this.playerNicknameElement) return;

    const nickname = this.context.playerNickname || 'Commander';
    const rank = this.getPlayerRank();

    this.playerNicknameElement.innerHTML = `
      <div style="font-size: 14px; font-weight: 600;">${nickname}</div>
      <div style="font-size: 12px; font-weight: 400; opacity: 0.8;">[${rank}]</div>
    `;
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
   * Aggiorna la posizione del nickname sotto la nave del player
   */
  private updatePlayerNicknamePosition(): void {
    if (!this.playerNicknameElement || !this.playerEntity) return;

    const transform = this.world.getECS().getComponent(this.playerEntity, Transform);
    if (!transform) return;

    // Trova il MovementSystem nei sistemi registrati
    const movementSystem = this.findMovementSystem();
    if (!movementSystem) return;

    const camera = movementSystem.getCamera();
    const canvasSize = this.world.getCanvasSize();

    // Converte le coordinate mondo in coordinate schermo
    const screenPos = camera.worldToScreen(transform.x, transform.y, canvasSize.width, canvasSize.height);

    // Aggiorna il contenuto (potrebbe essere cambiato il rank)
    this.updatePlayerNicknameContent();

    // Forza il ricalcolo delle dimensioni dopo l'aggiornamento del contenuto
    this.playerNicknameElement.style.display = 'block';

    // Posiziona il nickname 45px sotto il centro della nave (più spazio per due righe)
    const nicknameX = screenPos.x - this.playerNicknameElement.offsetWidth / 2;
    const nicknameY = screenPos.y + 45;

    this.playerNicknameElement.style.left = `${nicknameX}px`;
    this.playerNicknameElement.style.top = `${nicknameY}px`;
  }

  /**
   * Trova il MovementSystem nei sistemi registrati
   */
  private findMovementSystem(): any {
    const ecs = this.world.getECS();
    if (ecs && (ecs as any).systems) {
      return (ecs as any).systems.find((system: any) => system.getCamera);
    }
    return null;
  }

  /**
   * Rimuove l'elemento DOM del nickname
   */
  private removePlayerNicknameElement(): void {
    if (this.playerNicknameElement && document.body.contains(this.playerNicknameElement)) {
      document.body.removeChild(this.playerNicknameElement);
      this.playerNicknameElement = null;
    }
  }

  /**
   * Inizializza il mondo di gioco e crea entità
   */
  private async initializeGame(): Promise<void> {
    // Load ship sprite
    const shipImage = await this.context.assetManager.loadImage('/assets/ships/0/0.png');
    const shipSprite = new Sprite(shipImage, shipImage.width * 0.2, shipImage.height * 0.2);

    // Load map background sprite
    const mapBackgroundImage = await this.context.assetManager.loadImage('/assets/maps/maps1/1/bg.jpg');
    const mapBackgroundSprite = new Sprite(mapBackgroundImage, mapBackgroundImage.width, mapBackgroundImage.height);

    // Load NPC sprites
    const scouterImage = await this.context.assetManager.loadImage('/assets/npc_ships/scouter/npc_scouter.png');
    const scouterSprite = new Sprite(scouterImage, scouterImage.width * 0.15, scouterImage.height * 0.15); // Ridimensionato al 15%

    const ecs = this.world.getECS();

    // Crea sistemi
    const movementSystem = new MovementSystem(ecs);
    const parallaxSystem = new ParallaxSystem(ecs, movementSystem);
    const renderSystem = new RenderSystem(ecs, movementSystem);
    const inputSystem = new InputSystem(ecs, this.context.canvas);
    const playerControlSystem = new PlayerControlSystem(ecs);
    const npcBehaviorSystem = new NpcBehaviorSystem(ecs);
    const npcSelectionSystem = new NpcSelectionSystem(ecs);
    const combatSystem = new CombatSystem(ecs, movementSystem, this.context);
    const explosionSystem = new ExplosionSystem(ecs);
    const damageTextSystem = new DamageTextSystem(ecs, movementSystem);
    const projectileSystem = new ProjectileSystem(ecs);
    const minimapSystem = new MinimapSystem(ecs, this.context.canvas);
    this.logSystem = new LogSystem(ecs);
    this.economySystem = new EconomySystem(ecs);
    const rankSystem = new RankSystem(ecs);
    const rewardSystem = new RewardSystem(ecs);
    const boundsSystem = new BoundsSystem(ecs, movementSystem);
    const respawnSystem = new NpcRespawnSystem(ecs, this.context);

    // Aggiungi sistemi all'ECS (ordine importante!)
    ecs.addSystem(inputSystem);        // Input per primo
    ecs.addSystem(npcSelectionSystem); // Selezione NPC
    ecs.addSystem(playerControlSystem); // Poi controllo player
    ecs.addSystem(combatSystem);       // Sistema combattimento
    ecs.addSystem(explosionSystem);    // Sistema esplosioni
    ecs.addSystem(projectileSystem);   // Sistema proiettili
    ecs.addSystem(npcBehaviorSystem);  // Poi comportamento NPC
    ecs.addSystem(movementSystem);     // Poi movimento
    ecs.addSystem(parallaxSystem);     // Sistema parallax (sfondo)
    ecs.addSystem(renderSystem);       // Rendering principale (include stelle)
    ecs.addSystem(boundsSystem);       // Sistema bounds (linee rosse)
    ecs.addSystem(minimapSystem);      // Minimappa
    ecs.addSystem(this.logSystem);     // Sistema log (messaggi centrati in alto)
    ecs.addSystem(damageTextSystem);   // Testi danno alla fine (più sopra di tutto)
    ecs.addSystem(this.economySystem); // Sistema economia
    ecs.addSystem(rankSystem); // Sistema rank
    ecs.addSystem(respawnSystem); // Sistema respawn NPC
    ecs.addSystem(rewardSystem); // Sistema ricompense (dopo respawn per evitare conflitti)

    // Crea la nave player
    const playerShip = this.createPlayerShip(ecs, shipSprite);
    this.playerEntity = playerShip;

    // Imposta il player nel sistema di controllo
    playerControlSystem.setPlayerEntity(playerShip);

    // Crea l'entità background della mappa
    this.createMapBackground(ecs, mapBackgroundSprite);

    // Passa la camera al sistema di controllo player
    playerControlSystem.setCamera(movementSystem.getCamera());

    // Configura minimappa
    minimapSystem.setCamera(movementSystem.getCamera());
    minimapSystem.setMoveToCallback((worldX, worldY) => {
      // Quando si clicca sulla minimappa, muovi il player alla posizione
      playerControlSystem.movePlayerTo(worldX, worldY);
    });

    // Quando finisce il movimento dalla minimappa, cancella la linea
    playerControlSystem.setMinimapMovementCompleteCallback(() => {
      minimapSystem.clearDestination();
    });

    // Configura sistema economico, rank e ricompense
    this.economySystem.setPlayerEntity(playerShip);
    this.economySystem.setRankSystem(rankSystem);
    rankSystem.setPlayerEntity(playerShip);
    rewardSystem.setEconomySystem(this.economySystem);
    rewardSystem.setPlayerEntity(playerShip); // Per aggiornare statistiche player

    // Configura sistema di log
    combatSystem.setLogSystem(this.logSystem!);
    rewardSystem.setLogSystem(this.logSystem!);

    // Configura sistema bounds
    boundsSystem.setPlayerEntity(playerShip);

    // Configura sistema respawn NPC
    respawnSystem.setPlayerEntity(playerShip);
    rewardSystem.setRespawnSystem(respawnSystem);

    // Configura callbacks per aggiornamenti HUD
    this.economySystem.setExperienceChangedCallback((newAmount, change, leveledUp) => {
      // Aggiorna HUD con nuovi valori
      this.showPlayerInfo();
    });

    this.economySystem.setCreditsChangedCallback((newAmount, change) => {
      this.showPlayerInfo();
    });

    this.economySystem.setCosmosChangedCallback((newAmount, change) => {
      this.showPlayerInfo();
    });

    this.economySystem.setHonorChangedCallback((newAmount, change, newRank) => {
      this.showPlayerInfo();
      this.updatePlayerNicknameContent();
    });

    // Crea alcuni NPC
    this.createScouter(ecs, 50, scouterSprite); // Crea 50 Scouter che si muovono

    // Crea stelle distribuite su tutta la mappa
    // Stelle create direttamente nel RenderSystem

    // Collega input al controllo player e selezione NPC
    inputSystem.setMouseStateCallback((pressed, x, y) => {
      if (pressed) {
        // Assicurati che il canvas abbia il focus per gli eventi tastiera
        this.context.canvas.focus();

        // Prima controlla se il mouse down è sulla minimappa
        const minimapHandled = minimapSystem.handleMouseDown(x, y);
        if (minimapHandled) {
          return; // Mouse down gestito dalla minimappa, non fare altro
        }

        // Se si clicca normalmente (non sulla minimappa), cancella destinazione minimappa
        minimapSystem.clearDestination();

        // Prova a selezionare NPC
        const canvasSize = this.world.getCanvasSize();
        const worldPos = movementSystem.getCamera().screenToWorld(x, y, canvasSize.width, canvasSize.height);
        const npcSelected = npcSelectionSystem.handleMouseClick(worldPos.x, worldPos.y);

        // Se non ha selezionato un NPC, attiva il movimento del player normale
        if (!npcSelected) {
          playerControlSystem.handleMouseState(pressed, x, y);
        }
      } else {
        // Su mouse up, ferma il movimento dalla minimappa e del player
        minimapSystem.handleMouseUp();
        playerControlSystem.handleMouseState(pressed, x, y);
      }
    });

    inputSystem.setMouseMoveWhilePressedCallback((x, y) => {
      // Prima controlla se il mouse move è nella minimappa
      const minimapHandled = minimapSystem.handleMouseMove(x, y);
      if (!minimapHandled) {
        // Se non è nella minimappa, gestisci il movimento normale del player
        playerControlSystem.handleMouseMoveWhilePressed(x, y);
      }
    });

    // Combattimento ora automatico - non serve più la barra spaziatrice

    // Mostra messaggio di benvenuto
    if (this.logSystem) {
      this.logSystem.logWelcome('Commander');
    }
  }


  /**
   * Crea la nave player controllabile
   */
  private createPlayerShip(ecs: any, sprite: Sprite): any {
    const ship = ecs.createEntity();

    // Spawna il player al centro del mondo (0,0)
    // La camera è centrata su (0,0), quindi apparirà al centro dello schermo
    const worldCenterX = 0;
    const worldCenterY = 0;

    // Aggiungi componenti alla nave player
    const transform = new Transform(worldCenterX, worldCenterY, 0);
    const velocity = new Velocity(0, 0, 0);
    const health = new Health(100000, 100000); // Vita aumentata a 100k
    const damage = new Damage(500, 300, 1000); // Danno aumentato a 500
            const credits = new Credits(1000); // Inizia con 1000 Credits
            const cosmos = new Cosmos(50); // Inizia con 50 Cosmos
            const experience = new Experience(0, 1); // Inizia a livello 1 con 0 exp
            const honor = new Honor(0); // Inizia con 0 Honor Points (ranking verrà aggiornato dal server)
            const playerStats = new PlayerStats(0, 0, 0, 0); // Statistiche iniziali

    ecs.addComponent(ship, Transform, transform);
    ecs.addComponent(ship, Velocity, velocity);
    ecs.addComponent(ship, Health, health);
    ecs.addComponent(ship, Damage, damage);
            ecs.addComponent(ship, Credits, credits);
            ecs.addComponent(ship, Cosmos, cosmos);
            ecs.addComponent(ship, Experience, experience);
            ecs.addComponent(ship, Honor, honor);
            ecs.addComponent(ship, PlayerStats, playerStats);
    ecs.addComponent(ship, Sprite, sprite);

    return ship;
  }


  /**
   * Crea Scouter distribuiti uniformemente su tutta la mappa
   */
  private createScouter(ecs: any, count: number, sprite?: Sprite): void {
    const minDistance = 100; // Distanza minima tra Scouter
    const minDistanceFromPlayer = 200; // Distanza minima dal player (centro)
    const worldWidth = CONFIG.WORLD_WIDTH;
    const worldHeight = CONFIG.WORLD_HEIGHT;
    const positions: { x: number, y: number }[] = [];

    // Dividi la mappa in una griglia per distribuzione uniforme
    const gridCols = Math.ceil(Math.sqrt(count * worldWidth / worldHeight));
    const gridRows = Math.ceil(count / gridCols);

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let validPosition = false;
      let x = 0, y = 0;

      // Trova una posizione valida distribuita uniformemente
      while (!validPosition && attempts < 100) { // Più tentativi per distribuzione uniforme
        // Usa una distribuzione a griglia con variazioni casuali
        const gridX = i % gridCols;
        const gridY = Math.floor(i / gridCols);

        // Calcola posizione base nella griglia
        const cellWidth = worldWidth / gridCols;
        const cellHeight = worldHeight / gridRows;

        const baseX = gridX * cellWidth + cellWidth / 2 - worldWidth / 2;
        const baseY = gridY * cellHeight + cellHeight / 2 - worldHeight / 2;

        // Aggiungi variazione casuale entro la cella
        const variationX = (Math.random() - 0.5) * cellWidth * 0.8; // 80% della cella
        const variationY = (Math.random() - 0.5) * cellHeight * 0.8;

        x = baseX + variationX;
        y = baseY + variationY;

        // Verifica che non sia troppo vicino al player
        const distanceFromPlayer = Math.sqrt(x * x + y * y);
        if (distanceFromPlayer < minDistanceFromPlayer) {
          attempts++;
          continue;
        }

        // Verifica che non sia troppo vicino ad altri Scouter
        validPosition = positions.every(pos => {
          const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
          return distance >= minDistance;
        });

        attempts++;
      }

      // Se dopo 100 tentativi non trova posizione valida, posiziona casualmente
      if (!validPosition) {
        x = (Math.random() - 0.5) * worldWidth;
        y = (Math.random() - 0.5) * worldHeight;

        // Assicurati che non sia troppo vicino al player
        const distanceFromPlayer = Math.sqrt(x * x + y * y);
        if (distanceFromPlayer < minDistanceFromPlayer) {
          x = x * (worldWidth / 2 / distanceFromPlayer);
          y = y * (worldWidth / 2 / distanceFromPlayer);
        }
      }

      positions.push({ x, y });

      const streuner = ecs.createEntity();
      const npcDef = getNpcDefinition('Scouter');

      if (!npcDef) {
        console.error('NPC definition not found for Scouter');
        continue;
      }

      // Aggiungi componenti allo Scouter usando la configurazione
      ecs.addComponent(streuner, Transform, new Transform(x, y, 0));
      ecs.addComponent(streuner, Velocity, new Velocity(0, 0, 0)); // velocità angolare = 0
      ecs.addComponent(streuner, Health, new Health(npcDef.stats.health, npcDef.stats.health));
      ecs.addComponent(streuner, Shield, new Shield(npcDef.stats.shield, npcDef.stats.shield));
      ecs.addComponent(streuner, Damage, new Damage(npcDef.stats.damage, npcDef.stats.range, npcDef.stats.cooldown));
      ecs.addComponent(streuner, Npc, new Npc(npcDef.type, npcDef.defaultBehavior));

      // Aggiungi sprite se fornito
      if (sprite) {
        ecs.addComponent(streuner, Sprite, sprite);
      }
    }
  }

  /**
   * Crea l'entità background della mappa come elemento parallax
   */
  private createMapBackground(ecs: any, backgroundSprite: Sprite): any {
    const backgroundEntity = ecs.createEntity();

    // Posiziona l'immagine al centro del mondo (0,0)
    const transform = new Transform(0, 0, 0);
    // Velocità parallax molto bassa (0.05 = si muove molto lentamente per effetto profondità)
    const parallaxLayer = new ParallaxLayer(0.05, 0.05, 0, 0, -1); // zIndex negativo per essere dietro tutto

    // Aggiungi componenti
    ecs.addComponent(backgroundEntity, Transform, transform);
    ecs.addComponent(backgroundEntity, Sprite, backgroundSprite);
    ecs.addComponent(backgroundEntity, ParallaxLayer, parallaxLayer);

    return backgroundEntity;
  }

  /**
   * Crea elementi parallax per lo sfondo
   */

  /**
   * Restituisce il mondo di gioco per accesso esterno
   */
  getWorld(): World {
    return this.world;
  }
}

