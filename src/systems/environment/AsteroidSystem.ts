import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Asteroid } from '../../entities/spatial/Asteroid';
import { Transform } from '../../entities/spatial/Transform';
import { CONFIG } from '../../core/utils/config/GameConfig';

/**
 * Sistema che gestisce il movimento lento e la rotazione degli asteroidi
 * Gli asteroidi si muovono e ruotano lentamente, e si "wrappano" ai bordi della mappa
 */
export class AsteroidSystem extends System {
    // Limiti della mappa (il mondo è centrato su 0,0)
    private readonly HALF_WIDTH = CONFIG.WORLD_WIDTH / 2;
    private readonly HALF_HEIGHT = CONFIG.WORLD_HEIGHT / 2;

    constructor(ecs: ECS) {
        super(ecs);
    }

    update(deltaTime: number): void {
        // Ottieni tutte le entità con componente Asteroid
        const entities = this.ecs.getEntitiesWithComponents(Asteroid, Transform);

        for (const entity of entities) {
            const asteroid = this.ecs.getComponent(entity, Asteroid);
            const transform = this.ecs.getComponent(entity, Transform);

            if (!asteroid || !transform) continue;

            // Aggiorna posizione con velocità
            transform.x += asteroid.velocityX * deltaTime;
            transform.y += asteroid.velocityY * deltaTime;

            // Aggiorna rotazione
            transform.rotation += asteroid.rotationSpeed * deltaTime;

            // Wrap-around ai bordi della mappa
            // Se l'asteroide esce da un lato, rientra dal lato opposto
            if (transform.x > this.HALF_WIDTH) {
                transform.x = -this.HALF_WIDTH;
            } else if (transform.x < -this.HALF_WIDTH) {
                transform.x = this.HALF_WIDTH;
            }

            if (transform.y > this.HALF_HEIGHT) {
                transform.y = -this.HALF_HEIGHT;
            } else if (transform.y < -this.HALF_HEIGHT) {
                transform.y = this.HALF_HEIGHT;
            }
        }
    }
}
