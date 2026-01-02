import { Game } from './core/Game';

console.log('main.ts loaded');

/**
 * Punto di ingresso principale dell'applicazione
 */
async function main() {
  console.log('main() called');

  // Ottieni gli elementi HTML
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const gameContainer = document.body; // O un container specifico se necessario

  if (!canvas) {
    throw new Error('Canvas non trovato');
  }

  console.log('Canvas found');

  // Crea istanza del gioco con il nuovo sistema di stati
  const game = new Game(canvas, gameContainer);
  console.log('Game instance created');

  // Inizializza il gioco (ora gestisce automaticamente gli stati)
  await game.init();
  console.log('Game initialized');

  // Avvia il game loop (il sistema di stati gestisce tutto il resto)
  game.start();
  console.log('Game started');
}


// Avvia l'applicazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired');
  main().catch(error => {
    console.error('Failed to start game:', error);
    console.error('Error stack:', error.stack);
  });
});
