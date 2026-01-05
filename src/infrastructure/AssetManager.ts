import { Sprite } from '../entities/Sprite';

/**
 * AssetManager handles loading and managing game assets (sprites, sounds, etc.)
 */
export class AssetManager {
  private images: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

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
}


