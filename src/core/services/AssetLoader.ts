/**
 * AssetLoader - Sistema centralizzato per caricamento risorse
 * Unifica caricamento immagini, audio, spritesheets e altre risorse
 */

import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';
import { CollectionManager } from '../data/CollectionManager';

export interface AssetLoadOptions {
  timeout?: number;
  retries?: number;
  priority?: 'low' | 'normal' | 'high';
}

export interface AssetLoadResult<T = any> {
  success: boolean;
  asset?: T;
  error?: string;
  loadTime?: number;
  size?: { width?: number; height?: number };
}

export interface AssetStats {
  loadedImages: number;
  loadingImages: number;
  failedImages: number;
  totalLoadTime: number;
  averageLoadTime: number;
  cacheHits: number;
}

export class AssetLoader {
  private static loadedImages: Map<string, HTMLImageElement> = new Map();
  private static loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();
  private static failedImages: Set<string> = new Set();
  private static loadStats = {
    totalLoadTime: 0,
    loadCount: 0,
    cacheHits: 0
  };

  /**
   * Carica un'immagine con caching e gestione errori avanzata
   */
  static async loadImage(
    path: string,
    options: AssetLoadOptions = {}
  ): Promise<AssetLoadResult<HTMLImageElement>> {
    const startTime = Date.now();
    const timeout = options.timeout || 10000; // 10 secondi default
    const retries = options.retries || 1;

    try {
      // Controlla cache
      if (this.loadedImages.has(path)) {
        this.loadStats.cacheHits++;
        const cachedImage = this.loadedImages.get(path)!;
        return {
          success: true,
          asset: cachedImage,
          loadTime: 0,
          size: { width: cachedImage.naturalWidth, height: cachedImage.naturalHeight }
        };
      }

      // Controlla se già in caricamento
      if (this.loadingPromises.has(path)) {
        const image = await this.loadingPromises.get(path)!;
        return {
          success: true,
          asset: image,
          loadTime: Date.now() - startTime,
          size: { width: image.naturalWidth, height: image.naturalHeight }
        };
      }

      // Controlla fallimenti precedenti (senza retry)
      if (this.failedImages.has(path) && retries <= 0) {
        return {
          success: false,
          error: `Image failed to load previously: ${path}`
        };
      }

      // Avvia caricamento
      const loadPromise = this.performImageLoad(path, timeout);
      this.loadingPromises.set(path, loadPromise);

      const image = await loadPromise;

      // Verifica dimensioni valide
      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        throw new Error(`Image has invalid dimensions: ${image.naturalWidth}x${image.naturalHeight}`);
      }

      // Cache l'immagine
      this.loadedImages.set(path, image);
      this.loadingPromises.delete(path);
      this.failedImages.delete(path); // Rimuovi da fallimenti se era presente

      const loadTime = Date.now() - startTime;
      this.loadStats.totalLoadTime += loadTime;
      this.loadStats.loadCount++;

      LoggerWrapper.performance(`Image loaded: ${path}`, {
        path: path,
        loadTime: loadTime,
        size: `${image.naturalWidth}x${image.naturalHeight}`,
        priority: options.priority || 'normal'
      });

      return {
        success: true,
        asset: image,
        loadTime: loadTime,
        size: { width: image.naturalWidth, height: image.naturalHeight }
      };

    } catch (error) {
      this.loadingPromises.delete(path);

      // Aggiungi ai fallimenti solo se non è un retry
      if (retries <= 0) {
        this.failedImages.add(path);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      LoggerWrapper.error(LogCategory.SYSTEM, `Failed to load image: ${path}`, error as Error, {
        path: path,
        timeout: timeout,
        retriesLeft: retries - 1,
        loadTime: Date.now() - startTime
      });

      // Retry se disponibile
      if (retries > 0) {
        LoggerWrapper.warn(LogCategory.SYSTEM, `Retrying image load: ${path} (${retries} retries left)`, {
          path: path,
          retriesLeft: retries
        });
        return this.loadImage(path, { ...options, retries: retries - 1 });
      }

      return {
        success: false,
        error: `Failed to load image ${path}: ${errorMessage}`,
        loadTime: Date.now() - startTime
      };
    }
  }

