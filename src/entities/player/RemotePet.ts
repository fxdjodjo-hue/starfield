import { Component } from '../../infrastructure/ecs/Component';

/**
 * Component that identifies an entity as a remote player's pet.
 * Kept separate from local Pet to avoid local follow logic side effects.
 */
export class RemotePet extends Component {
  public readonly ownerClientId: string;
  public petId: string;
  public nickname: string;
  public isActive: boolean;
  public isCollecting: boolean = false;

  constructor(ownerClientId: string, petId: string, nickname: string, isActive: boolean = true) {
    super();
    this.ownerClientId = String(ownerClientId || '').trim();
    this.petId = String(petId || '').trim() || 'pet';
    this.nickname = this.normalizeNickname(nickname, this.petId);
    this.isActive = Boolean(isActive);
  }

  updateState(petId: string, nickname: string, isActive: boolean = true, isCollecting: boolean = false): void {
    const nextPetId = String(petId || '').trim();
    this.petId = nextPetId || this.petId || 'pet';
    this.nickname = this.normalizeNickname(nickname, this.petId);
    this.isActive = Boolean(isActive);
    this.isCollecting = Boolean(isCollecting);
  }

  private normalizeNickname(rawNickname: string, fallback: string): string {
    const normalized = String(rawNickname || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24)
      .trim();
    return normalized || fallback || 'Pet';
  }
}

