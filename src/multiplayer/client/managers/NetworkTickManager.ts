import { NETWORK_CONFIG } from '../../../config/NetworkConfig';

/**
 * Manages periodic network operations (heartbeat, position sync)
 * Separates tick-based logic from main network system for better organization
 */
export class NetworkTickManager {
  private lastPositionSyncTime = 0;
  private lastHeartbeatTime = 0;
  private tickCounter = 0;
  private lastSentPosition: { x: number; y: number; rotation: number } | null = null;

  // Message buffering for high-latency scenarios
  private positionBuffer: Array<{ position: { x: number; y: number; rotation: number }; timestamp: number }> = [];
  private maxBufferSize = 10; // Maximum buffered position updates (increased for stability)
  private bufferFlushThreshold = 5; // Flush buffer when it reaches this size
  private bufferDropCount = 0; // Track how many updates we've dropped

  // Callbacks for network operations
  private sendHeartbeatCallback?: () => void;
  private sendPositionCallback?: () => void;

  constructor(
    sendHeartbeat: () => void,
    sendPosition: (position: { x: number; y: number; rotation: number }) => void
  ) {
    this.sendHeartbeatCallback = sendHeartbeat;
    this.sendPositionCallback = sendPosition;
  }

  /**
   * Updates periodic network operations
   * Should be called every frame in the game loop
   */
  update(deltaTime: number): void {
    this.tickCounter++;

    const now = Date.now();

    // Sync player position at regular intervals
    if (now - this.lastPositionSyncTime > NETWORK_CONFIG.POSITION_SYNC_INTERVAL) {
      this.flushPositionBuffer();
      this.lastPositionSyncTime = now;
    }

    // Send periodic heartbeat to keep connection alive
    if (now - this.lastHeartbeatTime > NETWORK_CONFIG.HEARTBEAT_INTERVAL) {
      if (this.sendHeartbeatCallback) {
        this.sendHeartbeatCallback();
      }
      this.lastHeartbeatTime = now;
    }
  }

  /**
   * Buffers a position update for potential batching with size limits
   */
  bufferPositionUpdate(position: { x: number; y: number; rotation: number }): void {
    const now = Date.now();

    // Check if buffer is at maximum capacity
    if (this.positionBuffer.length >= this.maxBufferSize) {
      // Remove oldest update to make room for new one
      const dropped = this.positionBuffer.shift();
      this.bufferDropCount++;

      // Log buffer overflow periodically (not every time to avoid spam)
      if (this.bufferDropCount % 10 === 0) {
        console.warn(`[NETWORK] Position buffer overflow! Dropped ${this.bufferDropCount} updates. Buffer size: ${this.positionBuffer.length}/${this.maxBufferSize}`);
      }
    }

    // Add to buffer
    this.positionBuffer.push({
      position,
      timestamp: now
    });

    // Flush buffer if it gets too large (high-frequency updates)
    if (this.positionBuffer.length >= this.bufferFlushThreshold) {
      this.flushPositionBuffer();
    }
  }

  /**
   * Flushes the position buffer, sending the most recent position
   */
  private flushPositionBuffer(): void {
    if (this.positionBuffer.length === 0 || !this.sendPositionCallback) {
      return;
    }

    // Send the most recent position update
    const latestUpdate = this.positionBuffer[this.positionBuffer.length - 1];

    // Check if position OR rotation actually changed since last sent
    const shouldSend = !this.lastSentPosition ||
      Math.abs(latestUpdate.position.x - this.lastSentPosition.x) > NETWORK_CONFIG.POSITION_CHANGE_THRESHOLD ||
      Math.abs(latestUpdate.position.y - this.lastSentPosition.y) > NETWORK_CONFIG.POSITION_CHANGE_THRESHOLD ||
      Math.abs(latestUpdate.position.rotation - this.lastSentPosition.rotation) > NETWORK_CONFIG.ROTATION_CHANGE_THRESHOLD;

    if (shouldSend) {
      this.sendPositionCallback(latestUpdate.position);
      this.lastSentPosition = {
        x: latestUpdate.position.x,
        y: latestUpdate.position.y,
        rotation: latestUpdate.position.rotation
      };
    }

    // Clear buffer after sending
    this.positionBuffer = [];
  }

  /**
   * Resets all timing counters and buffers (useful after reconnection)
   */
  reset(): void {
    this.lastPositionSyncTime = 0;
    this.lastHeartbeatTime = 0;
    this.tickCounter = 0;
    this.lastSentPosition = null;
    this.positionBuffer = [];
    this.bufferDropCount = 0;
  }

  /**
   * Gets timing statistics for debugging
   */
  getTimingStats(): {
    tickCounter: number;
    timeSinceLastPositionSync: number;
    timeSinceLastHeartbeat: number;
    nextPositionSyncIn: number;
    nextHeartbeatIn: number;
    bufferSize: number;
    bufferDrops: number;
  } {
    const now = Date.now();
    return {
      tickCounter: this.tickCounter,
      timeSinceLastPositionSync: now - this.lastPositionSyncTime,
      timeSinceLastHeartbeat: now - this.lastHeartbeatTime,
      nextPositionSyncIn: Math.max(0, NETWORK_CONFIG.POSITION_SYNC_INTERVAL - (now - this.lastPositionSyncTime)),
      nextHeartbeatIn: Math.max(0, NETWORK_CONFIG.HEARTBEAT_INTERVAL - (now - this.lastHeartbeatTime)),
      bufferSize: this.positionBuffer.length,
      bufferDrops: this.bufferDropCount
    };
  }

  /**
   * Forces immediate heartbeat (useful for testing)
   */
  forceHeartbeat(): void {
    if (this.sendHeartbeatCallback) {
      this.sendHeartbeatCallback();
      this.lastHeartbeatTime = Date.now();
    }
  }

  /**
   * Forces immediate position sync (useful for testing)
   */
  forcePositionSync(position?: { x: number; y: number; rotation: number }): void {
    if (this.sendPositionCallback) {
      const positionToSend = position || this.positionBuffer[this.positionBuffer.length - 1]?.position;
      if (positionToSend) {
        this.flushPositionBuffer(); // Flush any buffered updates first
        this.sendPositionCallback(positionToSend);
        this.lastPositionSyncTime = Date.now();
        this.lastSentPosition = { x: positionToSend.x, y: positionToSend.y };
      }
    }
  }

  /**
   * Updates the heartbeat callback (useful for dynamic reconfiguration)
   */
  setHeartbeatCallback(callback: () => void): void {
    this.sendHeartbeatCallback = callback;
  }

  /**
   * Updates the position sync callback
   */
  setPositionCallback(callback: () => void): void {
    this.sendPositionCallback = callback;
  }

  /**
   * Gets the current tick counter
   */
  getTickCounter(): number {
    return this.tickCounter;
  }
}
