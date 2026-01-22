import { Component } from '../../infrastructure/ecs/Component';

/**
 * Componente Asteroid - identifica un'entità come asteroide con movimento
 */
export class Asteroid extends Component {
    public scale: number;
    public velocityX: number;
    public velocityY: number;
    public rotationSpeed: number;

    constructor(scale: number = 1, velocityX: number = 0, velocityY: number = 0, rotationSpeed: number = 0) {
        super();
        this.scale = scale;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.rotationSpeed = rotationSpeed;
    }
}
