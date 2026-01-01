import { GameState } from './GameState.js';
import { GameContext } from '../core/GameContext.js';
import { World } from '../core/World.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { InputSystem } from '../systems/InputSystem.js';
import { PlayerControlSystem } from '../systems/PlayerControlSystem.js';
import { NpcBehaviorSystem } from '../systems/NpcBehaviorSystem.js';
import { NpcSelectionSystem } from '../systems/NpcSelectionSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { Transform } from '../components/Transform.js';
import { Velocity } from '../components/Velocity.js';
import { Npc } from '../components/Npc.js';
import { Health } from '../components/Health.js';
import { Damage } from '../components/Damage.js';

/**
 * Stato del gameplay attivo
 * Gestisce il mondo di gioco, ECS e tutti i sistemi di gameplay
 */
export class PlayState extends GameState {
  private world: World;
  private playerInfoElement: HTMLElement;

  constructor(private context: GameContext) {
    super();
    // Crea il mondo di gioco
    this.world = new World(context.canvas);

    // Crea elemento per mostrare info giocatore
    this.playerInfoElement = this.createPlayerInfoElement();
  }

  /**
   * Avvia il gameplay
   */
  async enter(context: GameContext): Promise<void> {
    console.log('Entering PlayState');
    console.log(`Player nickname: ${context.playerNickname}`);

    // Nasconde il titolo principale
    this.hideMainTitle();

    // Mostra info del giocatore
    this.showPlayerInfo();

    try {
      // Inizializza il mondo e crea il giocatore
      await this.initializeGame();

      console.log('Game initialized successfully');
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
    console.log('Exiting PlayState');
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
    this.playerInfoElement.textContent = `Pilot: ${this.context.playerNickname}`;
    if (!document.body.contains(this.playerInfoElement)) {
      document.body.appendChild(this.playerInfoElement);
    }
    this.playerInfoElement.style.display = 'block';
  }

  /**
   * Nasconde le info del giocatore
   */
  private hidePlayerInfo(): void {
    this.playerInfoElement.style.display = 'none';
    if (document.body.contains(this.playerInfoElement)) {
      document.body.removeChild(this.playerInfoElement);
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

    // Aggiungi sistemi all'ECS (ordine importante!)
    ecs.addSystem(inputSystem);        // Input per primo
    ecs.addSystem(npcSelectionSystem); // Selezione NPC
    ecs.addSystem(playerControlSystem); // Poi controllo player
    ecs.addSystem(combatSystem);       // Sistema combattimento
    ecs.addSystem(npcBehaviorSystem);  // Poi comportamento NPC
    ecs.addSystem(movementSystem);     // Poi movimento
    ecs.addSystem(renderSystem);       // Infine rendering

    // Crea la nave player
    const playerShip = this.createPlayerShip(ecs);

    // Imposta il player nel sistema di controllo
    playerControlSystem.setPlayerEntity(playerShip);

    // Crea alcuni NPC
    this.createNpcs(ecs, 3); // Crea 3 NPC

    // Collega input al controllo player e selezione NPC
    inputSystem.setMouseStateCallback((pressed, x, y) => {
      if (pressed) {
        // Assicurati che il canvas abbia il focus per gli eventi tastiera
        this.context.canvas.focus();
        console.log('Canvas focused for keyboard input');

        // Su mouse down: prima seleziona NPC se presente, poi inizia movimento
        // Converte coordinate schermo in mondo per la selezione
        const canvasSize = this.world.getCanvasSize();
        const worldX = x - canvasSize.width / 2;
        const worldY = y - canvasSize.height / 2;
        npcSelectionSystem.handleMouseClick(worldX, worldY);
      }
      // Passa sempre lo stato del mouse al controllo player (per movimento)
      playerControlSystem.handleMouseState(pressed, x, y);
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
    ecs.addComponent(ship, Transform, new Transform(worldCenterX, worldCenterY, 0)); // Centro del mondo
    ecs.addComponent(ship, Velocity, new Velocity(0, 0, 0)); // Inizialmente ferma
    ecs.addComponent(ship, Health, new Health(100, 100)); // 100 HP
    ecs.addComponent(ship, Damage, new Damage(25, 80, 500)); // 25 danno, 80 range, 500ms cooldown

    console.log(`Created player ship at world center: (${worldCenterX}, ${worldCenterY})`);
    return ship;
  }

  /**
   * Crea NPC nel mondo di gioco
   */
  private createNpcs(ecs: any, count: number): void {
    for (let i = 0; i < count; i++) {
      const npc = ecs.createEntity();

      // Posizioni casuali attorno al player
      const angle = (Math.PI * 2 * i) / count;
      const distance = 200 + Math.random() * 100; // Tra 200 e 300 pixel dal centro
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      // Aggiungi componenti all'NPC
      ecs.addComponent(npc, Transform, new Transform(x, y, 0));
      ecs.addComponent(npc, Velocity, new Velocity(0, 0, 0));
      ecs.addComponent(npc, Health, new Health(50, 50)); // 50 HP per gli NPC
      ecs.addComponent(npc, Damage, new Damage(10, 60, 1000)); // 10 danno, 60 range, 1000ms cooldown
      ecs.addComponent(npc, Npc, new Npc('patrol', 'idle'));

      console.log(`Created NPC ${i + 1} at position: (${x.toFixed(0)}, ${y.toFixed(0)})`);
    }

    console.log(`Created ${count} NPCs`);
  }

  /**
   * Restituisce il mondo di gioco per accesso esterno
   */
  getWorld(): World {
    return this.world;
  }
}
