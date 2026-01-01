import { GameState } from './GameState.js';
import { GameContext } from '../core/GameContext.js';
import { World } from '../core/World.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { InputSystem } from '../systems/InputSystem.js';
import { PlayerControlSystem } from '../systems/PlayerControlSystem.js';
import { Transform } from '../components/Transform.js';
import { Velocity } from '../components/Velocity.js';

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

    // Aggiungi sistemi all'ECS (ordine importante!)
    ecs.addSystem(inputSystem);        // Input per primo
    ecs.addSystem(playerControlSystem); // Poi controllo player
    ecs.addSystem(movementSystem);     // Poi movimento
    ecs.addSystem(renderSystem);       // Infine rendering

    // Crea la nave player
    const playerShip = this.createPlayerShip(ecs);

    // Imposta il player nel sistema di controllo
    playerControlSystem.setPlayerEntity(playerShip);

    // Collega input al controllo player
    inputSystem.setMouseStateCallback((pressed, x, y) => {
      playerControlSystem.handleMouseState(pressed, x, y);
    });

    inputSystem.setMouseMoveWhilePressedCallback((x, y) => {
      playerControlSystem.handleMouseMoveWhilePressed(x, y);
    });
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

    console.log(`Created player ship at world center: (${worldCenterX}, ${worldCenterY})`);
    return ship;
  }

  /**
   * Restituisce il mondo di gioco per accesso esterno
   */
  getWorld(): World {
    return this.world;
  }
}
