import { InputValidator } from '../../core/utils/InputValidator';
import { NETWORK_CONFIG } from '../../config/NetworkConfig';

/**
 * Snapshot of entity state at a specific server timestamp.
 * Used for timeline-based interpolation (MMO-grade).
 */
export interface Snapshot {
  x: number;
  y: number;
  rotation: number;
  timestamp: number; // Local monotonic timestamp (performance.now() based)
  tick?: number;     // Original server tick (if available)
  vx?: number;       // Velocity X for better extrapolation
  vy?: number;       // Velocity Y for better extrapolation
}

/**
 * InterpolationTarget - MMO-Grade Snapshot Interpolation System
 * 
 * Migrated to Tick-Based Synchronization (2026):
 * - Server sends discrete ticks (1, 2, 3...)
 * - Client maps Tick -> Local Monotonic Time via stable offset
 * - Interpolation happens on Local Monotonic Time
 */
export class InterpolationTarget {
  // ==========================================
  // POSIZIONE RENDERIZZATA (visibile)
  // ==========================================
  renderX: number;
  renderY: number;
  renderRotation: number;

  // ==========================================
  // SNAPSHOT BUFFER
  // ==========================================
  private snapshots: Snapshot[] = [];
  private readonly MAX_SNAPSHOT_BUFFER_SIZE = NETWORK_CONFIG.MAX_SNAPSHOT_BUFFER_SIZE || 20;

  // ==========================================
  // CONFIGURAZIONE TIMELINE
  // ==========================================
  private readonly TICK_MS = 50; // Server base tick (20Hz)
  private readonly MAX_EXTRAPOLATION_MS = 150; // Esteso per gestire piccoli overrun

  private tickOffset: number | null = null;
  private lastSnapshotTimestamp: number = 0;
  private isNpc: boolean = false;

  constructor(initialX: number, initialY: number, initialRotation: number, isNpc: boolean = false) {
    this.renderX = initialX;
    this.renderY = initialY;
    this.renderRotation = initialRotation;
    this.isNpc = isNpc;

    // Snapshot iniziale per evitare rotazioni improvvise al spawn
    const now = performance.now();
    this.snapshots.push({
      x: initialX,
      y: initialY,
      rotation: initialRotation,
      timestamp: now,
      tick: 0
    });
    this.lastSnapshotTimestamp = now;
  }

  /**
   * AGGIORNA TARGET DA RETE
   * Gestisce sia timestamp (legacy) che TICK (nuovo sistema).
   * Se serverTimestamp è piccolo (< 1,000,000), lo tratta come TICK.
   */
  updateTarget(x: number, y: number, rotation: number, serverTimestamp?: number, velocityX?: number, velocityY?: number): void {
    const now = performance.now();
    let snapshotTick: number;

    // 1. DETERMINE TICK & OFFSET
    // --------------------------
    if (serverTimestamp !== undefined && serverTimestamp < 1000000) {
      // È UN TICK (es. 1045)
      snapshotTick = serverTimestamp;

      const estimatedServerTime = snapshotTick * this.TICK_MS;
      const currentOffset = now - estimatedServerTime;

      if (this.tickOffset === null) {
        // Primo pacchetto: calcola offset secco
        this.tickOffset = currentOffset;
      } else if (Math.abs(currentOffset - this.tickOffset) > 1000) {
        // Hard Reset se drift > 1 secondo (es. tab switch prolungato)
        this.tickOffset = currentOffset;
      }
      // NOTA: Non facciamo LERP sull'offset per evitare jitter dovuto al network.
      // L'offset rimane fisso finché non c'è una de-sincronizzazione grave.

    } else if (serverTimestamp !== undefined) {
      // È UN TIMESTAMP (legacy, es. 1738150000000)
      if (this.tickOffset === null) {
        this.tickOffset = now - serverTimestamp;
      }
      // Convertiamo timestamp in tick fittizi per coerenza interna
      snapshotTick = Math.floor(serverTimestamp / this.TICK_MS);
    } else {
      // Nessun dato, usiamo tempo locale convertito in tick
      snapshotTick = Math.floor(now / this.TICK_MS);
    }

    // 2. PREPARE DATA
    // ---------------
    const sanitizedPos = InterpolationTarget.sanitizePosition(x, y, this.renderX, this.renderY);
    let sanitizedRotation = rotation;
    if (!InputValidator.validateNumber(rotation, 'rotation').isValid) {
      sanitizedRotation = this.renderRotation;
    }

    // Calcola il timestamp locale in cui questo snapshot "dovrebbe" essere renderizzato
    // ServerTick * 50ms + Offset
    const localTimestamp = (snapshotTick * this.TICK_MS) + (this.tickOffset || 0);

    // 3. TELEPORT DETECTION
    // ---------------------
    if (this.snapshots.length > 0) {
      const lastSnap = this.snapshots[this.snapshots.length - 1];
      const dx = sanitizedPos.x - lastSnap.x;
      const dy = sanitizedPos.y - lastSnap.y;
      const distSq = dx * dx + dy * dy;
      const timeDiff = Math.abs(localTimestamp - lastSnap.timestamp);

      // Se spostamento > 500px in < 100ms -> Teleport
      if (distSq > 500 * 500 && timeDiff < 100) {
        this.snapTo(sanitizedPos.x, sanitizedPos.y, sanitizedRotation);
        return;
      }
    }

    // 4. ADD SNAPSHOT
    // ---------------
    const newSnapshot: Snapshot = {
      x: sanitizedPos.x,
      y: sanitizedPos.y,
      rotation: sanitizedRotation,
      timestamp: localTimestamp,
      tick: snapshotTick,
      vx: velocityX,
      vy: velocityY
    };

    // Inserimento ordinato (handle out-of-order packets)
    if (this.snapshots.length === 0 || localTimestamp >= this.snapshots[this.snapshots.length - 1].timestamp) {
      this.snapshots.push(newSnapshot);
    } else {
      // Caso raro: pacchetto arrivato in disordine
      // Cerchiamo dove inserirlo
      let insertIndex = this.snapshots.length;
      for (let i = this.snapshots.length - 1; i >= 0; i--) {
        if (this.snapshots[i].timestamp < localTimestamp) {
          insertIndex = i + 1;
          break;
        }
        if (i === 0) insertIndex = 0;
      }
      // Inseriamo solo se non è un duplicato esatto
      const prevSnap = this.snapshots[insertIndex - 1];
      const nextSnap = this.snapshots[insertIndex];
      const isDuplicate = (prevSnap && prevSnap.timestamp === localTimestamp) || (nextSnap && nextSnap.timestamp === localTimestamp);

      if (!isDuplicate) {
        this.snapshots.splice(insertIndex, 0, newSnapshot);
      }
    }

    this.lastSnapshotTimestamp = Math.max(this.lastSnapshotTimestamp, localTimestamp);

    // Mantieni buffer pulito
    while (this.snapshots.length > this.MAX_SNAPSHOT_BUFFER_SIZE) {
      this.snapshots.shift();
    }
  }

