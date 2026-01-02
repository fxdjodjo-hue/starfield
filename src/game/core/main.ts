// Main game initialization
import { Game } from '/src/infrastructure/engine/Game';

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const gameContainer = document.body;

  if (!canvas) {
    throw new Error('Canvas not found!');
  }

  const game = new Game(canvas, gameContainer);
  await game.init();
  game.start();
}

document.addEventListener('DOMContentLoaded', () => {
  main().catch(error => {
    console.error('Failed to start Starfield:', error);
    console.error('Error stack:', error.stack);
  });
});
