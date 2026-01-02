import { Component } from '../ecs/Component';

/**
 * Componente SelectedNpc - indica che un NPC è selezionato
 * Solo un NPC alla volta può essere selezionato
 */
export class SelectedNpc extends Component {
  constructor() {
    super();
  }
}