import { Component } from '../../infrastructure/ecs/Component';

/**
 * Marker component for one-shot collect VFX rendered above ships.
 */
export class ResourceCollectEffect extends Component {
  public readonly source: string;
  public frameIndex: number;

  constructor(source: string = 'resource_collect', frameIndex: number = 0) {
    super();
    this.source = source;
    this.frameIndex = Math.max(0, Math.floor(frameIndex));
  }
}