  interpolate(renderTime: number): void {
    const count = this.snapshots.length;
    if (count === 0) return;

    if (count === 1) {
      this.renderX = this.snapshots[0].x;
      this.renderY = this.snapshots[0].y;
      this.renderRotation = this.snapshots[0].rotation;
      return;
    }

    const oldest = this.snapshots[0];
    const newest = this.snapshots[count - 1];
    const secondNewest = this.snapshots[count - 2];

    // BUFFER UNDERRUN - renderTime è prima del buffer (troppo indietro)
    if (renderTime < oldest.timestamp) {
      this.renderX = oldest.x;
      this.renderY = oldest.y;
      this.renderRotation = oldest.rotation;
      return;
    }

    // BUFFER OVERRUN - renderTime è dopo il buffer (pacchetto in ritardo)
    if (renderTime > newest.timestamp) {
      const overTimeMs = renderTime - newest.timestamp;

      // Extrapolazione breve: continua il movimento per un po'
      if (overTimeMs < this.MAX_EXTRAPOLATION_MS) {
        const overTimeSec = overTimeMs / 1000;

        // Preferisci velocity esplicita se disponibile
        if (newest.vx !== undefined && newest.vy !== undefined) {
          this.renderX = newest.x + newest.vx * overTimeSec;
          this.renderY = newest.y + newest.vy * overTimeSec;
          this.renderRotation = newest.rotation;
          return;
        }

        // Fallback: calcola velocità da position delta
        if (secondNewest) {
          const timeDelta = newest.timestamp - secondNewest.timestamp;
          if (timeDelta > 0) {
            const t = Math.min(overTimeMs / timeDelta, 2.0);
            this.renderX = newest.x + (newest.x - secondNewest.x) * t;
            this.renderY = newest.y + (newest.y - secondNewest.y) * t;
            this.renderRotation = this.lerpAngle(secondNewest.rotation, newest.rotation, 1 + t);
            return;
          }
        }
      }

      // OVERRUN LUNGO: Il player probabilmente si è fermato.
      // Non aggiorniamo posizione -> Freeze visivo sull'ultimo frame valido
      return;
    }

    // CASO NORMALE - Binary Search per trovare i due snapshot
    let low = 0;
    let high = count - 1;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (this.snapshots[mid].timestamp <= renderTime) low = mid;
      else high = mid;
    }

    const prev = this.snapshots[low];
    const next = this.snapshots[high];
    const timeDelta = next.timestamp - prev.timestamp;

    // Protezione da divisione per zero
    if (timeDelta <= 0) {
      this.renderX = next.x;
      this.renderY = next.y;
      this.renderRotation = next.rotation;
      return;
    }

    const t = (renderTime - prev.timestamp) / timeDelta;

    // Assegnazione diretta (Linear Interpolation)
    this.renderX = prev.x + (next.x - prev.x) * t;
    this.renderY = prev.y + (next.y - prev.y) * t;
    this.renderRotation = this.lerpAngle(prev.rotation, next.rotation, t);
  }

  snapTo(x: number, y: number, rotation: number): void {
    const sanitized = InterpolationTarget.sanitizePosition(x, y, this.renderX, this.renderY);
    this.renderX = sanitized.x;
    this.renderY = sanitized.y;
    this.renderRotation = rotation;

    // Reset buffer
    const now = performance.now();
    this.snapshots = [{
      x: sanitized.x,
      y: sanitized.y,
      rotation,
      timestamp: now,
      tick: 0 // Reset tick state
    }];
    this.lastSnapshotTimestamp = now;
  }

  // ==========================================
  // GETTERS & UTILS
  // ==========================================

  get targetX(): number { return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].x : this.renderX; }
  get targetY(): number { return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].y : this.renderY; }
  get targetRotation(): number { return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1].rotation : this.renderRotation; }

  private static isValidPosition(x: number, y: number): boolean {
    return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) < 50000 && Math.abs(y) < 50000;
  }

  private static sanitizePosition(x: number, y: number, fbX: number, fbY: number) {
    return this.isValidPosition(x, y) ? { x, y } : { x: fbX, y: fbY };
  }

  private lerpAngle(from: number, to: number, t: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return this.normalizeAngle(from + diff * t);
  }

  private normalizeAngle(angle: number): number {
    angle = angle % (2 * Math.PI);
    return angle < 0 ? angle + 2 * Math.PI : angle;
  }
}
