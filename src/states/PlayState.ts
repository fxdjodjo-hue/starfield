import { GameState } from './GameState';
import { GameContext } from '../core/GameContext';
import { World } from '../core/World';
import { MovementSystem } from '../systems/MovementSystem';
import { RenderSystem } from '../systems/RenderSystem';
import { InputSystem } from '../systems/InputSystem';
import { PlayerControlSystem } from '../systems/PlayerControlSystem';
import { NpcBehaviorSystem } from '../systems/NpcBehaviorSystem';
import { NpcSelectionSystem } from '../systems/NpcSelectionSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { DamageTextSystem } from '../systems/DamageTextSystem';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';
import { Npc } from '../components/Npc';
import { SelectedNpc } from '../components/SelectedNpc';
import { Health } from '../components/Health';
import { Damage } from '../components/Damage';
import { ParallaxLayer } from '../components/ParallaxLayer';
import { ParallaxSystem } from '../systems/ParallaxSystem';
import { CONFIG } from '../core/Config';

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
    let hpText = '';
    if (this.playerEntity) {
      const health = this.world.getECS().getComponent(this.playerEntity, Health);
      if (health) {
        hpText = ` | HP: ${health.current}/${health.max}`;
      }
    }

    // HUD minimal: solo nickname e HP
    this.playerInfoElement.textContent = `Pilot: ${this.context.playerNickname}${hpText}`;
    if (!document.body.contains(this.playerInfoElement)) {
      document.body.appendChild(this.playerInfoElement);
    }
    this.playerInfoElement.style.display = 'block';

    // HUD espanso: informazioni aggiuntive
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
    const combatSystem = new CombatSystem(ecs);
    const projectileSystem = new ProjectileSystem(ecs, movementSystem);
    const damageTextSystem = new DamageTextSystem(ecs);
    const parallaxSystem = new ParallaxSystem(ecs, movementSystem);

    // Aggiungi sistemi all'ECS (ordine importante!)
    ecs.addSystem(inputSystem);        // Input per primo
    ecs.addSystem(npcSelectionSystem); // Selezione NPC
    ecs.addSystem(playerControlSystem); // Poi controllo player
    ecs.addSystem(combatSystem);       // Sistema combattimento
    ecs.addSystem(projectileSystem);   // Sistema proiettili
    ecs.addSystem(npcBehaviorSystem);  // Poi comportamento NPC
    ecs.addSystem(movementSystem);     // Poi movimento
    ecs.addSystem(parallaxSystem);     // Sistema parallax (sfondo)
    ecs.addSystem(renderSystem);       // Rendering principale
    ecs.addSystem(damageTextSystem);   // Infine testi danno (sopra tutto)

    // Crea la nave player
    const playerShip = this.createPlayerShip(ecs);
    this.playerEntity = playerShip;

    console.log(`PlayState: Created playerShip with id: ${playerShip?.id}`);

    // Imposta il player nel sistema di controllo
    playerControlSystem.setPlayerEntity(playerShip);

    // Passa la camera al sistema di controllo player
    playerControlSystem.setCamera(movementSystem.getCamera());

    // Crea alcuni NPC
    this.createStreuner(ecs, 2); // Crea 2 Streuner che si muovono

    // Crea stelle distribuite su tutta la mappa
    this.createParallaxElements(ecs, 80); // Crea 80 stelle distribuite sulla mappa

    // Collega input al controllo player e selezione NPC
    inputSystem.setMouseStateCallback((pressed, x, y) => {
      if (pressed) {
        // Assicurati che il canvas abbia il focus per gli eventi tastiera
        this.context.canvas.focus();

        // Prova a selezionare NPC
        const canvasSize = this.world.getCanvasSize();
        const worldPos = movementSystem.getCamera().screenToWorld(x, y, canvasSize.width, canvasSize.height);
        const npcSelected = npcSelectionSystem.handleMouseClick(worldPos.x, worldPos.y);

        // Se non ha selezionato un NPC, attiva il movimento del player normale
        if (!npcSelected) {
          playerControlSystem.handleMouseState(pressed, x, y);
        }
      } else {
        // Su mouse up, ferma il movimento del player
        playerControlSystem.handleMouseState(pressed, x, y);
      }
    });

    inputSystem.setMouseMoveWhilePressedCallback((x, y) => {
      playerControlSystem.handleMouseMoveWhilePressed(x, y);
    });

    // Combattimento ora automatico - non serve più la barra spaziatrice
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
    const health = new Health(100, 100);
    const damage = new Damage(25, 300, 1000); // Cooldown aumentato a 1000ms (1 secondo)

    ecs.addComponent(ship, Transform, transform);
    ecs.addComponent(ship, Velocity, velocity);
    ecs.addComponent(ship, Health, health);
    ecs.addComponent(ship, Damage, damage);

    return ship;
  }


  /**
   * Crea Streuner (NPC che si muovono) nel mondo di gioco
   */
  private createStreuner(ecs: any, count: number): void {
    for (let i = 0; i < count; i++) {
      const streuner = ecs.createEntity();

      // Posizioni casuali attorno al player (vicino ai NPC normali)
      const angle = (Math.PI * 2 * i) / count + Math.PI / 6; // Offset per distribuirli
      const distance = 250 + Math.random() * 100; // Tra 250 e 350 pixel dal centro
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      // Aggiungi componenti allo Streuner
      ecs.addComponent(streuner, Transform, new Transform(x, y, 0));
      ecs.addComponent(streuner, Velocity, new Velocity(0, 0, 0));
      ecs.addComponent(streuner, Health, new Health(40, 40)); // 40 HP per gli Streuner
      ecs.addComponent(streuner, Damage, new Damage(12, 220, 1200)); // 12 danno, 220 range, 1200ms cooldown
      ecs.addComponent(streuner, Npc, new Npc('Streuner', 'wander', 'Streuner')); // Tipo Streuner con nickname
    }
  }

  /**
   * Crea elementi parallax per lo sfondo
   */
  private createParallaxElements(ecs: any, count: number): void {
    for (let i = 0; i < count; i++) {
      const parallaxElement = ecs.createEntity();

      // Distribuisci le stelle su tutta la superficie della mappa
      const x = (Math.random() - 0.5) * CONFIG.WORLD_WIDTH * 1.8; // Copri tutta la mappa + margini
      const y = (Math.random() - 0.5) * CONFIG.WORLD_HEIGHT * 1.8;

      // Velocità parallax casuale (stelle più lontane si muovono più lentamente)
      // Le stelle sono fisse nel cielo, ma con velocità diverse per effetto profondità
      const speed = 0.05 + Math.random() * 0.15; // Velocità molto basse (0.05-0.20)

      // Z-index basato sulla velocità (stelle più lente = più lontane = sotto)
      const zIndex = Math.floor(speed * 100); // Scala diversa per basse velocità

      // Aggiungi componenti
      ecs.addComponent(parallaxElement, Transform, new Transform(x, y, 0));
      ecs.addComponent(parallaxElement, ParallaxLayer, new ParallaxLayer(speed, speed, 0, 0, zIndex));
    }
  }

  /**
   * Restituisce il mondo di gioco per accesso esterno
   */
  getWorld(): World {
    return this.world;
  }
}
