import { Component } from '../core/infrastructure/ecs/Component';
/**
 * Componente esplosione - gestisce l'animazione dell'esplosione quando un'entità muore
 * L'esplosione è composta da più frame che vengono mostrati in sequenza
 */
export class Explosion extends Component {
    frames;
    currentFrame;
    frameTime;
    frameDuration; // millisecondi per frame
    isFinished;
    constructor(frames, frameDuration = 100) {
        super();
        this.frames = frames;
        this.currentFrame = 0;
        this.frameTime = 0;
        this.frameDuration = frameDuration;
        this.isFinished = false;
    }
    /**
     * Aggiorna l'animazione dell'esplosione
     */
    update(deltaTime) {
        if (this.isFinished)
            return;
        this.frameTime += deltaTime;
        // Passa al frame successivo se è passato abbastanza tempo
        if (this.frameTime >= this.frameDuration) {
            this.currentFrame++;
            this.frameTime = 0;
            // Controlla se l'animazione è finita
            if (this.currentFrame >= this.frames.length) {
                this.isFinished = true;
            }
        }
    }
    /**
     * Ottiene il frame corrente dell'animazione
     */
    getCurrentFrame() {
        if (this.currentFrame >= this.frames.length) {
            return null;
        }
        return this.frames[this.currentFrame];
    }
    /**
     * Verifica se l'animazione è completa
     */
    isAnimationFinished() {
        return this.isFinished;
    }
}
//# sourceMappingURL=Explosion.js.map