import { Sprite } from '../entities/Sprite';
import { AnimatedSprite } from '../entities/AnimatedSprite';
import type { SpritesheetData } from '../entities/AnimatedSprite';
import { AtlasParser } from './AtlasParser';

/**
 * AssetManager handles loading and managing game assets (sprites, sounds, etc.)
 */
export class AssetManager {
  private images: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();
  private spritesheets: Map<string, SpritesheetData> = new Map();

  /**
   * Load an image from the given path
   */
  async loadImage(path: string): Promise<HTMLImageElement> {
    // Check if already loaded
    if (this.images.has(path)) {
      return this.images.get(path)!;
    }

    // Check if currently loading
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }

    // Start loading
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.images.set(path, img);
        this.loadingPromises.delete(path);
        resolve(img);
      };

      img.onerror = () => {
        this.loadingPromises.delete(path);
        reject(new Error(`Failed to load image: ${path}`));
      };

      img.src = path;
    });

    this.loadingPromises.set(path, loadPromise);
    return loadPromise;
  }

  /**
   * Create a sprite from a loaded image
   */
  async createSprite(path: string, width?: number, height?: number, offsetX: number = 0, offsetY: number = 0): Promise<Sprite> {
    const image = await this.loadImage(path);
    return new Sprite(image, width, height, offsetX, offsetY);
  }

  /**
   * Get a loaded image if available
   */
  getImage(path: string): HTMLImageElement | undefined {
    return this.images.get(path);
  }

  /**
   * Check if an image is loaded
   */
  isImageLoaded(path: string): boolean {
    const img = this.images.get(path);
    return img ? img.complete && img.naturalWidth !== 0 : false;
  }

  /**
   * Preload multiple images
   */
  async preloadImages(paths: string[]): Promise<void> {
    const promises = paths.map(path => this.loadImage(path));
    await Promise.all(promises);
  }

  /**
   * Load an image synchronously (for immediate use)
   */
  loadImageSync(path: string): HTMLImageElement {
    // Check if already loaded
    if (this.images.has(path)) {
      return this.images.get(path)!;
    }

    // Create and load synchronously
    const img = new Image();
    img.src = path;
    this.images.set(path, img);
    return img;
  }

  /**
   * Get or create a cached image synchronously
   */
  getOrLoadImage(path: string): HTMLImageElement {
    return this.images.get(path) || this.loadImageSync(path);
  }

  /**
   * Load a spritesheet from atlas + png files
   * @param basePath Path without extension (e.g., '/assets/ships/ship106/ship106')
   */
  async loadSpritesheet(basePath: string): Promise<SpritesheetData> {
    // Check cache
    if (this.spritesheets.has(basePath)) {
      return this.spritesheets.get(basePath)!;
    }

    // Load atlas file
    const atlasPath = `${basePath}.atlas`;
    const atlasResponse = await fetch(atlasPath);
    if (!atlasResponse.ok) {
      throw new Error(`Failed to load atlas: ${atlasPath}`);
    }
    const atlasContent = await atlasResponse.text();

    // Parse atlas
    const atlasData = AtlasParser.parse(atlasContent);

    // Load spritesheet image
    const imagePath = `${basePath}.png`;
    const image = await this.loadImage(imagePath);

    // Get frame dimensions from first frame
    const frameWidth = atlasData.frames.length > 0 ? atlasData.frames[0].width : 0;
    const frameHeight = atlasData.frames.length > 0 ? atlasData.frames[0].height : 0;

    const spritesheet: SpritesheetData = {
      image,
      frames: atlasData.frames,
      frameWidth,
      frameHeight
    };

    // Cache
    this.spritesheets.set(basePath, spritesheet);

    return spritesheet;
  }

  /**
   * Create an AnimatedSprite from a spritesheet
   */
  async createAnimatedSprite(basePath: string, scale: number = 1): Promise<AnimatedSprite> {
    const spritesheet = await this.loadSpritesheet(basePath);
    return new AnimatedSprite(spritesheet, scale);
  }

  /**
   * Get cached spritesheet if available
   */
  getSpritesheet(basePath: string): SpritesheetData | undefined {
    return this.spritesheets.get(basePath);
  }
}


