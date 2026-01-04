import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Sprite } from '../../entities/Sprite';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { Velocity } from '../../entities/spatial/Velocity';

/**
 * Sistema per la gestione dei giocatori remoti in multiplayer
 * Gestisce creazione, aggiornamento e rimozione delle entità remote player
 */
export class RemotePlayerSystem extends BaseSystem {
  // Mappa clientId -> entityId per tracciare i giocatori remoti
  private remotePlayers: Map<string, number> = new Map();
  private shipImage: HTMLImageElement | null = null;
  private shipWidth: number = 32;
  private shipHeight: number = 32;

  constructor(ecs: ECS, shipImage?: HTMLImageElement | null, shipWidth?: number, shipHeight?: number) {
    super(ecs);
    this.shipImage = shipImage || null;
    this.shipWidth = shipWidth || 32;
    this.shipHeight = shipHeight || 32;
  }

  update(_deltaTime: number): void {
    // Per ora non abbiamo logica di update specifica
    // I componenti Velocity vengono gestiti dal MovementSystem
  }

  /**
   * Aggiunge un nuovo giocatore remoto
   */
  addRemotePlayer(clientId: string, position: { x: number; y: number }, rotation: number = 0): number {
    // Rimuovi giocatore esistente se presente
    this.removeRemotePlayer(clientId);

    // Crea una nuova entity per il giocatore remoto
    const entity = this.ecs.createEntity();

    // Aggiungi componenti base
    const transform = new Transform(position.x, position.y, rotation);
    this.ecs.addComponent(entity, Transform, transform);

    // Aggiungi velocità (inizialmente ferma)
    const velocity = new Velocity(0, 0, 0);
    this.ecs.addComponent(entity, Velocity, velocity);

    // Aggiungi salute per mostrare le barre
    const health = new Health(100, 100); // HP completo per giocatori remoti
    this.ecs.addComponent(entity, Health, health);

    // Aggiungi scudo (come player locale)
    const shield = new Shield(50, 50); // Scudo completo per giocatori remoti
    this.ecs.addComponent(entity, Shield, shield);

    // Aggiungi danno (per completezza, anche se non controllato localmente)
    const damage = new Damage(50, 30, 100); // Valori base per giocatori remoti
    this.ecs.addComponent(entity, Damage, damage);

    // Aggiungi sprite per il giocatore remoto (stesso del player locale)
    const sprite = new Sprite(this.shipImage, this.shipWidth, this.shipHeight);
    this.ecs.addComponent(entity, Sprite, sprite);

    // Registra il giocatore remoto
    this.remotePlayers.set(clientId, entity.id);

    console.log(`👤 [REMOTE] Added remote player: ${clientId} (entity ${entity.id}) at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) with Health, Shield, Damage, Sprite`);
    return entity.id;
  }

  /**
   * Aggiorna posizione e rotazione di un giocatore remoto esistente
   */
  updateRemotePlayer(clientId: string, position: { x: number; y: number }, rotation: number = 0): void {
    const entityId = this.remotePlayers.get(clientId);
    if (!entityId) {
      console.warn(`[REMOTE] Tried to update unknown remote player: ${clientId}`);
      return;
    }

    const entity = this.ecs.getEntity(entityId);
    if (entity) {
      const transform = this.ecs.getComponent(entity, Transform);
      if (transform) {
        transform.x = position.x;
        transform.y = position.y;
        transform.rotation = rotation;

        // Log ridotto per evitare spam
        if (Math.random() < 0.05) { // 5% dei messaggi
          console.log(`📍 [REMOTE] Updated ${clientId}: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
        }
      }
    }
  }

  /**
   * Rimuove un giocatore remoto
   */
  removeRemotePlayer(clientId: string): void {
    const entityId = this.remotePlayers.get(clientId);
    if (entityId) {
      const entity = this.ecs.getEntity(entityId);
      if (entity) {
        this.ecs.removeEntity(entity);
        this.remotePlayers.delete(clientId);
        console.log(`👤 [REMOTE] Removed remote player: ${clientId} (entity ${entityId})`);
      }
    }
  }

  /**
   * Rimuove tutti i giocatori remoti
   */
  removeAllRemotePlayers(): void {
    for (const clientId of this.remotePlayers.keys()) {
      this.removeRemotePlayer(clientId);
    }
  }

  /**
   * Ottiene l'entity ID di un giocatore remoto
   */
  getRemotePlayerEntity(clientId: string): number | undefined {
    return this.remotePlayers.get(clientId);
  }

  /**
   * Verifica se un clientId corrisponde a un giocatore remoto
   */
  isRemotePlayer(clientId: string): boolean {
    return this.remotePlayers.has(clientId);
  }

  /**
   * Ottiene tutti i client IDs dei giocatori remoti attivi
   */
  getActiveRemotePlayers(): string[] {
    return Array.from(this.remotePlayers.keys());
  }

  /**
   * Ottiene il numero di giocatori remoti attivi
   */
  getRemotePlayerCount(): number {
    return this.remotePlayers.size;
  }
}
