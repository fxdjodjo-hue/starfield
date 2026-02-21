import { Component } from '../../infrastructure/ecs/Component';

/**
 * Last authoritative local-pet state received from the server.
 * Used by LocalPetFollowSystem for soft reconciliation.
 */
export class LocalPetServerState extends Component {
  public x: number;
  public y: number;
  public rotation: number;
  public isAttacking: boolean;
  public isCollecting: boolean;
  public serverTime: number;
  public receivedAt: number;

  constructor(
    x: number = 0,
    y: number = 0,
    rotation: number = 0,
    isAttacking: boolean = false,
    isCollecting: boolean = false,
    serverTime: number = Date.now(),
    receivedAt: number = Date.now()
  ) {
    super();
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.rotation = this.normalizeAngle(rotation);
    this.isAttacking = !!isAttacking;
    this.isCollecting = !!isCollecting;
    this.serverTime = Number.isFinite(serverTime) ? serverTime : Date.now();
    this.receivedAt = Number.isFinite(receivedAt) ? receivedAt : Date.now();
  }

  updateFromServer(
    x: number,
    y: number,
    rotation: number,
    isAttacking: boolean,
    isCollecting: boolean,
    serverTime: number,
    receivedAt: number = Date.now()
  ): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.x = x;
    this.y = y;
    this.rotation = this.normalizeAngle(rotation);
    this.isAttacking = !!isAttacking;
    this.isCollecting = !!isCollecting;
    this.serverTime = Number.isFinite(serverTime) ? serverTime : Date.now();
    this.receivedAt = Number.isFinite(receivedAt) ? receivedAt : Date.now();
  }

  private normalizeAngle(angle: number): number {
    if (!Number.isFinite(angle)) return 0;
    let normalized = angle;
    while (normalized > Math.PI) normalized -= 2 * Math.PI;
    while (normalized < -Math.PI) normalized += 2 * Math.PI;
    return normalized;
  }
}

