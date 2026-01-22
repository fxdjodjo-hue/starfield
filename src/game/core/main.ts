// Main game initialization
import { Game } from '../../infrastructure/engine/Game';
import { ConfigValidator, loadConfigs } from '../../core/utils/config/ConfigValidator';

async function main() {
  // Carica le configurazioni (metodo diverso per sviluppo vs packaged)
  await loadConfigs();

  // Valida tutte le configurazioni all'avvio
  ConfigValidator.validateOrThrow();

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