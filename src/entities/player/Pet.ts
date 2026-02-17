import { Component } from '../../infrastructure/ecs/Component';

export interface PetBehaviorOptions {
  petId: string;
  nickname?: string;
  isActive?: boolean;
  followDistance: number;
  lateralOffset: number;
  stopDistance: number;
  catchUpDistance: number;
  maxFollowSpeed: number;
  rotationFollowSpeed: number;
  hoverAmplitude: number;
  hoverFrequency: number;
  phaseOffset?: number;
}

export class Pet extends Component {
  public readonly petId: string;
  public nickname: string;
  public isActive: boolean;
  public readonly followDistance: number;
  public readonly lateralOffset: number;
  public readonly stopDistance: number;
  public readonly catchUpDistance: number;
  public readonly maxFollowSpeed: number;
  public readonly rotationFollowSpeed: number;
  public readonly hoverAmplitude: number;
  public readonly hoverFrequency: number;
  public readonly phaseOffset: number;

  constructor(options: PetBehaviorOptions) {
    super();
    this.petId = String(options.petId || 'pet').trim();
    const initialNickname = String(options.nickname || '').replace(/\s+/g, ' ').trim();
    this.nickname = initialNickname || this.petId;
    this.isActive = options.isActive !== false;
    this.followDistance = Math.max(0, Number(options.followDistance || 0));
    this.lateralOffset = Number(options.lateralOffset || 0);
    this.stopDistance = Math.max(0, Number(options.stopDistance || 0));
    this.catchUpDistance = Math.max(this.followDistance + this.stopDistance, Number(options.catchUpDistance || 0));
    this.maxFollowSpeed = Math.max(10, Number(options.maxFollowSpeed || 0));
    this.rotationFollowSpeed = Math.max(0.1, Number(options.rotationFollowSpeed || 0));
    this.hoverAmplitude = Math.max(0, Number(options.hoverAmplitude || 0));
    this.hoverFrequency = Math.max(0, Number(options.hoverFrequency || 0));
    this.phaseOffset = Number.isFinite(Number(options.phaseOffset))
      ? Number(options.phaseOffset)
      : Math.random() * Math.PI * 2;
  }

  setNickname(nextNickname: string): void {
    const normalizedNickname = String(nextNickname || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24)
      .trim();
    this.nickname = normalizedNickname || this.petId;
  }

  setActiveState(nextIsActive: boolean): void {
    this.isActive = nextIsActive !== false;
  }
}
