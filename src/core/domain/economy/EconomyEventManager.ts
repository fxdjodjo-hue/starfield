/**
 * Manages economy event callbacks
 */
export class EconomyEventManager {
  private onCreditsChanged?: (newAmount: number, change: number) => void;
  private onCosmosChanged?: (newAmount: number, change: number) => void;
  private onExperienceChanged?: (newAmount: number, change: number, leveledUp: boolean) => void;
  private onHonorChanged?: (newAmount: number, change: number, newRank?: string) => void;

  /**
   * Sets callback for Credits changes
   */
  setCreditsChangedCallback(callback: (newAmount: number, change: number) => void): void {
    this.onCreditsChanged = callback;
  }

  /**
   * Sets callback for Cosmos changes
   */
  setCosmosChangedCallback(callback: (newAmount: number, change: number) => void): void {
    this.onCosmosChanged = callback;
  }

  /**
   * Sets callback for Experience changes
   */
  setExperienceChangedCallback(callback: (newAmount: number, change: number, leveledUp: boolean) => void): void {
    this.onExperienceChanged = callback;
  }

  /**
   * Sets callback for Honor changes
   */
  setHonorChangedCallback(callback: (newAmount: number, change: number, newRank?: string) => void): void {
    this.onHonorChanged = callback;
  }

  /**
   * Gets callback for Credits changes
   */
  getOnCreditsChanged(): ((newAmount: number, change: number) => void) | undefined {
    return this.onCreditsChanged;
  }

  /**
   * Gets callback for Cosmos changes
   */
  getOnCosmosChanged(): ((newAmount: number, change: number) => void) | undefined {
    return this.onCosmosChanged;
  }

  /**
   * Gets callback for Experience changes
   */
  getOnExperienceChanged(): ((newAmount: number, change: number, leveledUp: boolean) => void) | undefined {
    return this.onExperienceChanged;
  }

  /**
   * Gets callback for Honor changes
   */
  getOnHonorChanged(): ((newAmount: number, change: number, newRank?: string) => void) | undefined {
    return this.onHonorChanged;
  }

}
