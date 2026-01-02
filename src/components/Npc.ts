import { Component } from '../ecs/Component';

/**
 * Componente NPC - identifica un'entità come Non-Player Character
 * Gli NPC hanno comportamenti autonomi e possono interagire con il giocatore
 */
export class Npc extends Component {
  public npcType: string;
  public behavior: string;
  public nickname: string;

  constructor(
    npcType: string = 'generic',
    behavior: string = 'idle',
    nickname: string = ''
  ) {
    super();
    this.npcType = npcType;
    this.behavior = behavior;
    this.nickname = nickname || npcType; // Se non specificato, usa il tipo come nickname
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

  /**
   * Imposta il nickname dell'NPC
   */
  setNickname(nickname: string): void {
    this.nickname = nickname;
  }
}
