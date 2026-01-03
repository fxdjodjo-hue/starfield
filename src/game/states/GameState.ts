import type { GameContext } from '../../infrastructure/engine/GameContext';

/**
 * Classe astratta base per tutti gli stati del gioco
 * Definisce il contratto che ogni stato deve implementare
 */
export abstract class GameState {
  /**
   * Chiamato quando lo stato diventa attivo
   */
  abstract enter(context: GameContext): void | Promise<void>;

  /**
   * Chiamato ad ogni frame per aggiornare lo stato
   */
  abstract update(deltaTime: number): void;

  /**
   * Chiamato per renderizzare lo stato (opzionale)
   */
  render?(ctx: CanvasRenderingContext2D): void;

  /**
   * Chiamato quando lo stato viene disattivato
   */
  abstract exit(): void;

  /**
   * Gestisce input specifici dello stato (opzionale)
   */
  handleInput?(event: Event): void;
}

