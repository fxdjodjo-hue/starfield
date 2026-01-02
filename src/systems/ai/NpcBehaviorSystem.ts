import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Npc } from '/src/entities/ai/Npc';
import { Transform } from '/src/entities/spatial/Transform';
import { Velocity } from '/src/entities/spatial/Velocity';
import { Damage } from '/src/entities/combat/Damage';
import { DamageTaken } from '/src/entities/combat/DamageTaken';
import { Health } from '/src/entities/combat/Health';
import { CONFIG } from '/src/utils/config/Config';

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
  private lastAvoidanceUpdate = 0;
  private avoidanceUpdateInterval = 100; // Avoidance ogni 100ms (10 FPS) per performance

  // Stato per movimenti fluidi
  private npcStates: Map<number, NpcState> = new Map();

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    this.lastBehaviorUpdate += deltaTime;
    this.lastAvoidanceUpdate += deltaTime;

    // Aggiorna comportamenti periodicamente
    if (this.lastBehaviorUpdate >= this.behaviorUpdateInterval) {
      this.updateBehaviors();
      this.lastBehaviorUpdate = 0;
    }

    // Applica avoidance tra NPC vicini (meno frequentemente per performance)
    if (this.lastAvoidanceUpdate >= this.avoidanceUpdateInterval) {
      this.applyNpcAvoidance(this.lastAvoidanceUpdate);
      this.lastAvoidanceUpdate = 0;
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
        this.updateNpcBehavior(npc, entity.id);
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
        this.executeNpcBehavior(npc, transform, velocity, deltaTime, entity.id);
        this.enforceWorldBounds(transform, velocity);
      }
    }
  }

  /**
   * Aggiorna il comportamento di un singolo NPC
   */
  private updateNpcBehavior(npc: Npc, entityId: number): void {
    // Solo gli Scouter cambiano comportamento periodicamente
    if (npc.npcType === 'Scouter') {
      // Controlla priorità comportamenti (ordine di importanza)
      const isLowHealth = this.isNpcLowHealth(entityId); // Priorità massima
      const isDamaged = this.isNpcUnderAttack(entityId);  // Priorità media

      // Logica prioritaria basata su stato NPC
      if (isLowHealth) {
        // NPC con poca salute fugge dal player
        npc.setBehavior('flee');
      } else if (isDamaged && !this.isNpcTooFarFromPlayer(entityId)) {
        // NPC danneggiato insegue il player per vendetta, ma solo se non è troppo lontano
        npc.setBehavior('pursuit');
      } else {
        // Comportamenti normali quando non è danneggiato né con poca salute
        const behaviors = ['cruise', 'patrol'];
        const randomBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];
        npc.setBehavior(randomBehavior);
      }

      // Assicurati che lo stato sia inizializzato
      this.initializeNpcStateForEntity(entityId, npc);
    }
    // Gli altri NPC mantengono il loro comportamento attuale
  }

  /**
   * Verifica se un NPC è stato danneggiato recentemente (negli ultimi 3 secondi)
   */
  /**
   * Verifica se un NPC è stato danneggiato recentemente (negli ultimi 5 secondi)
   */
  private isNpcDamagedRecently(entityId: number): boolean {
    const entities = this.ecs.getEntitiesWithComponents(DamageTaken);
    const entity = entities.find(e => e.id === entityId);

    if (!entity) return false;

    const damageTaken = this.ecs.getComponent(entity, DamageTaken);
    if (!damageTaken) return false;

    // Controlla se è stato danneggiato negli ultimi 5 secondi
    return damageTaken.wasDamagedRecently(Date.now(), 5000); // 5000ms = 5 secondi
  }

  /**
   * Verifica se un NPC è troppo lontano dal player per continuare l'inseguimento
   */
  private isNpcTooFarFromPlayer(entityId: number): boolean {
    const npcEntities = this.ecs.getEntitiesWithComponents(Transform);
    const npcEntity = npcEntities.find(e => e.id === entityId);

    if (!npcEntity) return true;

    const npcTransform = this.ecs.getComponent(npcEntity, Transform);
    if (!npcTransform) return true;

    // Trova il player
    const playerEntity = this.ecs.getPlayerEntity();
    if (!playerEntity) return true;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    if (!playerTransform) return true;

    // Calcola distanza
    const dx = npcTransform.x - playerTransform.x;
    const dy = npcTransform.y - playerTransform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Considera "troppo lontano" se oltre 400px (più del doppio del range di attacco)
    return distance > 400;
  }

  /**
   * Verifica se un NPC ha salute bassa (< 30% della salute massima)
   */
  private isNpcLowHealth(entityId: number): boolean {
    const entities = this.ecs.getEntitiesWithComponents(Health);
    const entity = entities.find(e => e.id === entityId);

    if (!entity) return false;

    const health = this.ecs.getComponent(entity, Health);
    if (!health) return false;

    // Considera bassa salute se sotto il 30% della vita massima
    return health.getPercentage() < 0.3; // 30%
  }

  /**
   * Verifica se un NPC è sotto attacco (vecchio metodo, mantenuto per compatibilità)
   * @deprecated Usa isNpcDamagedRecently invece
   */
  private isNpcUnderAttack(entityId: number): boolean {
    return this.isNpcDamagedRecently(entityId);
  }

  /**
   * Esegue il comportamento corrente di un NPC
   */
  private executeNpcBehavior(npc: Npc, transform: Transform, velocity: Velocity, deltaTime: number, entityId?: number): void {
    // Usa l'ID dell'entità invece del tipo per avere stati unici per ogni NPC
    const npcId = entityId || 0; // Fallback se non fornito
    let state = this.npcStates.get(npcId);

    // Inizializza lo stato se necessario (per nuovi NPC)
    if (!state) {
      this.initializeNpcStateForEntity(npcId, npc);
      state = this.npcStates.get(npcId);
      if (!state) {
        this.executeIdleBehavior(velocity);
        return;
      }
    }

    // Logica normale dei comportamenti
    switch (npc.behavior) {
      case 'idle':
        this.executeIdleBehavior(velocity);
        break;
      case 'patrol':
        this.executePatrolBehavior(transform, velocity, deltaTime, state);
        break;
      case 'circle':
        // Circle attivato solo quando NPC attacca il player
        this.executeSmoothCircleBehavior(transform, velocity, deltaTime, state);
        break;
      case 'cruise':
        this.executeCruiseBehavior(transform, velocity, deltaTime, state);
        break;
      case 'pursuit':
        this.executePursuitBehavior(transform, velocity, deltaTime, state);
        break;
      case 'flee':
        this.executeFleeBehavior(transform, velocity, deltaTime, state);
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
    // Azzera velocità angolare - gli NPC non dovrebbero ruotare durante il patrol
    velocity.setAngularVelocity(0);

    // Aggiorna occasionalmente la direzione (ogni 15-25 secondi circa)
    if (Math.random() < 0.0005) { // ~0.05% probabilità per frame (molto più rara)
      state.patrolAngle = Math.random() * Math.PI * 2;
      state.targetSpeed = 50; // Velocità fissa
    }

    this.updateSmoothVelocity(velocity, state.targetSpeed, state.patrolAngle, deltaTime, state);
  }



  /**
   * Comportamento cruise - mantiene direzione fissa per tratte molto lunghe
   */
  private executeCruiseBehavior(transform: Transform, velocity: Velocity, deltaTime: number, state: NpcState): void {
    // Azzera velocità angolare - gli NPC non dovrebbero ruotare durante il cruise
    velocity.setAngularVelocity(0);

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
    // Azzera velocità angolare - gli NPC non dovrebbero ruotare durante il movimento circolare
    velocity.setAngularVelocity(0);

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
   * Comportamento pursuit - l'NPC insegue il player quando danneggiato
   */
  private executePursuitBehavior(transform: Transform, velocity: Velocity, deltaTime: number, state: NpcState): void {
    // Azzera velocità angolare - gli NPC non dovrebbero ruotare durante l'inseguimento
    velocity.setAngularVelocity(0);

    // Trova il player
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
      .filter(playerEntity => !this.ecs.hasComponent(playerEntity, Npc));

    if (playerEntities.length === 0) {
      // Se non trova il player, torna a cruise
      this.executeCruiseBehavior(transform, velocity, deltaTime, state);
      return;
    }

    const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
    if (!playerTransform) {
      this.executeCruiseBehavior(transform, velocity, deltaTime, state);
      return;
    }

    // Calcola direzione verso il player
    const dx = playerTransform.x - transform.x;
    const dy = playerTransform.y - transform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Normalizza la direzione
      const directionX = dx / distance;
      const directionY = dy / distance;

      // Calcola angolo target
      const targetAngle = Math.atan2(directionY, directionX);

      // Usa velocità più alta per l'inseguimento (velocità di "carica")
      const pursuitSpeed = 80; // Più veloce del normale movimento

      this.updateSmoothVelocity(velocity, pursuitSpeed, targetAngle, deltaTime, state);
    }
  }

  /**
   * Comportamento flee - l'NPC con poca salute fugge dal player
   */
  private executeFleeBehavior(transform: Transform, velocity: Velocity, deltaTime: number, state: NpcState): void {
    // Azzera velocità angolare - gli NPC non dovrebbero ruotare durante la fuga
    velocity.setAngularVelocity(0);

    // Trova il player
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
      .filter(playerEntity => !this.ecs.hasComponent(playerEntity, Npc));

    if (playerEntities.length === 0) {
      // Se non trova il player, torna a cruise
      this.executeCruiseBehavior(transform, velocity, deltaTime, state);
      return;
    }

    const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
    if (!playerTransform) {
      this.executeCruiseBehavior(transform, velocity, deltaTime, state);
      return;
    }

    // Calcola direzione LONTANO dal player (opposto a pursuit)
    const dx = transform.x - playerTransform.x; // Invertito rispetto a pursuit
    const dy = transform.y - playerTransform.y; // Invertito rispetto a pursuit
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      // Normalizza la direzione (allontanamento dal player)
      const directionX = dx / distance;
      const directionY = dy / distance;

      // Calcola angolo target
      const targetAngle = Math.atan2(directionY, directionX);

      // Usa velocità elevata per la fuga (più veloce del normale per scappare)
      const fleeSpeed = 90; // Ancora più veloce di pursuit per simulare panico

      this.updateSmoothVelocity(velocity, fleeSpeed, targetAngle, deltaTime, state);
    }
  }

  /**
   * Comportamento circle - l'NPC gira in cerchio (vecchio metodo, mantenuto per compatibilità)
   */
  private executeCircleBehavior(transform: Transform, velocity: Velocity): void {
    // Azzera velocità angolare - gli NPC non dovrebbero ruotare durante il movimento circolare
    velocity.setAngularVelocity(0);

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
   * Inizializza lo stato di un NPC per movimenti fluidi usando l'entity ID
   */
  private initializeNpcStateForEntity(entityId: number, npc: Npc): void {
    if (!this.npcStates.has(entityId)) {
      this.npcStates.set(entityId, {
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
   * Inizializza lo stato di un NPC per movimenti fluidi (vecchio metodo per compatibilità)
   * @deprecated Usa initializeNpcStateForEntity invece
   */
  private initializeNpcState(npc: Npc): void {
    // Questo metodo è mantenuto per compatibilità ma non dovrebbe essere usato
  }

  /**
   * Applica avoidance tra NPC che sono troppo vicini
   */
  private applyNpcAvoidance(deltaTime: number): void {
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform, Velocity);
    const avoidanceRadius = 120; // Raggio entro cui applicare avoidance (120 pixel)
    const avoidanceStrength = 80; // Forza di repulsione

    for (const entityA of npcs) {
      const transformA = this.ecs.getComponent(entityA, Transform);
      const velocityA = this.ecs.getComponent(entityA, Velocity);
      const npcA = this.ecs.getComponent(entityA, Npc);

      if (!transformA || !velocityA || npcA?.npcType !== 'Scouter') continue;

      let avoidanceForceX = 0;
      let avoidanceForceY = 0;
      let nearbyCount = 0;

      // Controlla tutti gli altri NPC Scouter
      for (const entityB of npcs) {
        if (entityA.id === entityB.id) continue; // Non controllare se stesso

        const transformB = this.ecs.getComponent(entityB, Transform);
        const npcB = this.ecs.getComponent(entityB, Npc);

        if (!transformB || npcB?.npcType !== 'Scouter') continue;

        const dx = transformA.x - transformB.x;
        const dy = transformA.y - transformB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Se troppo vicino, applica forza di repulsione
        if (distance < avoidanceRadius && distance > 0) {
          // Forza inversamente proporzionale alla distanza (più vicini = più forte)
          const force = avoidanceStrength * (1 - distance / avoidanceRadius);
          avoidanceForceX += (dx / distance) * force;
          avoidanceForceY += (dy / distance) * force;
          nearbyCount++;
        }
      }

      // Applica la forza di avoidance se ci sono NPC vicini
      if (nearbyCount > 0) {
        const dt = deltaTime / 1000;
        // Aggiungi la forza di avoidance alla velocità corrente
        velocityA.x += avoidanceForceX * dt;
        velocityA.y += avoidanceForceY * dt;

        // Limita la velocità massima per evitare comportamenti estremi
        const maxSpeed = 80; // Velocità massima durante avoidance
        const currentSpeed = Math.sqrt(velocityA.x * velocityA.x + velocityA.y * velocityA.y);
        if (currentSpeed > maxSpeed) {
          velocityA.x = (velocityA.x / currentSpeed) * maxSpeed;
          velocityA.y = (velocityA.y / currentSpeed) * maxSpeed;
        }
      }
    }
  }

  /**
   * Impone i confini del mondo agli NPC per evitare che escano
   */
  private enforceWorldBounds(transform: Transform, velocity: Velocity): void {
    const margin = 50; // Margine dai bordi per evitare che gli NPC si blocchino esattamente sui confini
    const worldLeft = -CONFIG.WORLD_WIDTH / 2 + margin;
    const worldRight = CONFIG.WORLD_WIDTH / 2 - margin;
    const worldTop = -CONFIG.WORLD_HEIGHT / 2 + margin;
    const worldBottom = CONFIG.WORLD_HEIGHT / 2 - margin;

    let bounced = false;

    // Controlla confini orizzontali
    if (transform.x < worldLeft) {
      transform.x = worldLeft;
      velocity.x = Math.abs(velocity.x); // Rimbalza verso destra
      bounced = true;
    } else if (transform.x > worldRight) {
      transform.x = worldRight;
      velocity.x = -Math.abs(velocity.x); // Rimbalza verso sinistra
      bounced = true;
    }

    // Controlla confini verticali
    if (transform.y < worldTop) {
      transform.y = worldTop;
      velocity.y = Math.abs(velocity.y); // Rimbalza verso il basso
      bounced = true;
    } else if (transform.y > worldBottom) {
      transform.y = worldBottom;
      velocity.y = -Math.abs(velocity.y); // Rimbalza verso l'alto
      bounced = true;
    }

    // Se ha rimbalzato, cambia leggermente direzione per evitare loop
    if (bounced) {
      // Aggiungi una piccola variazione casuale alla direzione
      const angleVariation = (Math.random() - 0.5) * Math.PI * 0.3; // ±27 gradi
      const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      if (currentSpeed > 0) {
        const currentAngle = Math.atan2(velocity.y, velocity.x);
        const newAngle = currentAngle + angleVariation;

        velocity.x = Math.cos(newAngle) * currentSpeed;
        velocity.y = Math.sin(newAngle) * currentSpeed;
      }
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
