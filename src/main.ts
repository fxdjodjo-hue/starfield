import { Game } from './core/Game';

/**
 * Punto di ingresso principale dell'applicazione
 */
async function main() {
  // Ottieni gli elementi HTML
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const gameContainer = document.body; // O un container specifico se necessario

  if (!canvas) {
    throw new Error('Canvas non trovato');
  }

  // Crea istanza del gioco con il nuovo sistema di stati
  const game = new Game(canvas, gameContainer);

  // Inizializza il gioco (ora gestisce automaticamente gli stati)
  await game.init();

  // Avvia il game loop (il sistema di stati gestisce tutto il resto)
  game.start();
}


// Avvia l'applicazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
  main().catch(error => {
    console.error('Failed to start game:', error);
    console.error('Error stack:', error.stack);
  });
});
