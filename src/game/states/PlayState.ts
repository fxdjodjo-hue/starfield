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
import { ProjectileSystem } from '/src/systems/combat/ProjectileSystem';
import { DamageTextSystem } from '/src/systems/rendering/DamageTextSystem';
import { MinimapSystem } from '/src/systems/rendering/MinimapSystem';
import { LogSystem } from '/src/systems/rendering/LogSystem';
import { EconomySystem } from '/src/systems/EconomySystem';
import { RankSystem } from '/src/systems/RankSystem';
import { RewardSystem } from '/src/systems/RewardSystem';
import { Transform } from '/src/entities/spatial/Transform';
import { Velocity } from '/src/entities/spatial/Velocity';
import { Npc } from '/src/entities/ai/Npc';
import { SelectedNpc } from '/src/entities/combat/SelectedNpc';
import { Health } from '/src/entities/combat/Health';
import { Shield } from '/src/entities/combat/Shield';
import { Damage } from '/src/entities/combat/Damage';
import { Credits, Cosmos } from '/src/entities/Currency';
import { Experience } from '/src/entities/Experience';
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
  private playerInfoElement: HTMLElement;
  private expandedHudElement: HTMLElement | null = null;
  private context: GameContext;
  private playerEntity: any = null;
  private hudExpanded: boolean = false;
  private hudToggleListener: ((event: KeyboardEvent) => void) | null = null;
  private economySystem: any = null;
  private logSystem: LogSystem | null = null;

  constructor(context: GameContext) {
    super();
    this.context = context;
    // Crea il mondo di gioco
    this.world = new World(context.canvas);

    // Crea elemento per mostrare info giocatore
    this.playerInfoElement = this.createPlayerInfoElement();
  }

  /**
   * Avvia il gameplay
   */
  async enter(context: GameContext): Promise<void> {
    // Nasconde il titolo principale
    this.hideMainTitle();

    // Mostra info del giocatore
    this.showPlayerInfo();

    // Setup HUD toggle listener
    this.setupHudToggle();

    try {
      // Inizializza il mondo e crea il giocatore
      await this.initializeGame();
    } catch (error) {
      console.error('Failed to initialize game:', error);
      throw error;
    }
  }

  /**
   * Aggiorna il gameplay
   */
  update(deltaTime: number): void {
    // Aggiorna il mondo di gioco
    this.world.update(deltaTime);

    // Aggiorna le informazioni del player (HP)
    this.showPlayerInfo();
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

    this.hidePlayerInfo();
    this.showMainTitle();
    // Qui potremmo salvare lo stato di gioco, cleanup, etc.
  }

  /**
   * Crea l'elemento HTML per mostrare le info del giocatore
   */
  private createPlayerInfoElement(): HTMLElement {
    const element = document.createElement('div');
    element.id = 'player-info';
    element.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff88;
      padding: 10px 15px;
      border-radius: 8px;
      border: 1px solid #00ff88;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 100;
      display: none;
    `;
    return element;
  }

  /**
   * Mostra le info del giocatore
   */
  private showPlayerInfo(): void {
    let hpHtml = '';
    if (this.playerEntity) {
      const health = this.world.getECS().getComponent(this.playerEntity, Health);
      if (health) {
        hpHtml = ` <span style="color: #00ff88;">HP: </span><span style="color: #ffffff;">${health.current}/${health.max}</span>`;
      }
    }

    // Ottieni valori economici
    const economyStatus = this.economySystem?.getPlayerEconomyStatus();
    let economyHtml = '';
    if (economyStatus) {
      economyHtml = ` <span style="color: #00ff88;">CR:</span><span style="color: #ffffff;">${economyStatus.credits}</span> <span style="color: #00ff88;">CO:</span><span style="color: #ffffff;">${economyStatus.cosmos}</span> <span style="color: #00ff88;">XP:</span><span style="color: #ffffff;">${economyStatus.experience}/${economyStatus.expForNextLevel}</span> <span style="color: #00ff88;">LV:</span><span style="color: #ffffff;">${economyStatus.level}</span> <span style="color: #00ff88;">HN:</span><span style="color: #ffffff;">${economyStatus.honor}</span> <span style="color: #00ff88;">RK:</span><span style="color: #ffffff;">${economyStatus.honorRank}</span>`;
    }

    // HUD con colori diversi per etichette (verde) e valori (bianco)
    this.playerInfoElement.innerHTML =
      `<span style="color: #00ff88;">Pilot: </span><span style="color: #ffffff;">${this.context.playerNickname}</span>` +
      hpHtml +
      economyHtml;

    if (!document.body.contains(this.playerInfoElement)) {
      document.body.appendChild(this.playerInfoElement);
    }
    this.playerInfoElement.style.display = 'block';

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

    // Aggiorna stile elemento base per indicare lo stato
    if (this.hudExpanded) {
      this.playerInfoElement.style.borderColor = '#ffff00'; // Giallo quando espanso
      this.playerInfoElement.style.color = '#ffff00';
    } else {
      this.playerInfoElement.style.borderColor = '#00ff88'; // Verde quando minimal
      this.playerInfoElement.style.color = '#00ff88';
    }
  }


  /**
   * Nasconde le info del giocatore
   */
  private hidePlayerInfo(): void {
    this.playerInfoElement.style.display = 'none';
    if (document.body.contains(this.playerInfoElement)) {
      document.body.removeChild(this.playerInfoElement);
    }

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
   * Inizializza il mondo di gioco e crea entità
   */
  private async initializeGame(): Promise<void> {
    const ecs = this.world.getECS();

    // Crea sistemi
    const movementSystem = new MovementSystem(ecs);
    const renderSystem = new RenderSystem(ecs, movementSystem);
    const inputSystem = new InputSystem(ecs, this.context.canvas);
    const playerControlSystem = new PlayerControlSystem(ecs);
    const npcBehaviorSystem = new NpcBehaviorSystem(ecs);
    const npcSelectionSystem = new NpcSelectionSystem(ecs);
    const combatSystem = new CombatSystem(ecs, movementSystem);
    const damageTextSystem = new DamageTextSystem(ecs, movementSystem);
    const projectileSystem = new ProjectileSystem(ecs);
    const minimapSystem = new MinimapSystem(ecs, this.context.canvas);
    this.logSystem = new LogSystem(ecs);
    this.economySystem = new EconomySystem(ecs);
    const rankSystem = new RankSystem(ecs);
    const rewardSystem = new RewardSystem(ecs);

    // Aggiungi sistemi all'ECS (ordine importante!)
    ecs.addSystem(inputSystem);        // Input per primo
    ecs.addSystem(npcSelectionSystem); // Selezione NPC
    ecs.addSystem(playerControlSystem); // Poi controllo player
    ecs.addSystem(combatSystem);       // Sistema combattimento
    ecs.addSystem(projectileSystem);   // Sistema proiettili
    ecs.addSystem(npcBehaviorSystem);  // Poi comportamento NPC
    ecs.addSystem(movementSystem);     // Poi movimento
    ecs.addSystem(renderSystem);       // Rendering principale (include stelle)
    ecs.addSystem(minimapSystem);      // Minimappa
    ecs.addSystem(this.logSystem);     // Sistema log (messaggi centrati in alto)
    ecs.addSystem(damageTextSystem);   // Testi danno alla fine (più sopra di tutto)
    ecs.addSystem(this.economySystem); // Sistema economia
    ecs.addSystem(rankSystem); // Sistema rank
    ecs.addSystem(rewardSystem); // Sistema ricompense

    // Crea la nave player
    const playerShip = this.createPlayerShip(ecs);
    this.playerEntity = playerShip;

    // Imposta il player nel sistema di controllo
    playerControlSystem.setPlayerEntity(playerShip);

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
    });

    // Crea alcuni NPC
    this.createScouter(ecs, 50); // Crea 50 Scouter che si muovono

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
  private createPlayerShip(ecs: any): any {
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

    return ship;
  }


  /**
   * Crea Scouter distribuiti uniformemente su tutta la mappa
   */
  private createScouter(ecs: any, count: number): void {
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
    }
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

