import { PlayerHUD } from '../../../presentation/ui/PlayerHUD';
import { QuestTracker } from '../../../presentation/ui/QuestTracker';
import { WeaponStatus } from '../../../presentation/ui/WeaponStatus';
import type { PlayerSystem } from '../../player/PlayerSystem';
import { normalizeAmmoInventory, getSelectedAmmoCount } from '../../../core/utils/ammo/AmmoInventory';

/**
 * UIHUDManager - Gestisce aggiornamenti HUD e statistiche giocatore
 * Responsabilità: Sincronizzazione dati economici, statistiche player, aggiornamenti real-time UI
 * Orchestrazione tra sistemi economici, player e componenti UI
 */
export class UIHUDManager {
  private playerHUD: PlayerHUD;
  private questTracker: QuestTracker;
  private weaponStatus: WeaponStatus;
  private playerSystem: PlayerSystem | null = null;
  private playerId: number | null = null;
  private economyData: any = null;
  private economySystem: any = null;
  private context: any = null;
  private lastCombatStatusSyncAt: number = 0;
  private readonly COMBAT_STATUS_SYNC_INTERVAL_MS = 100;

  constructor(playerHUD: PlayerHUD, questTracker: QuestTracker, weaponStatus: WeaponStatus) {
    this.playerHUD = playerHUD;
    this.questTracker = questTracker;
    this.weaponStatus = weaponStatus;
  }

  /**
   * Imposta il riferimento all'EconomySystem
   */
  setEconomySystem(economySystem: any, updatePlayerDataCallback: (data: any) => void, onRankChange?: (newRank: string) => void): void {
    this.economySystem = economySystem;

    // Imposta i callback per aggiornare l'HUD quando i valori economici cambiano
    if (this.economySystem) {
      this.economySystem.setCreditsChangedCallback((newAmount: number, change: number) => {
        const inventory = {
          credits: newAmount,
          cosmos: this.economySystem?.getCosmos?.() || 0,
          experience: this.economySystem?.getExperience?.() || 0,
          honor: this.economySystem?.getHonor?.() || 0
        };

        // Aggiorna UI locale
        updatePlayerDataCallback({ inventory });
      });

      this.economySystem.setCosmosChangedCallback((newAmount: number, change: number) => {
        const inventory = {
          credits: this.economySystem?.getCredits?.() || 0,
          cosmos: newAmount,
          experience: this.economySystem?.getExperience?.() || 0,
          honor: this.economySystem?.getHonor?.() || 0
        };

        updatePlayerDataCallback({ inventory });
      });

      this.economySystem.setExperienceChangedCallback((newAmount: number, change: number, leveledUp: boolean) => {
        const inventory = {
          credits: this.economySystem?.getCredits?.() || 0,
          cosmos: this.economySystem?.getCosmos?.() || 0,
          experience: newAmount,
          honor: this.economySystem?.getHonor?.() || 0
        };

        updatePlayerDataCallback({ inventory });
      });

      this.economySystem.setHonorChangedCallback((newAmount: number, change: number, newRank?: string) => {
        const inventory = {
          credits: this.economySystem?.getCredits?.() || 0,
          cosmos: this.economySystem?.getCosmos?.() || 0,
          experience: this.economySystem?.getExperience?.() || 0,
          honor: newAmount
        };

        updatePlayerDataCallback({ inventory });

        // ✅ Updates rank/nickname via callback if provided
        if (newRank && onRankChange) {
          onRankChange(newRank);
        }
      });
    }
  }

  /**
   * Imposta l'ID del player per l'HUD
   */
  setPlayerId(playerId: number): void {
    this.playerId = playerId;
  }

  /**
   * Imposta il context
   */
  setContext(context: any): void {
    this.context = context;
  }

  setPlayerSystem(playerSystem: PlayerSystem | null): void {
    this.playerSystem = playerSystem;
  }

