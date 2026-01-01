import { Game } from './core/Game';
import { Transform } from './components/Transform';
import { Velocity } from './components/Velocity';
import { Destination } from './components/Destination';
import { Camera } from './components/Camera';
import { RenderSystem } from './systems/RenderSystem';
import { InputSystem } from './systems/InputSystem';
import { MovementSystem } from './systems/MovementSystem';
import { PlayerControlSystem } from './systems/PlayerControlSystem';

/**
 * Punto di ingresso principale dell'applicazione
 */
async function main() {
  // Ottieni il canvas dall'HTML
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Canvas non trovato');
  }

  // Crea istanza del gioco
  const game = new Game(canvas);

  // Inizializza il gioco
  await game.init();

  // Ottieni il world e l'ECS
  const world = game.getWorld();
  const ecs = world.getECS();

  // Crea sistemi
  const movementSystem = new MovementSystem(ecs);
  const renderSystem = new RenderSystem(ecs, movementSystem);
  const inputSystem = new InputSystem(ecs, canvas);
  const playerControlSystem = new PlayerControlSystem(ecs);

  // Aggiungi sistemi all'ECS (ordine importante!)
  ecs.addSystem(inputSystem);        // Input per primo
  ecs.addSystem(playerControlSystem); // Poi controllo player
  ecs.addSystem(movementSystem);     // Poi movimento
  ecs.addSystem(renderSystem);       // Infine rendering

  // Crea la nave player
  const playerShip = createPlayerShip(ecs, world);

  // Imposta il player nel sistema di controllo
  playerControlSystem.setPlayerEntity(playerShip);

  // Collega input al controllo player
  inputSystem.setMouseStateCallback((pressed, x, y) => {
    playerControlSystem.handleMouseState(pressed, x, y);
  });

  inputSystem.setMouseMoveWhilePressedCallback((x, y) => {
    playerControlSystem.handleMouseMoveWhilePressed(x, y);
  });

  // Avvia il gioco
  game.start();
}

/**
 * Crea la nave player controllabile
 */
function createPlayerShip(ecs: any, world: any) {
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

// Avvia l'applicazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', main);
