import { BaseSystem } from '../ecs/System';
import { ECS } from '../ecs/ECS';
import { Npc } from '../components/Npc';
import { Transform } from '../components/Transform';
import { Velocity } from '../components/Velocity';

/**
 * Stato interno per gestire movimenti fluidi degli NPC
 */
interface NpcState {
  targetAngle: number; // Angolo target per movimenti fluidi
  currentSpeed: number; // Velocità attuale
  targetSpeed: number; // Velocità target
  acceleration: number; // Accelerazione per transizioni fluide
  patrolAngle: number; // Angolo per comportamento patrol
  circleCenterX: number; // Centro del movimento circolare
  circleCenterY: number;
  lastUpdateTime: number; // Per timing delle transizioni
}

/**
 * Sistema di comportamento NPC - gestisce l'AI semplice degli NPC
 */
export class NpcBehaviorSystem extends BaseSystem {
  private lastBehaviorUpdate = 0;
  private behaviorUpdateInterval = 8000; // Cambia comportamento ogni 8 secondi (tratte più lunghe)

  // Stato per movimenti fluidi
  private npcStates: Map<number, NpcState> = new Map();

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    this.lastBehaviorUpdate += deltaTime;

    // Aggiorna comportamenti periodicamente
    if (this.lastBehaviorUpdate >= this.behaviorUpdateInterval) {
      this.updateBehaviors();
      this.lastBehaviorUpdate = 0;
    }