  /**
   * Carica multiple immagini in parallelo
   */
  static async loadImages(
    paths: string[],
    options: AssetLoadOptions = {}
  ): Promise<Map<string, AssetLoadResult<HTMLImageElement>>> {
    const startTime = Date.now();
    const promises = paths.map(path => this.loadImage(path, options));

    try {
      const results = await Promise.all(promises);
      const resultMap = new Map<string, AssetLoadResult<HTMLImageElement>>();

      paths.forEach((path, index) => {
        resultMap.set(path, results[index]);
      });

      const totalTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;

      LoggerWrapper.performance(`Batch image loading completed`, {
        totalImages: paths.length,
        successful: successCount,
        failed: paths.length - successCount,
        totalTime: totalTime,
        averageTime: totalTime / paths.length
      });

      return resultMap;
    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, 'Batch image loading failed', error as Error, {
        paths: paths,
        totalTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Carica un'immagine in modo sincrono (per fallback)
   */
  static loadImageSync(path: string): HTMLImageElement | null {
    try {
      // Controlla cache prima
      if (this.loadedImages.has(path)) {
        return this.loadedImages.get(path)!;
      }

      // Crea immagine sincrona
      const img = new Image();
      img.src = path;

      // Nota: Questo non aspetta il caricamento effettivo
      // È solo per casi di emergenza
      LoggerWrapper.warn(LogCategory.SYSTEM, `Sync image load used for: ${path}`, {
        path: path,
        note: 'This should only be used as fallback'
      });

      return img;
    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, `Sync image load failed: ${path}`, error as Error, {
        path: path
      });
      return null;
    }
  }

  /**
   * Carica un audio con gestione errori
   */
  static async loadAudio(
    path: string,
    options: AssetLoadOptions = {}
  ): Promise<AssetLoadResult<HTMLAudioElement>> {
    const startTime = Date.now();
    const timeout = options.timeout || 15000; // Audio può richiedere più tempo

    try {
      return await new Promise((resolve, reject) => {
        const audio = new Audio();

        const timeoutId = setTimeout(() => {
          reject(new Error(`Audio load timeout: ${path}`));
        }, timeout);

        audio.oncanplaythrough = () => {
          clearTimeout(timeoutId);
          const loadTime = Date.now() - startTime;

          LoggerWrapper.performance(`Audio loaded: ${path}`, {
            path: path,
            loadTime: loadTime,
            duration: audio.duration
          });

          resolve({
            success: true,
            asset: audio,
            loadTime: loadTime,
            size: { width: undefined, height: undefined } // Audio non ha dimensioni visive
          });
        };

        audio.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error(`Failed to load audio: ${path}`));
        };

        audio.src = path;
        audio.load();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      LoggerWrapper.error(LogCategory.SYSTEM, `Failed to load audio: ${path}`, error as Error, {
        path: path,
        timeout: timeout,
        loadTime: Date.now() - startTime
      });

      return {
        success: false,
        error: `Failed to load audio ${path}: ${errorMessage}`,
        loadTime: Date.now() - startTime
      };
    }
  }

  /**
   * Precarica risorse critiche all'avvio
   * Queste risorse vengono caricate in parallelo per evitare lag durante il gioco
   */
  static async preloadCriticalAssets(): Promise<{
    success: boolean;
    loadedCount: number;
    failedCount: number;
    totalTime: number;
  }> {
    const startTime = Date.now();
    const criticalAssets = [
      // Effetti di riparazione - spesso usati, evitano lag quando il player si ripara
      '/assets/repair/hprestore/hprestore.png',
      '/assets/repair/shieldrestore/shieldrestore.png',

      // Effetti di danno/repair base (se esistono)
      // '/assets/damage/damage.png',
      // '/assets/heal/heal.png',

      // Sprite critici del gioco (se necessario)
      // '/assets/ships/ship106/ship106.png',
      // '/assets/npc_ships/scouter/alien120.png',
    ];

    if (criticalAssets.length === 0) {
      LoggerWrapper.system('No critical assets to preload');
      return { success: true, loadedCount: 0, failedCount: 0, totalTime: 0 };
    }

    LoggerWrapper.system('Starting critical assets preload', {
      assetCount: criticalAssets.length,
      assets: criticalAssets
    });

    try {
      // Load each asset individually to avoid infinite retry loops
      const results = new Map<string, AssetLoadResult<HTMLImageElement>>();

      for (const asset of criticalAssets) {
        const result = await this.loadImage(asset, { priority: 'high', timeout: 5000, retries: 2 });
        results.set(asset, result);
      }

      const loadedCount = Array.from(results.values()).filter(r => r.success).length;
      const failedCount = results.size - loadedCount;
      const totalTime = Date.now() - startTime;

      LoggerWrapper.system('Critical assets preload completed', {
        loadedCount: loadedCount,
        failedCount: failedCount,
        totalTime: totalTime,
        successRate: `${loadedCount}/${criticalAssets.length}`
      });

      // Log fallimenti specifici per debugging
      if (failedCount > 0) {
        const failedAssets = Array.from(results.entries())
          .filter(([, result]) => !result.success)
          .map(([path, result]) => ({ path, error: result.error }));

        LoggerWrapper.warn(LogCategory.SYSTEM, 'Some critical assets failed to load', {
          failedAssets: failedAssets,
          totalFailed: failedCount
        });
      }

      return {
        success: failedCount === 0,
        loadedCount: loadedCount,
        failedCount: failedCount,
        totalTime: totalTime
      };
    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, 'Critical assets preload failed', error as Error, {
        totalTime: Date.now() - startTime,
        attemptedAssets: criticalAssets
      });
      return {
        success: false,
        loadedCount: 0,
        failedCount: criticalAssets.length,
        totalTime: Date.now() - startTime
      };
    }
  }

  /**
   * Esegue il caricamento effettivo dell'immagine
   */
  private static performImageLoad(path: string, timeout: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      const timeoutId = setTimeout(() => {
        reject(new Error(`Image load timeout: ${path}`));
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);

        // Verifica finale delle dimensioni
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          resolve(img);
        } else {
          reject(new Error(`Image loaded but has invalid dimensions: ${img.naturalWidth}x${img.naturalHeight}`));
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error(`Image failed to load: ${path}`));
      };

      // Forza crossOrigin per evitare problemi CORS
      img.crossOrigin = 'anonymous';
      img.src = path;
    });
  }

  /**
   * Rimuove un'immagine dalla cache
   */
  static unloadImage(path: string): boolean {
    const wasLoaded = this.loadedImages.delete(path);
    this.loadingPromises.delete(path);

    if (wasLoaded) {
      LoggerWrapper.system(`Image unloaded from cache: ${path}`, { path: path });
    }

    return wasLoaded;
  }

  /**
   * Pulisce la cache delle immagini
   */
  static clearCache(): void {
    const imageCount = this.loadedImages.size;
    CollectionManager.clear(this.loadedImages);
    CollectionManager.clear(this.loadingPromises);
    this.failedImages.clear();

    LoggerWrapper.system('Asset cache cleared', {
      imagesRemoved: imageCount
    });
  }

  /**
   * Ottiene statistiche di caricamento
   */
  static getStats(): AssetStats {
    return {
      loadedImages: this.loadedImages.size,
      loadingImages: this.loadingPromises.size,
      failedImages: this.failedImages.size,
      totalLoadTime: this.loadStats.totalLoadTime,
      averageLoadTime: this.loadStats.loadCount > 0 ?
        this.loadStats.totalLoadTime / this.loadStats.loadCount : 0,
      cacheHits: this.loadStats.cacheHits
    };
  }

  /**
   * Verifica se un'immagine è in cache
   */
  static isImageLoaded(path: string): boolean {
    return this.loadedImages.has(path);
  }

  /**
   * Ottiene un'immagine dalla cache (senza caricamento)
   */
  static getCachedImage(path: string): HTMLImageElement | null {
    return this.loadedImages.get(path) || null;
  }
}