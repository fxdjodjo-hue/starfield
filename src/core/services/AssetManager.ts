import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import type { SpritesheetData } from '../../entities/AnimatedSprite';
import { AtlasParser } from '../utils/AtlasParser';
import { LoggerWrapper, LogCategory } from '../../core/data/LoggerWrapper';

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
        // Verify image is actually loaded with valid dimensions
        // Sometimes onload fires before image is fully decoded
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          // Wait a bit and check again (handles edge cases)
          setTimeout(() => {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              this.images.set(path, img);
              this.loadingPromises.delete(path);
              resolve(img);
            } else {
              this.loadingPromises.delete(path);
              reject(new Error(`Image loaded but has invalid dimensions: ${path}`));
            }
          }, 0);
        } else {
          this.images.set(path, img);
          this.loadingPromises.delete(path);
          resolve(img);
        }
      };

      img.onerror = () => {
        this.loadingPromises.delete(path);
        reject(new Error(`Failed to load image: ${path}`));
      };

      // Set src after attaching handlers to ensure handlers are ready
      img.src = path;
      
      // Fallback: if image is already cached and complete, resolve immediately
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        this.images.set(path, img);
        this.loadingPromises.delete(path);
        resolve(img);
      }
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
   * Supports multiple PNG images in one atlas
   * @param basePath Path without extension (e.g., '/assets/ships/ship106/ship106')
   */
  async loadSpritesheet(basePath: string): Promise<SpritesheetData> {
    // Check cache
    if (this.spritesheets.has(basePath)) {
      return this.spritesheets.get(basePath)!;
    }

    console.log(`[DEBUG_ASSET] Loading spritesheet: ${basePath}`);

    // Load atlas file
    const atlasPath = `${basePath}.atlas`;
    console.log(`[DEBUG_ASSET] Fetching atlas: ${atlasPath}`);
    const atlasResponse = await fetch(atlasPath);
    if (!atlasResponse.ok) {
      console.error(`[DEBUG_ASSET] Failed to load atlas: ${atlasPath}, status: ${atlasResponse.status}`);
      throw new Error(`Failed to load atlas: ${atlasPath}`);
    }
    const atlasContent = await atlasResponse.text();
    console.log(`[DEBUG_ASSET] Atlas loaded, content length: ${atlasContent.length}`);

    // Try to parse with utils parser first (supports multiple images)
    let allFrames: Array<{name: string, x: number, y: number, width: number, height: number}> = [];
    let combinedImage: HTMLImageElement;
    let frameWidth = 0;
    let frameHeight = 0;

    try {
      // Use parser to get all sections
      console.log(`[DEBUG_ASSET] Parsing atlas for ${basePath}`);
      const sections = AtlasParser.parseAtlasTextAll(atlasContent);
      console.log(`[DEBUG_ASSET] Atlas parsed: ${sections.length} sections found`);

      if (sections.length > 1) {
        // Multiple images: combine them into a single canvas
        const images: HTMLImageElement[] = [];
        const allFramesData: Array<{imageIndex: number, frame: any}> = [];
        
        // Load all images
        const baseDir = basePath.substring(0, basePath.lastIndexOf('/'));
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          const imagePath = `${baseDir}/${section.imagePath}`;
          const img = await this.loadImage(imagePath);
          images.push(img);
          
          // Add frames with image index
          for (const frame of section.frames) {
            allFramesData.push({ imageIndex: i, frame });
          }
        }

        // Create combined canvas
        const canvas = document.createElement('canvas');
        let totalWidth = 0;
        let maxHeight = 0;
        
        // Calculate dimensions
        for (const img of images) {
          totalWidth += img.width;
          maxHeight = Math.max(maxHeight, img.height);
        }
        
        canvas.width = totalWidth;
        canvas.height = maxHeight;
        const ctx = canvas.getContext('2d')!;
        
        // Draw all images side by side
        let currentX = 0;
        const imageOffsets: number[] = [];
        for (const img of images) {
          ctx.drawImage(img, currentX, 0);
          imageOffsets.push(currentX);
          currentX += img.width;
        }
        
        // Convert canvas to image
        combinedImage = await new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = canvas.toDataURL();
        });
        
        // Adjust frame coordinates for combined image
        for (const { imageIndex, frame } of allFramesData) {
          allFrames.push({
            name: frame.name,
            x: frame.x + imageOffsets[imageIndex],
            y: frame.y,
            width: frame.width,
            height: frame.height
          });
        }
        
        frameWidth = sections[0].frames[0]?.width || 0;
        frameHeight = sections[0].frames[0]?.height || 0;
      } else {
        // Single image: use standard parser
        console.log(`[DEBUG_ASSET] Single image case for ${basePath}`);
        const atlasData = AtlasParser.parse(atlasContent);
        console.log(`[DEBUG_ASSET] Atlas parsed: ${atlasData.frames?.length || 0} frames found`);
        const imagePath = `${basePath}.png`;
        console.log(`[DEBUG_ASSET] Loading image: ${imagePath}`);
        combinedImage = await this.loadImage(imagePath);
        console.log(`[DEBUG_ASSET] Image loaded: ${combinedImage.naturalWidth}x${combinedImage.naturalHeight}`);
        allFrames = atlasData.frames;
        console.log(`[DEBUG_ASSET] Final frames count: ${allFrames.length}`);
        
        // Calcola frameWidth e frameHeight dal primo frame valido
        if (atlasData.frames.length > 0) {
          const firstFrame = atlasData.frames[0];
          frameWidth = firstFrame.width || 0;
          frameHeight = firstFrame.height || 0;
          
          // Se ancora 0, prova a calcolarli dalla media dei frame
          if (frameWidth === 0 || frameHeight === 0) {
            const validFrames = atlasData.frames.filter(f => f.width > 0 && f.height > 0);
            if (validFrames.length > 0) {
              frameWidth = validFrames[0].width;
              frameHeight = validFrames[0].height;
            }
          }
        }
      }
    } catch (error) {
      // Fallback to standard parser
      const atlasData = AtlasParser.parse(atlasContent);
      const imagePath = `${basePath}.png`;
      combinedImage = await this.loadImage(imagePath);
      allFrames = atlasData.frames;
      
      // Calcola frameWidth e frameHeight dal primo frame valido
      if (atlasData.frames.length > 0) {
        const firstFrame = atlasData.frames[0];
        frameWidth = firstFrame.width || 0;
        frameHeight = firstFrame.height || 0;
        
        // Se ancora 0, prova a calcolarli dalla media dei frame
        if (frameWidth === 0 || frameHeight === 0) {
          const validFrames = atlasData.frames.filter(f => f.width > 0 && f.height > 0);
          if (validFrames.length > 0) {
            frameWidth = validFrames[0].width;
            frameHeight = validFrames[0].height;
          }
        }
      }
    }

    // Verify image is ready before creating spritesheet
    if (!combinedImage || combinedImage.naturalWidth === 0 || combinedImage.naturalHeight === 0) {
      throw new Error(`Spritesheet image not ready: ${basePath}.png`);
    }
    
    // Validate frames data
    if (!allFrames || allFrames.length === 0) {
      throw new Error(`No frames found in atlas: ${basePath}.atlas`);
    }
    
    if (frameWidth === 0 || frameHeight === 0 || frameWidth === undefined || frameHeight === undefined) {
      // Calcola da tutti i frame disponibili
      const validFrames = allFrames.filter(f => f.width > 0 && f.height > 0);
      if (validFrames.length > 0) {
        frameWidth = validFrames[0].width;
        frameHeight = validFrames[0].height;
      } else {
        LoggerWrapper.warn(LogCategory.SYSTEM, `No valid frames found for ${basePath}, using default dimensions`, {
          basePath,
          totalFrames: allFrames.length,
          validFrames: validFrames.length
        });
        // Fallback: usa dimensioni del primo frame anche se 0
        if (allFrames.length > 0) {
          frameWidth = allFrames[0].width || 189; // Default per ship106
          frameHeight = allFrames[0].height || 189;
        }
      }
    }

    const spritesheet: SpritesheetData = {
      image: combinedImage,
      frames: allFrames,
      frameWidth: frameWidth || 189, // Fallback se ancora undefined
      frameHeight: frameHeight || 189
    };

    // Cache
    this.spritesheets.set(basePath, spritesheet);

    return spritesheet;
  }

  /**
   * Create an AnimatedSprite from a spritesheet
   */
  async createAnimatedSprite(basePath: string, scale: number = 1): Promise<AnimatedSprite> {
    console.log(`[DEBUG_ASSET] Creating AnimatedSprite for: ${basePath}`);
    try {
      const spritesheet = await this.loadSpritesheet(basePath);
      console.log(`[DEBUG_ASSET] Spritesheet loaded for ${basePath}:`, {
        hasImage: !!spritesheet.image,
        frameCount: spritesheet.frames?.length || 0,
        frameWidth: spritesheet.frameWidth,
        frameHeight: spritesheet.frameHeight
      });
      const animatedSprite = new AnimatedSprite(spritesheet, scale);
      console.log(`[DEBUG_ASSET] AnimatedSprite created for ${basePath}:`, {
        framesCount: animatedSprite.spritesheet.frames?.length || 0,
        frameWidth: animatedSprite.spritesheet.frameWidth,
        frameHeight: animatedSprite.spritesheet.frameHeight
      });
      return animatedSprite;
    } catch (error) {
      console.error(`[DEBUG_ASSET] Failed to create AnimatedSprite for ${basePath}:`, error);
      throw error;
    }
  }

  /**
   * Get cached spritesheet if available
   */
  getSpritesheet(basePath: string): SpritesheetData | undefined {
    return this.spritesheets.get(basePath);
  }
}