    // Esegui comportamenti correnti
    this.executeBehaviors(deltaTime);
  }

  /**
   * Aggiorna i comportamenti degli NPC (chiamato periodicamente)
   */
  private updateBehaviors(): void {
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);

    for (const entity of npcs) {
      const npc = this.ecs.getComponent(entity, Npc);
      if (npc) {
        this.updateNpcBehavior(npc);
      }
    }
  }

  /**
   * Esegue i comportamenti correnti degli NPC (chiamato ogni frame)
   */
  private executeBehaviors(deltaTime: number): void {
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform, Velocity);

    for (const entity of npcs) {
      const npc = this.ecs.getComponent(entity, Npc);
      const transform = this.ecs.getComponent(entity, Transform);
      const velocity = this.ecs.getComponent(entity, Velocity);

      if (npc && transform && velocity) {
        this.executeNpcBehavior(npc, transform, velocity, deltaTime);
      }
    }
  }

  /**
   * Aggiorna il comportamento di un singolo NPC
   */
  private updateNpcBehavior(npc: Npc): void {
    // Solo gli Streuner si muovono, gli altri rimangono fermi
    if (npc.npcType === 'Streuner') {
      // Comportamenti più fluidi per gli Streuner
      // cruise: mantiene direzione molto a lungo (tratte lunghissime)
      // patrol: mantiene direzione più a lungo
      // wander: cambia direzione gradualmente
      // circle: movimento circolare fluido
      const behaviors = ['cruise', 'patrol', 'wander', 'circle'];
      const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];
      npc.setBehavior(randomBehavior);

      // Inizializza lo stato dell'NPC se necessario
      this.initializeNpcState(npc);
    } else {
      // Gli altri NPC stanno fermi
      npc.setBehavior('idle');
    }
  }

  /**
   * Esegue il comportamento corrente di un NPC
   */
  private executeNpcBehavior(npc: Npc, transform: Transform, velocity: Velocity, deltaTime: number): void {
    const npcId = npc.npcType === 'Streuner' ? 1 : 0;
    const state = this.npcStates.get(npcId);

    if (!state) {
      this.executeIdleBehavior(velocity);
      return;
    }

    switch (npc.behavior) {
      case 'idle':
        this.executeIdleBehavior(velocity);
        break;
      case 'patrol':
        this.executePatrolBehavior(transform, velocity, deltaTime, state);
        break;
      case 'wander':
        this.executeSmoothWanderBehavior(transform, velocity, deltaTime, state);
        break;
      case 'circle':
        this.executeSmoothCircleBehavior(transform, velocity, deltaTime, state);
        break;
      case 'cruise':
        this.executeCruiseBehavior(transform, velocity, deltaTime, state);
        break;
      default:
        this.executeIdleBehavior(velocity);
    }
  }

  /**
   * Comportamento idle - l'NPC sta fermo
   */
  private executeIdleBehavior(velocity: Velocity): void {
    // Forza la velocità a zero per assicurarsi che stia fermo
    velocity.setVelocity(0, 0);
    velocity.setAngularVelocity(0);
  }

  /**
   * Comportamento patrol - mantiene una direzione più a lungo per movimenti fluidi
   */
  private executePatrolBehavior(transform: Transform, velocity: Velocity, deltaTime: number, state: NpcState): void {
    // Aggiorna occasionalmente la direzione (ogni 15-25 secondi circa)
    if (Math.random() < 0.0005) { // ~0.05% probabilità per frame (molto più rara)
      state.patrolAngle = Math.random() * Math.PI * 2;
      state.targetSpeed = 50; // Velocità fissa
    }

    this.updateSmoothVelocity(velocity, state.targetSpeed, state.patrolAngle, deltaTime, state);
  }

  /**
   * Comportamento wander fluido - cambia direzione gradualmente
   */
  private executeSmoothWanderBehavior(transform: Transform, velocity: Velocity, deltaTime: number, state: NpcState): void {
    // Cambia direzione gradualmente (ogni 5-10 secondi circa)
    if (Math.random() < 0.001) { // ~0.1% probabilità per frame (molto più rara)
      state.targetAngle = Math.random() * Math.PI * 2;
      state.targetSpeed = 50; // Velocità fissa
    }

    this.updateSmoothVelocity(velocity, state.targetSpeed, state.targetAngle, deltaTime, state);
  }

  /**
   * Comportamento wander - l'NPC si muove casualmente (vecchio metodo, mantenuto per compatibilità)
   */
  private executeWanderBehavior(transform: Transform, velocity: Velocity): void {
    // Movimento casuale con velocità moderata
    const speed = 50; // pixels per second
    const angle = Math.random() * Math.PI * 2; // Direzione casuale

    velocity.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
  }

  /**
   * Comportamento cruise - mantiene direzione fissa per tratte molto lunghe
   */
  private executeCruiseBehavior(transform: Transform, velocity: Velocity, deltaTime: number, state: NpcState): void {
    // Cambia direzione molto raramente (ogni 30-60 secondi circa)
    if (Math.random() < 0.0002) { // ~0.02% probabilità per frame (estremamente rara)
      state.targetAngle = Math.random() * Math.PI * 2;
      state.targetSpeed = 50; // Velocità fissa
    }

    this.updateSmoothVelocity(velocity, state.targetSpeed, state.targetAngle, deltaTime, state);
  }

  /**
   * Comportamento circle fluido - movimento circolare relativo alla posizione iniziale
   */
  private executeSmoothCircleBehavior(transform: Transform, velocity: Velocity, deltaTime: number, state: NpcState): void {
    // Inizializza il centro del cerchio alla prima esecuzione
    if (state.circleCenterX === 0 && state.circleCenterY === 0) {
      state.circleCenterX = transform.x + (Math.random() - 0.5) * 200; // Centro casuale vicino all'NPC
      state.circleCenterY = transform.y + (Math.random() - 0.5) * 200;
    }

    const radius = 100; // Raggio fisso
    const speed = 50; // Velocità fissa

    const dx = transform.x - state.circleCenterX;
    const dy = transform.y - state.circleCenterY;

    // Direzione tangente (perpendicolare al raggio)
    const tangentX = -dy;
    const tangentY = dx;

    // Normalizza e applica velocità
    const length = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    if (length > 0) {
      const targetAngle = Math.atan2(tangentY, tangentX);
      this.updateSmoothVelocity(velocity, speed, targetAngle, deltaTime, state);
    }
  }

  /**
   * Comportamento circle - l'NPC gira in cerchio (vecchio metodo, mantenuto per compatibilità)
   */
  private executeCircleBehavior(transform: Transform, velocity: Velocity): void {
    // Movimento circolare con velocità costante
    const speed = 80; // pixels per second
    const radius = 100; // raggio del cerchio

    // Calcola la direzione tangente al cerchio
    const centerX = 400; // Centro del cerchio (potrebbe essere relativo alla posizione dell'NPC)
    const centerY = 300;

    const dx = transform.x - centerX;
    const dy = transform.y - centerY;

    // Direzione tangente (perpendicolare al raggio)
    const tangentX = -dy;
    const tangentY = dx;

    // Normalizza e applica velocità
    const length = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    if (length > 0) {
      velocity.setVelocity(
        (tangentX / length) * speed,
        (tangentY / length) * speed
      );
    }
  }

  /**
   * Inizializza lo stato di un NPC per movimenti fluidi
   */
  private initializeNpcState(npc: Npc): void {
    // Per ora usiamo un ID semplice basato sul tipo (potrebbe essere migliorato)
    const npcId = npc.npcType === 'Streuner' ? 1 : 0;

    if (!this.npcStates.has(npcId)) {
      this.npcStates.set(npcId, {
        targetAngle: Math.random() * Math.PI * 2,
        currentSpeed: 0,
        targetSpeed: 50, // Velocità fissa di 50 pixels/second
        acceleration: 50, // pixels/second²
        patrolAngle: Math.random() * Math.PI * 2,
        circleCenterX: 0,
        circleCenterY: 0,
        lastUpdateTime: Date.now()
      });
    }
  }

  /**
   * Aggiorna gradualmente la velocità per transizioni fluide
   */
  private updateSmoothVelocity(velocity: Velocity, targetSpeed: number, targetAngle: number, deltaTime: number, state: NpcState): void {
    const dt = deltaTime / 1000; // Converti in secondi

    // Aggiorna velocità con accelerazione
    const speedDiff = targetSpeed - state.currentSpeed;
    const accel = Math.sign(speedDiff) * state.acceleration * dt;

    if (Math.abs(accel) < Math.abs(speedDiff)) {
      state.currentSpeed += accel;
    } else {
      state.currentSpeed = targetSpeed;
    }

    // Applica velocità nella direzione target
    velocity.setVelocity(
      Math.cos(targetAngle) * state.currentSpeed,
      Math.sin(targetAngle) * state.currentSpeed
    );
  }
}
