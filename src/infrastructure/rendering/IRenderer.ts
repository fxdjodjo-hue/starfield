import { Camera } from '../../entities/spatial/Camera';

/**
 * Rendering parameters for sprites
 */
export interface SpriteRenderParams {
  screenX: number;
  screenY: number;
  transform: {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };
  sprite: {
    image: HTMLImageElement;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    isLoaded(): boolean;
  };
  customRotation?: number;
}

/**
 * Rendering parameters for projectiles
 */
export interface ProjectileRenderParams {
  screenX: number;
  screenY: number;
  projectile: any; // Projectile entity
  params: {
    color: string;
    length: number;
    shadowColor?: string;
    shadowBlur?: number;
    lineWidth: number;
    hasImage: boolean;
    imageSize?: number;
    image?: HTMLImageElement;
  };
}

/**
 * Rendering parameters for explosions
 */
export interface ExplosionRenderParams {
  screenX: number;
  screenY: number;
  explosion: any; // Explosion entity
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    image: HTMLImageElement | null;
  } | null;
}

/**
 * Rendering parameters for health bars
 */
export interface HealthBarRenderParams {
  x: number;
  y: number;
  backgroundColor: string;
  fillColor: string;
  width: number;
  height: number;
  borderColor: string;
  borderWidth: number;
}

/**
 * Rendering parameters for circles (selection, range, etc.)
 */
export interface CircleRenderParams {
  x: number;
  y: number;
  radius: number;
  strokeStyle: string;
  lineWidth: number;
  globalAlpha?: number;
  fillStyle?: string;
  setLineDash?: number[];
}

/**
 * Interface for rendering abstraction
 * Allows switching between Canvas 2D, Pixi.js, or other rendering engines
 */
export interface IRenderer {
  /**
   * Clear the rendering surface
   */
  clear(): void;

  /**
   * Render a sprite with transform
   */
  renderSprite(params: SpriteRenderParams): void;

  /**
   * Render a projectile
   */
  renderProjectile(params: ProjectileRenderParams): void;

  /**
   * Render an explosion
   */
  renderExplosion(params: ExplosionRenderParams): void;

  /**
   * Render a health/shield bar
   */
  renderHealthBar(params: HealthBarRenderParams): void;

  /**
   * Render a circle (selection, range indicators, etc.)
   */
  renderCircle(params: CircleRenderParams): void;

  /**
   * Set the camera for coordinate transformations
   */
  setCamera(camera: Camera): void;

  /**
   * Get canvas/screen dimensions
   */
  getCanvasSize(): { width: number; height: number };

  /**
   * Save current rendering state
   */
  save(): void;

  /**
   * Restore previous rendering state
   */
  restore(): void;

  /**
   * Set global alpha
   */
  setGlobalAlpha(alpha: number): void;

  /**
   * Set global composite operation
   */
  setGlobalCompositeOperation(operation: string): void;
}