  /**
   * Mostra le informazioni del giocatore
   */
  showPlayerInfo(showChatCallback?: () => void): void {
    // Prima priorità: dati dal GameContext (server authoritative)
    let hudData = null;

    if (this.context && this.context.playerInventory) {
      // Calcola livello basato su experience (stessa logica di Experience component)
      const experience = this.context.playerInventory.experience || 0;
      let level = 1;
      let expForNextLevel = 10000; // Livello 2

      // Trova il livello corretto basato sull'experience cumulativa
      const levelRequirements: Record<number, number> = {
        2: 10000, 3: 30000, 4: 70000, 5: 150000, 6: 310000, 7: 630000,
        8: 1270000, 9: 2550000, 10: 5110000, 11: 10230000, 12: 20470000,
        13: 40950000, 14: 81910000, 15: 163910000, 16: 327750000, 17: 655430000,
        18: 1310790000, 19: 2621710000, 20: 5243410000, 21: 10487010000,
        22: 20973860000, 23: 41951120000, 24: 83902400000, 25: 167808800000,
        26: 335621600000, 27: 671248000000, 28: 1342496000000, 29: 2685000000000,
        30: 5369700000000, 31: 10739200000000, 32: 21478400000000,
        33: 42956800000000, 34: 85913600000000, 35: 171827200000000,
        36: 343654400000000, 37: 687308800000000, 38: 1374617600000000,
        39: 2749235200000000, 40: 5498470400000000, 41: 10996940800000000,
        42: 21993881600000000, 43: 43987763200000000, 44: 87975526400000000
      };

      for (const [lvl, reqExp] of Object.entries(levelRequirements)) {
        if (experience >= reqExp) {
          level = parseInt(lvl);
          expForNextLevel = levelRequirements[parseInt(lvl) + 1] || reqExp * 2;
        } else {
          expForNextLevel = reqExp;
          break;
        }
      }

      hudData = {
        level: level,
        playerId: this.context.playerId || this.playerId || 0,
        credits: this.context.playerInventory.credits || 0,
        cosmos: this.context.playerInventory.cosmos || 0,
        experience: experience, // experience is already the total experience from context
        expForNextLevel: expForNextLevel - (levelRequirements[level - 1] || 0),
        honor: this.context.playerInventory.honor || 0
      };
    }

    // Seconda priorità: dati dall'EconomySystem (se non abbiamo GameContext)
    if (!hudData) {
      const economyData = this.economySystem?.getPlayerEconomyStatus();
      if (economyData) {
        hudData = {
          level: economyData.level,
          playerId: this.playerId || 0,
          credits: economyData.credits,
          cosmos: economyData.cosmos,
          experience: economyData.experience,
          expForNextLevel: economyData.expForNextLevel,
          honor: economyData.honor
        };
      }
    }

    // Terza priorità: valori di default
    if (!hudData) {
      hudData = {
        level: 1,
        playerId: this.playerId || 0,
        credits: 0,
        cosmos: 0,
        experience: 0,
        expForNextLevel: 100,
        honor: 0
      };
    }

    const combatStatus = this.getCurrentCombatStatus();
    const normalizedAmmoInventory = normalizeAmmoInventory(
      this.context?.playerAmmoInventory ?? this.context?.playerInventory?.ammo,
      this.context?.playerAmmo
    );

    // Aggiorna sempre l'HUD con i dati disponibili
    this.playerHUD.updateData({
      ...hudData,
      ...combatStatus
    });
    this.weaponStatus.setAmmoShortcutCounts(normalizedAmmoInventory);
    // NON mostrare weaponStatus qui - verrà mostrato da showHud() dopo l'animazione camera
    // NON mostrare automaticamente - viene mostrato da hideLoadingScreen() quando la schermata di autenticazione è nascosta
    // this.playerHUD.show();

    // Mostra anche la chat (ora che tutto è pronto)
    if (showChatCallback) {
      showChatCallback();
    }
  }

