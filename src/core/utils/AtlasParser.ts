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

      // Costruisci il path dell'immagine basandosi sulla directory dell'atlas
      // Estrai la directory base dall'atlasPath (es. /assets/repair/hprestore/hprestore.atlas -> /assets/repair/hprestore/)
      const atlasDir = atlasPath.substring(0, atlasPath.lastIndexOf('/') + 1);
      const fullImagePath = `${atlasDir}${targetSection.imagePath}`;

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
   * Supporta due formati:
   * 1. Formato completo: xy:, size:, orig:, offset:, rotate:
   * 2. Formato semplice: bounds:x,y,w,h
   */
  static parseAtlasTextAll(atlasText: string): Array<{imagePath: string, frames: AtlasFrame[]}> {
    const lines = atlasText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length < 4) {
      throw new Error('Invalid atlas format: not enough lines');
    }

    const sections: Array<{imagePath: string, frames: AtlasFrame[]}> = [];
    let currentSection: {imagePath: string, frames: AtlasFrame[]} | null = null;
    let currentFrame: Partial<AtlasFrame> = {};
    let isBoundsFormat = false;

    // Rileva formato: cerca "bounds:" in qualsiasi riga dopo l'immagine
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].endsWith('.png')) {
        // Cerca "bounds:" nelle righe successive (non solo i+2)
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].startsWith('bounds:')) {
            isBoundsFormat = true;
            break;
          }
        }
        if (isBoundsFormat) break;
      }
    }

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

      // Formato bounds: (semplice)
      if (isBoundsFormat && line.startsWith('bounds:') && currentSection && currentFrame.name) {
        const boundsStr = line.substring(7);
        const [x, y, w, h] = boundsStr.split(',').map(s => parseInt(s.trim()));
        currentFrame.x = x;
        currentFrame.y = y;
        currentFrame.width = w;
        currentFrame.height = h;
        currentFrame.rotated = false;
        
        // Verifica che width e height siano validi
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
          console.warn(`[AtlasParser] Frame ${currentFrame.name} ha dimensioni invalide: width=${w}, height=${h} da bounds: ${boundsStr}`);
        }
        
        // Assicurati che il frame abbia tutte le proprietà richieste
        const frameToAdd: AtlasFrame = {
          name: currentFrame.name!,
          x: x,
          y: y,
          width: w,
          height: h,
          rotated: false,
          offsetX: currentFrame.offsetX,
          offsetY: currentFrame.offsetY,
          origWidth: currentFrame.origWidth,
          origHeight: currentFrame.origHeight
        };
        currentSection.frames.push(frameToAdd);
        currentFrame = {};
        continue;
      }

      // Riga con il nome del frame (formato completo o semplice)
      if (!line.includes(':') && currentSection && !isBoundsFormat) {
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

      // Nome frame per formato bounds (riga che inizia con N o altro nome)
      if (isBoundsFormat && !line.includes(':') && currentSection && !currentFrame.name && line.length > 0) {
        currentFrame = {
          name: line,
          rotated: false
        };
        continue;
      }

      // Proprietà del frame (formato completo)
      if (line.includes(':') && currentSection && !isBoundsFormat) {
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
    if (currentSection && currentFrame.name && !isBoundsFormat) {
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

  /**
   * Parse atlas file content into structured data (compatibilità con infrastructure/AtlasParser)
   * Supporta formato bounds:
   */
  static parse(content: string): { imagePath: string; size: { width: number; height: number }; frames: Array<{name: string; x: number; y: number; width: number; height: number}> } {
    const sections = this.parseAtlasTextAll(content);
    
    if (sections.length === 0) {
      throw new Error('No sections found in atlas');
    }

    const firstSection = sections[0];
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // Estrai size dall'header
    let size = { width: 0, height: 0 };
    for (const line of lines) {
      if (line.startsWith('size:')) {
        const sizeStr = line.substring(5).trim();
        const [w, h] = sizeStr.split(',').map(Number);
        size = { width: w, height: h };
        break;
      }
    }

    // Converti frames al formato semplice
    const frames = firstSection.frames.map(frame => ({
      name: frame.name,
      x: frame.x || 0,
      y: frame.y || 0,
      width: frame.width || 0,
      height: frame.height || 0
    }));

    // Verifica che i frame abbiano dimensioni valide
    const invalidFrames = frames.filter(f => !f.width || !f.height);
    if (invalidFrames.length > 0 && frames.length > 0) {
      console.warn(`[AtlasParser] Trovati ${invalidFrames.length} frame senza dimensioni valide. Primo frame valido:`, frames.find(f => f.width > 0 && f.height > 0));
    }

    // Ordina frames per nome
    frames.sort((a, b) => a.name.localeCompare(b.name));

    return {
      imagePath: firstSection.imagePath,
      size,
      frames
    };
  }

  /**
   * Get frame index from rotation angle
   * @param rotation Rotation in radians
   * @param frameCount Total number of frames
   * @returns Frame index (0 to frameCount-1)
   */
  static getRotationFrameIndex(rotation: number, frameCount: number): number {
    const twoPi = Math.PI * 2;
    let normalized = rotation % twoPi;
    if (normalized < 0) normalized += twoPi;
    const frameIndex = Math.floor((normalized / twoPi) * frameCount) % frameCount;
    return frameIndex;
  }
}
