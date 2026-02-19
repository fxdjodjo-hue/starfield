/**
 * Frame definition from spritesheet atlas
 */
export interface SpriteFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Spritesheet data with loaded image
 */
export interface SpritesheetData {
  image: HTMLImageElement;
  frames: SpriteFrame[];
  frameWidth: number;
  frameHeight: number;
}

/**
 * AnimatedSprite component for spritesheet-based rendering
 * Supports rotation-based frame selection (pre-rendered rotations)
 * 
 * Spritesheet convention:
 * - Frame 0: ship pointing RIGHT (0 rad)
 * - Frame order can be configured via `rotationFrameDirection`
 */
export class AnimatedSprite {
  public spritesheet: SpritesheetData;
  public scale: number;
  public offsetX: number;
  public offsetY: number;
  public visible: boolean = true;
  // Frame-orientation controls:
  // - direction: -1 keeps current historical mapping
  // - offset: per-asset angular correction in radians
  public rotationFrameDirection: 1 | -1 = -1;
  public rotationFrameOffset: number = 0;

  constructor(
    spritesheet: SpritesheetData,
    scale: number = 1,
    offsetX: number = 0,
    offsetY: number = 0
  ) {
    this.spritesheet = spritesheet;
    this.scale = scale;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  /**
   * Get the frame index for a given rotation (in radians)
   * Mapping can be tuned per asset using direction/offset fields.
   */
  getFrameForRotation(rotation: number): number {
    const frameCount = this.spritesheet.frames.length;
    const twoPi = Math.PI * 2;
    const direction = this.rotationFrameDirection === 1 ? 1 : -1;
    const safeRotation = Number.isFinite(rotation) ? rotation : 0;
    const safeOffset = Number.isFinite(this.rotationFrameOffset) ? this.rotationFrameOffset : 0;
    let normalized = (direction * (safeRotation + safeOffset)) % twoPi;
    if (normalized < 0) normalized += twoPi;

    return Math.floor((normalized / twoPi) * frameCount) % frameCount;
  }

  /**
   * Get a specific frame by index
   */
  getFrame(index: number): SpriteFrame {
    const safeIndex = Math.abs(index) % this.spritesheet.frames.length;
    return this.spritesheet.frames[safeIndex];
  }

  /**
   * Get the display width (scaled)
   */
  get width(): number {
    // Fallback: calcola da frame se frameWidth non è disponibile
    const frameWidth = this.spritesheet.frameWidth || (this.spritesheet.frames.length > 0 ? this.spritesheet.frames[0].width : 0);
    return frameWidth * this.scale;
  }

  /**
   * Get the display height (scaled)
   */
  get height(): number {
    // Fallback: calcola da frame se frameHeight non è disponibile
    const frameHeight = this.spritesheet.frameHeight || (this.spritesheet.frames.length > 0 ? this.spritesheet.frames[0].height : 0);
    return frameHeight * this.scale;
  }

  /**
   * Check if the spritesheet image is loaded and ready for rendering
   * More robust check that handles edge cases
   */
  isLoaded(): boolean {
    if (!this.spritesheet || !this.spritesheet.image) {
      return false;
    }

    const img = this.spritesheet.image;

    // Check if image is complete and has valid dimensions
    // naturalWidth/Height are 0 if image failed to load or is not ready
    const isComplete = img.complete;
    const hasValidDimensions = img.naturalWidth > 0 && img.naturalHeight > 0;

    // Additional check: verify image source is set (not empty string)
    const hasSource = !!img.src && img.src.length > 0;

    return isComplete && hasValidDimensions && hasSource;
  }

  /**
   * Check if the spritesheet has valid frame data
   */
  hasValidFrames(): boolean {
    return this.spritesheet &&
      Array.isArray(this.spritesheet.frames) &&
      this.spritesheet.frames.length > 0;
  }

  /**
   * Get total frame count
   */
  get frameCount(): number {
    return this.spritesheet.frames.length;
  }

  /**
   * Get weapon spawn point relative to ship center (in local sprite coordinates)
   * Returns position at the front of the ship (top of frame when pointing right)
   * @param rotation Current ship rotation in radians
   * @param offsetFromCenter Offset from center (0 = center, 0.5 = edge, 1.0 = front tip)
   * @returns Local coordinates {x, y} relative to sprite center
   */
  getWeaponSpawnPoint(rotation: number, offsetFromCenter: number = 0.4): { x: number; y: number } {
    // Fallback: calcola da frame se non disponibile
    const frameWidth = this.spritesheet.frameWidth || (this.spritesheet.frames.length > 0 ? this.spritesheet.frames[0].width : 0);
    const frameHeight = this.spritesheet.frameHeight || (this.spritesheet.frames.length > 0 ? this.spritesheet.frames[0].height : 0);

    // Default spawn point: front of ship (top of frame when pointing right)
    // Frame convention: Frame 0 points RIGHT, so front is at top of frame
    const localX = 0; // Center horizontally
    const localY = -(frameHeight / 2) * offsetFromCenter; // Front of ship (negative Y = up/forward)

    // Rotate the spawn point based on current rotation
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    return {
      x: localX * cos - localY * sin,
      y: localX * sin + localY * cos
    };
  }

  /**
   * Get weapon spawn point in world coordinates
   * @param shipX Ship world X position
   * @param shipY Ship world Y position
   * @param rotation Current ship rotation in radians
   * @param offsetFromCenter Offset from center (0 = center, 0.5 = edge, 1.0 = front tip)
   * @returns World coordinates {x, y}
   */
  getWeaponSpawnPointWorld(shipX: number, shipY: number, rotation: number, offsetFromCenter: number = 0.4): { x: number; y: number } {
    const local = this.getWeaponSpawnPoint(rotation, offsetFromCenter);
    const scaledX = local.x * this.scale;
    const scaledY = local.y * this.scale;

    return {
      x: shipX + scaledX,
      y: shipY + scaledY
    };
  }
}
