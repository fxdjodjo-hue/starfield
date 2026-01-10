import { Component } from '../core/infrastructure/ecs/Component';
/**
 * Componente esplosione - gestisce l'animazione dell'esplosione quando un'entità muore
 * L'esplosione è composta da più frame che vengono mostrati in sequenza
 */
export declare class Explosion extends Component {
    frames: HTMLImageElement[];
    currentFrame: number;
    frameTime: number;
    frameDuration: number;
    isFinished: boolean;
    constructor(frames: HTMLImageElement[], frameDuration?: number);
    /**
     * Aggiorna l'animazione dell'esplosione
     */
    update(deltaTime: number): void;
    /**
     * Ottiene il frame corrente dell'animazione
     */
    getCurrentFrame(): HTMLImageElement | null;
    /**
     * Verifica se l'animazione è completa
     */
    isAnimationFinished(): boolean;
}
//# sourceMappingURL=Explosion.d.ts.map