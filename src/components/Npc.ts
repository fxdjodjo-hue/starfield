import { Component } from '../ecs/Component.js';

/**
 * Componente NPC - identifica un'entità come Non-Player Character
 * Gli NPC hanno comportamenti autonomi e possono interagire con il giocatore
 */
export class Npc extends Component {
  constructor(
    public npcType: string = 'generic',
    public behavior: string = 'idle'
  ) {
    super();
  }

  /**
   * Imposta il tipo di NPC
   */
  setType(type: string): void {
    this.npcType = type;
  }

  /**
   * Imposta il comportamento corrente
   */
  setBehavior(behavior: string): void {
    this.behavior = behavior;
  }
}