  /**
   * Aggiorna i dati del giocatore ricevuti dal server
   */
  updatePlayerData(data: any): void {
    // Aggiorna i dati interni se esistono
    if (data.inventory) {
      this.economyData = {
        ...this.economyData,
        credits: data.inventory.credits || 0,
        cosmos: data.inventory.cosmos || 0,
        experience: data.inventory.experience || 0,
        honor: data.inventory.honor || 0
      };

      // 🔧 CRITICAL FIX: Aggiorna ANCHE il GameContext che l'HUD legge!
      if (this.context) {
        this.context.playerInventory = {
          ...this.context.playerInventory,
          credits: data.inventory.credits || 0,
          cosmos: data.inventory.cosmos || 0,
          experience: data.inventory.experience || 0,
          honor: data.inventory.honor || 0,
          ammo: data.inventory.ammo ?? this.context.playerInventory?.ammo
        };
      }
    }

    if (this.context) {
      const hasAmmoInventoryPayload = data.ammoInventory !== undefined || data.inventory?.ammo !== undefined;
      const hasLegacyAmmoPayload = Number.isFinite(Number(data.ammo));
      if (hasAmmoInventoryPayload || hasLegacyAmmoPayload) {
        const normalizedAmmoInventory = normalizeAmmoInventory(
          data.ammoInventory ?? data.inventory?.ammo ?? this.context.playerAmmoInventory,
          data.ammo
        );
        this.context.playerAmmoInventory = normalizedAmmoInventory;
        this.context.playerAmmo = getSelectedAmmoCount(normalizedAmmoInventory);
        this.context.playerInventory = {
          ...this.context.playerInventory,
          ammo: normalizedAmmoInventory
        };
      }
    }

    // Aggiorna gli upgrades nel GameContext
    if (data.upgrades) {
      if (this.context) {
        this.context.playerUpgrades = {
          ...this.context.playerUpgrades,
          hpUpgrades: data.upgrades.hpUpgrades || 0,
          shieldUpgrades: data.upgrades.shieldUpgrades || 0,
          speedUpgrades: data.upgrades.speedUpgrades || 0,
          damageUpgrades: data.upgrades.damageUpgrades || 0
        };
      }
    }

    // Forza aggiornamento immediato dell'HUD
    this.showPlayerInfo();
  }

  /**
   * Nasconde le informazioni del giocatore
   */
  hidePlayerInfo(): void {
    this.playerHUD.hide();
    this.questTracker.hide();
    this.weaponStatus.hide();
  }

  /**
   * Mostra l'HUD (ripristina visibilità)
   */
  showHud(): void {
    this.playerHUD.show();
    this.questTracker.show();
    this.weaponStatus.show();
  }

  /**
   * Mostra l'HUD espanso
   */
  showExpandedHud(): void {
    this.playerHUD.expand();
  }

  /**
   * Nasconde l'HUD espanso
   */
  hideExpandedHud(): void {
    this.playerHUD.collapse();
  }

  /**
   * Toggle dell'HUD
   */
  toggleHud(): void {
    if (this.playerHUD.isExpanded()) {
      this.hideExpandedHud();
    } else {
      this.showExpandedHud();
    }
  }

  /**
   * Aggiorna il progresso del cooldown dell'arma sullo slot ammo selezionato (0.0 a 1.0)
   */
  updateWeaponCooldown(cooldownProgress: number, cooldownRemaining: number = 0): void {
    this.weaponStatus.update(cooldownProgress, cooldownRemaining);
  }

  updatePlayerCombatStatus(force: boolean = false): void {
    const now = Date.now();
    if (!force && now - this.lastCombatStatusSyncAt < this.COMBAT_STATUS_SYNC_INTERVAL_MS) {
      return;
    }

    this.lastCombatStatusSyncAt = now;
    this.playerHUD.updateCombatStatus(this.getCurrentCombatStatus());
  }


  /**
   * Imposta il listener per il toggle dell'HUD
   */
  setupHudToggle(): (event: KeyboardEvent) => void {
    const toggleHandler = (event: KeyboardEvent) => {
      if (event.key === 'h' || event.key === 'H') {
        this.toggleHud();
      }
    };

    document.addEventListener('keydown', toggleHandler);
    return toggleHandler;
  }

  /**
   * Rimuove il listener del toggle HUD
   */
  removeHudToggleListener(listener: (event: KeyboardEvent) => void): void {
    document.removeEventListener('keydown', listener);
  }

  /**
   * Restituisce il PlayerHUD
   */
  getPlayerHUD(): PlayerHUD {
    return this.playerHUD;
  }

  getQuestTracker(): QuestTracker {
    return this.questTracker;
  }

  private getCurrentCombatStatus(): {
    currentHealth: number;
    maxHealth: number;
    currentShield: number;
    maxShield: number;
  } {
    const combatStatus = this.playerSystem?.getPlayerCombatStatus?.();
    if (combatStatus) {
      return combatStatus;
    }

    return {
      currentHealth: 0,
      maxHealth: 1,
      currentShield: 0,
      maxShield: 1
    };
  }
}
