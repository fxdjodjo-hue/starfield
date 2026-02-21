import { Component } from '../../infrastructure/ecs/Component';

export const LifeStateType = {
    ALIVE: 'alive',
    EXPLODING: 'exploding',
    DEAD: 'dead'
} as const;

export type LifeStateType = typeof LifeStateType[keyof typeof LifeStateType];

/**
 * LifeState component - tracks entity life cycle without structural ECS changes
 */
export class LifeState extends Component {
    constructor(public state: LifeStateType = LifeStateType.ALIVE) {
        super();
    }

    isAlive(): boolean {
        return this.state === LifeStateType.ALIVE;
    }

    isExploding(): boolean {
        return this.state === LifeStateType.EXPLODING;
    }

    isDead(): boolean {
        return this.state === LifeStateType.DEAD;
    }
}
