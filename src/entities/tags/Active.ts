import { Component } from '../../infrastructure/ecs/Component';

/**
 * Active tag component - stable toggle for system processing
 */
export class Active extends Component {
    constructor(public isEnabled: boolean = true) {
        super();
    }
}
