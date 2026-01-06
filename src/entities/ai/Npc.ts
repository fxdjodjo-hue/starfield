import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente NPC - identifica un'entità come Non-Player Character
 * Gli NPC hanno comportamenti autonomi e possono interagire con il giocatore
 * Il nome visualizzato corrisponde al tipo dell'NPC (npcType)
 */
export class Npc extends Component {
  public npcType: string;
  public behavior: string;
  public serverId: string | null = null; // ID usato dal server (es. "npc_0")

  constructor(
    npcType: string = 'generic',
    behavior: string = 'idle',
    serverId: string | null = null
  ) {
    super();
    this.npcType = npcType;
    this.behavior = behavior;
    this.serverId = serverId;
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
