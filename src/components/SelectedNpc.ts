import { Component } from '../ecs/Component.js';

/**
 * Componente SelectedNpc - indica che un NPC è selezionato
 * Solo un NPC alla volta può essere selezionato
 */
export class SelectedNpc extends Component {
  constructor() {
    super();
  }
}
