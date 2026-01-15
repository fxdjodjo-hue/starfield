/**
 * Frame definition from atlas file
 */
export interface SpriteFrame {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Parsed atlas data
 */
export interface AtlasData {
  imagePath: string;
  size: { width: number; height: number };
  frames: SpriteFrame[];
}

/**
 * Parser for LibGDX/TexturePacker .atlas format
 */
export class AtlasParser {
  /**
   * Parse atlas file content into structured data
   */
  static parse(content: string): AtlasData {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length < 4) {
      throw new Error('Invalid atlas format: not enough lines');
    }

    // First line: image filename
    const imagePath = lines[0];
    
    // Parse header (size, filter, repeat)
    let size = { width: 0, height: 0 };
    let lineIndex = 1;
    
    while (lineIndex < lines.length && !lines[lineIndex].startsWith('N')) {
      const line = lines[lineIndex];
      if (line.startsWith('size:')) {
        const [w, h] = line.substring(5).split(',').map(Number);
        size = { width: w, height: h };
      }
      lineIndex++;
    }

    // Parse frames
    const frames: SpriteFrame[] = [];
    
    while (lineIndex < lines.length) {
      const nameLine = lines[lineIndex];
      
      // Frame name (e.g., "N0000")
      if (nameLine.startsWith('N')) {
        const name = nameLine;
        lineIndex++;
        
        // Next line should be bounds
        if (lineIndex < lines.length && lines[lineIndex].startsWith('bounds:')) {
          const boundsStr = lines[lineIndex].substring(7);
          const [x, y, w, h] = boundsStr.split(',').map(Number);
          
          frames.push({
            name,
            x,
            y,
            width: w,
            height: h
          });
        }
      }
      lineIndex++;
    }

    // Sort frames by name to ensure correct order
    frames.sort((a, b) => a.name.localeCompare(b.name));

    return {
      imagePath,
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
    // Normalize rotation to 0 to 2π
    const twoPi = Math.PI * 2;
    let normalized = rotation % twoPi;
    if (normalized < 0) normalized += twoPi;
    
    // Map to frame index
    const frameIndex = Math.floor((normalized / twoPi) * frameCount) % frameCount;
    return frameIndex;
  }
}
