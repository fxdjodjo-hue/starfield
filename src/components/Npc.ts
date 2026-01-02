import { Component } from '../ecs/Component';

/**
 * Componente NPC - identifica un'entità come Non-Player Character
 * Gli NPC hanno comportamenti autonomi e possono interagire con il giocatore
 */
export class Npc extends Component {
  public npcType: string;
  public behavior: string;

  constructor(
    npcType: string = 'generic',
    behavior: string = 'idle'
  ) {
    super();
    this.npcType = npcType;
    this.behavior = behavior;
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
