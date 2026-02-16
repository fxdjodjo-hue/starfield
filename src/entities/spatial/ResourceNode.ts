import { Component } from '../../infrastructure/ecs/Component';

export class ResourceNode extends Component {
  public readonly resourceId: string;
  public readonly resourceType: string;
  public readonly debugHitbox: boolean;
  public readonly clickRadius: number;
  public readonly collectDistance: number;

  constructor(
    resourceId: string,
    resourceType: string,
    clickRadius: number,
    collectDistance: number,
    debugHitbox: boolean = false
  ) {
    super();
    this.resourceId = resourceId;
    this.resourceType = resourceType;
    this.clickRadius = clickRadius;
    this.collectDistance = collectDistance;
    this.debugHitbox = debugHitbox;
  }
}
