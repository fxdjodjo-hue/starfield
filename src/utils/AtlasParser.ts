/**
 * Parser per file texture atlas (formato LibGDX)
 */
export interface AtlasFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  offsetX?: number;
  offsetY?: number;
  origWidth?: number;
  origHeight?: number;
}

export interface AtlasData {
  image: HTMLImageElement;
  frames: AtlasFrame[];
}

export class AtlasParser {
  /**
   * Carica un'immagine PNG animata (come una GIF)
   */
  static async parseAnimatedPNG(imagePath: string): Promise<AtlasData> {
    try {
      // Carica l'immagine animata
      const image = await this.loadImage(imagePath);

      // Per immagini animate, creiamo un singolo "frame" che è l'immagine stessa
      const frames: AtlasFrame[] = [{
        name: 'animated_frame',
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
        rotated: false
      }];

      console.log(`💥 [ANIMATED_PNG] Loaded animated PNG: ${imagePath} (${image.width}x${image.height})`);

      return { image, frames };
    } catch (error) {
      console.error('Error loading animated PNG:', error);
      throw error;
    }
  }

  /**
   * Carica e parsa un file atlas (metodo legacy mantenuto per compatibilità)
   */
  static async parseAtlas(atlasPath: string, targetImageName?: string): Promise<AtlasData> {
    try {
      // Carica il file .atlas come testo
      const response = await fetch(atlasPath);
      if (!response.ok) {
        throw new Error(`Failed to load atlas: ${atlasPath}`);
      }

      const atlasText = await response.text();

      // Parsea tutte le sezioni dell'atlas
      const atlasSections = this.parseAtlasTextAll(atlasText);

      // Trova la sezione richiesta (o usa la prima se non specificata)
      const targetSection = targetImageName
        ? atlasSections.find(section => section.imagePath === targetImageName)
        : atlasSections[0];

      if (!targetSection) {
        throw new Error(`Target image "${targetImageName}" not found in atlas ${atlasPath}. Available: ${atlasSections.map(s => s.imagePath).join(', ')}`);
      }

      // Costruisci il path dell'immagine relativo alla directory assets
      // Le immagini esplosione sono in /assets/explosions/explosions_npc/
      const fullImagePath = `/assets/explosions/explosions_npc/${targetSection.imagePath}`;

      // Carica l'immagine atlas
      const image = await this.loadImage(fullImagePath);

      return { image, frames: targetSection.frames };
    } catch (error) {
      console.error('Error parsing atlas:', error);
      throw error;
    }
  }

  /**
   * Parsea il contenuto testuale dell'atlas (tutte le sezioni)
   */
  private static parseAtlasTextAll(atlasText: string): Array<{imagePath: string, frames: AtlasFrame[]}> {
    const lines = atlasText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const sections: Array<{imagePath: string, frames: AtlasFrame[]}> = [];
    let currentSection: {imagePath: string, frames: AtlasFrame[]} | null = null;
    let currentFrame: Partial<AtlasFrame> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Riga con il nome dell'immagine (inizia nuova sezione)
      if (line.endsWith('.png') && !line.includes(':')) {
        // Salva la sezione precedente se esiste
        if (currentSection && currentFrame.name) {
          currentSection.frames.push(currentFrame as AtlasFrame);
        }
        if (currentSection) {
          sections.push(currentSection);
        }

        // Inizia nuova sezione
        currentSection = {
          imagePath: line,
          frames: []
        };
        currentFrame = {};
        continue;
      }

      // Riga con il nome del frame
      if (!line.includes(':') && currentSection) {
        // Salva il frame precedente se esiste
        if (currentFrame.name) {
          currentSection.frames.push(currentFrame as AtlasFrame);
        }

        // Inizia nuovo frame
        currentFrame = {
          name: line,
          rotated: false
        };
        continue;
      }

      // Proprietà del frame
      if (line.includes(':') && currentSection) {
        const [key, value] = line.split(':').map(s => s.trim());

        switch (key) {
          case 'xy':
            const [x, y] = value.split(',').map(s => parseInt(s.trim()));
            currentFrame.x = x;
            currentFrame.y = y;
            break;
          case 'size':
            const [width, height] = value.split(',').map(s => parseInt(s.trim()));
            currentFrame.width = width;
            currentFrame.height = height;
            break;
          case 'orig':
            const [origWidth, origHeight] = value.split(',').map(s => parseInt(s.trim()));
            currentFrame.origWidth = origWidth;
            currentFrame.origHeight = origHeight;
            break;
          case 'offset':
            const [offsetX, offsetY] = value.split(',').map(s => parseInt(s.trim()));
            currentFrame.offsetX = offsetX;
            currentFrame.offsetY = offsetY;
            break;
          case 'rotate':
            currentFrame.rotated = value === 'true';
            break;
        }
      }
    }

    // Salva l'ultimo frame e sezione
    if (currentSection && currentFrame.name) {
      currentSection.frames.push(currentFrame as AtlasFrame);
    }
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Parsea il contenuto testuale dell'atlas (solo prima sezione - per retrocompatibilità)
   */
  private static parseAtlasText(atlasText: string): { imagePath: string, frames: AtlasFrame[] } {
    const sections = this.parseAtlasTextAll(atlasText);
    return sections.length > 0 ? sections[0] : { imagePath: '', frames: [] };
  }

  /**
   * Carica un'immagine
   */
  private static async loadImage(path: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
      img.src = path;
    });
  }

  /**
   * Estrae un singolo frame dall'atlas come immagine
   */
  static async extractFrame(atlasImage: HTMLImageElement, frame: AtlasFrame): Promise<HTMLImageElement> {
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Disegna il frame dall'atlas
    ctx.drawImage(
      atlasImage,
      frame.x, frame.y, frame.width, frame.height,  // sorgente
      0, 0, frame.width, frame.height              // destinazione
    );

    // Converte canvas in immagine e aspetta che sia caricata
    const frameImage = await this.createImageFromCanvas(canvas, frame.width, frame.height);

    return frameImage;
  }

  /**
   * Crea un'immagine da canvas e aspetta che sia caricata
   */
  private static async createImageFromCanvas(canvas: HTMLCanvasElement, width: number, height: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load extracted frame'));
      img.src = canvas.toDataURL();
      img.width = width;
      img.height = height;
    });
  }

  /**
   * Estrae tutti i frame dall'atlas
   */
  static async extractFrames(atlasData: AtlasData): Promise<HTMLImageElement[]> {
    const framePromises = atlasData.frames.map(frame => this.extractFrame(atlasData.image, frame));
    return await Promise.all(framePromises);
  }
}
