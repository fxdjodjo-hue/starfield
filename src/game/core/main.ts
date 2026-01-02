// Main game initialization
import { Game } from '/src/infrastructure/engine/Game';

async function main() {
  console.log('Starting Starfield...');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const gameContainer = document.body;

  if (!canvas) {
    throw new Error('Canvas not found!');
  }

  console.log('Canvas found, creating game...');
  const game = new Game(canvas, gameContainer);

  console.log('Game created, initializing...');
  await game.init();

  console.log('Game initialized successfully! Starting game loop...');
  game.start();

  console.log('Starfield is now running!');
}

document.addEventListener('DOMContentLoaded', () => {
  main().catch(error => {
    console.error('Failed to start Starfield:', error);
    console.error('Error stack:', error.stack);
  });
});
