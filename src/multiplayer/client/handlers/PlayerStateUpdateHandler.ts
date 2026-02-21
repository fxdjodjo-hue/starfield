import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import type { PlayerStateUpdateMessage, PetStatePayload } from '../../../config/NetworkConfig';
import { PlayerUpgrades } from '../../../entities/player/PlayerUpgrades';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { Inventory } from '../../../entities/player/Inventory';
import { DamageText } from '../../../entities/combat/DamageText';
import { NumberFormatter } from '../../../core/utils/ui/NumberFormatter';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { createPlayerShipAnimatedSprite } from '../../../core/services/PlayerShipSpriteFactory';
import { getSelectedPlayerShipSkinId, getUnlockedPlayerShipSkinIds } from '../../../config/ShipSkinConfig';
import { syncLocalPetCombatStats } from './utils/PetStateSync';
import { normalizeAmmoInventory, getSelectedAmmoCount } from '../../../core/utils/ammo/AmmoInventory';

/**
 * Gestisce gli aggiornamenti completi dello stato del giocatore dal server
 * (Server Authoritative - il server è l'unica fonte di verità)
 */
export class PlayerStateUpdateHandler extends BaseMessageHandler {
  constructor() {
    super('player_state_update');
  }


  handle(message: PlayerStateUpdateMessage, networkSystem: ClientNetworkSystem): void {
    const { inventory, upgrades, health, maxHealth, shield, maxShield, source, rewardsEarned, recentHonor, healthRepaired, shieldRepaired, items, shipSkins, resourceInventory, petState, crafting, ammo, ammoInventory, missileAmmo } = message;
    const normalizedResourceInventory = this.normalizeResourceInventory(resourceInventory);
    const normalizedPetState = this.normalizePetState(petState);
    const hasStructuredAmmoPayload = ammoInventory !== undefined || inventory?.ammo !== undefined;
    const hasLegacyAmmoPayload = Number.isFinite(Number(ammo));
    const shouldUseLegacyAmmoFallback = !hasStructuredAmmoPayload
      && hasLegacyAmmoPayload
      && !networkSystem.gameContext?.playerAmmoInventory;
    const hasAmmoPayload = hasStructuredAmmoPayload || shouldUseLegacyAmmoFallback;
    const normalizedAmmoInventory = hasAmmoPayload
      ? normalizeAmmoInventory(
        ammoInventory ?? inventory?.ammo ?? networkSystem.gameContext?.playerAmmoInventory,
        shouldUseLegacyAmmoFallback ? ammo : undefined
      )
      : null;
    const previousCredits = Number(networkSystem.gameContext?.playerInventory?.credits || 0);
    const previousCosmos = Number(networkSystem.gameContext?.playerInventory?.cosmos || 0);
    const previousSelectedShipSkinId = networkSystem.gameContext?.playerShipSkinId || '';

    // AGGIORNA IL GAME CONTEXT CON STATO COMPLETO (server authoritative)
    // Nota: inventory può essere undefined per messaggi di riparazione che aggiornano solo HP/shield
    if (networkSystem.gameContext && inventory) {
      // Aggiorna inventory nel GameContext - conserva missileAmmo se già presente
      networkSystem.gameContext.playerInventory = {
        ...networkSystem.gameContext.playerInventory,
        credits: inventory.credits,
        cosmos: inventory.cosmos,
        experience: inventory.experience,
        honor: inventory.honor,
        ammo: normalizedAmmoInventory ?? networkSystem.gameContext.playerAmmoInventory ?? networkSystem.gameContext.playerInventory?.ammo,
        missileAmmo: missileAmmo ?? networkSystem.gameContext.playerMissileInventory ?? networkSystem.gameContext.playerInventory?.missileAmmo,
        recentHonor: recentHonor // Includi RecentHonor se disponibile
      };
    }
    if (networkSystem.gameContext && normalizedAmmoInventory) {
      networkSystem.gameContext.playerAmmoInventory = normalizedAmmoInventory;
      networkSystem.gameContext.playerAmmo = getSelectedAmmoCount(normalizedAmmoInventory);
      networkSystem.gameContext.playerInventory = {
        ...networkSystem.gameContext.playerInventory,
        ammo: normalizedAmmoInventory
      };
    }

    if (networkSystem.gameContext && missileAmmo) {
      networkSystem.gameContext.playerMissileInventory = missileAmmo;
      // Also update generic inventory structure if needed
      networkSystem.gameContext.playerInventory = {
        ...networkSystem.gameContext.playerInventory,
        missileAmmo
      };
    }

    if (networkSystem.gameContext && shipSkins) {
      const selectedSkinId = getSelectedPlayerShipSkinId(shipSkins.selectedSkinId || null);
      const unlockedSkinIds = getUnlockedPlayerShipSkinIds(
        shipSkins.unlockedSkinIds || [],
        selectedSkinId
      );
      networkSystem.gameContext.playerShipSkinId = selectedSkinId;
      networkSystem.gameContext.unlockedPlayerShipSkinIds = unlockedSkinIds;
    }

    if (networkSystem.gameContext && normalizedResourceInventory) {
      networkSystem.gameContext.playerResourceInventory = normalizedResourceInventory;
      this.notifyResourceInventoryUpdated(normalizedResourceInventory);
    }

    if (networkSystem.gameContext && normalizedPetState) {
      networkSystem.gameContext.playerPetState = normalizedPetState;
      this.notifyPetStateUpdated(normalizedPetState);
      syncLocalPetCombatStats(networkSystem.getECS(), normalizedPetState);
    }

    // AGGIORNA L'ECONOMY SYSTEM CON STATO COMPLETO (server authoritative)
    const economySystem = networkSystem.getEconomySystem();
    if (economySystem && inventory) {
      // Imposta direttamente i valori dal server (server authoritative)
      economySystem.setCredits(inventory.credits, 'server_update');
      economySystem.setCosmos(inventory.cosmos, 'server_update');
      economySystem.setExperience(inventory.experience, 'server_update');
      economySystem.setHonor(inventory.honor, 'server_update');

      // Aggiorna RecentHonor in RankSystem se disponibile
      if (recentHonor !== undefined) {
        economySystem.setRecentHonor(recentHonor);
      }
    }


    // SINCRONIZZA GLI UPGRADE DEL PLAYER (Server Authoritative)
    if (upgrades) {
      const playerSystem = networkSystem.getPlayerSystem();
      if (playerSystem) {
        const playerEntity = playerSystem.getPlayerEntity();
        if (playerEntity && networkSystem.getECS()) {
          // Ottieni il componente PlayerUpgrades
          const ecs = networkSystem.getECS();
          const playerUpgrades = ecs?.getComponent(playerEntity, PlayerUpgrades);

          if (playerUpgrades) {
            playerUpgrades.setUpgrades(
              upgrades.hpUpgrades,
              upgrades.shieldUpgrades,
              upgrades.speedUpgrades,
              upgrades.damageUpgrades,
              upgrades.missileDamageUpgrades
            );

            // Resetta tutti gli upgrade in progress dato che abbiamo ricevuto una risposta dal server
            networkSystem.resetAllUpgradeProgress();

          }

          // Aggiorna componenti Health e Shield con valori server authoritative
          // Aggiorna immediatamente senza setTimeout per riparazioni in tempo reale
          if (playerEntity) {
            // Aggiorna Health component
            if (typeof health === 'number' && typeof maxHealth === 'number' && ecs) {
              const healthComponent = ecs.getComponent(playerEntity, Health);
              if (healthComponent) {
                // Avoid stale-max clamping by applying max/current in one call.
                healthComponent.setHealth(health, maxHealth);
              }
            }

            // Aggiorna Shield component
            if (typeof shield === 'number' && typeof maxShield === 'number' && ecs) {
              const shieldComponent = ecs.getComponent(playerEntity, Shield);
              if (shieldComponent) {
                // Avoid stale-max clamping by applying max/current in one call.
                shieldComponent.setShield(shield, maxShield);
              }
            }
          }
        }
      }
    }

    // Aggiorna Health e Shield anche se non ci sono upgrades (per messaggi di riparazione)
    // Questo è importante perché i messaggi di riparazione inviano solo health/shield senza upgrades
    if ((typeof health === 'number' || typeof shield === 'number')) {
      const playerSystem = networkSystem.getPlayerSystem();
      const ecs = networkSystem.getECS();
      if (playerSystem && ecs) {
        const playerEntity = playerSystem.getPlayerEntity();
        if (playerEntity) {
          // Aggiorna Health component
          if (typeof health === 'number' && typeof maxHealth === 'number') {
            const healthComponent = ecs.getComponent(playerEntity, Health);
            if (healthComponent) {
              // Avoid stale-max clamping by applying max/current in one call.
              healthComponent.setHealth(health, maxHealth);
            }
          }

          // Aggiorna Shield component
          if (typeof shield === 'number' && typeof maxShield === 'number') {
            const shieldComponent = ecs.getComponent(playerEntity, Shield);
            if (shieldComponent) {
              // Avoid stale-max clamping by applying max/current in one call.
              shieldComponent.setShield(shield, maxShield);
            }
          }
        }
      }
    }

    // Ottieni riferimento all'UiSystem per aggiornamenti successivi
    const uiSystem = networkSystem.getUiSystem();

    // SINCRONIZZA L'INVENTARIO ECS (se presente nel messaggio)
    if (items && networkSystem.getPlayerSystem()) {
      const ecs = networkSystem.getECS();
      const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
      if (ecs && playerEntity) {
        const inventoryComponent = ecs.getComponent(playerEntity, Inventory) as Inventory | undefined;
        if (inventoryComponent) {
          inventoryComponent.sync(items);
          // Ricalcola le stats locali per sicurezza (anche se il server ha mandato i valori finali)
          networkSystem.getPlayerSystem()?.refreshPlayerStats();
        }
      }
    }

    // Mostra notifica delle ricompense guadagnate (se presente)
    if (rewardsEarned) {
      // Chiama il RewardSystem per assegnare le ricompense e aggiornare le quest
      const rewardSystem = networkSystem.getRewardSystem();
      if (rewardSystem && rewardsEarned.npcType) {
        rewardSystem.assignRewardsFromServer({
          credits: rewardsEarned.credits,
          cosmos: rewardsEarned.cosmos || 0,
          experience: rewardsEarned.experience,
          honor: rewardsEarned.honor,
          droppedItems: rewardsEarned.droppedItems // Passa gli item droppati al sistema di log
        }, rewardsEarned.npcType);
      }
    }

    // 🔄 AGGIORNA LE UI IN TEMPO REALE DOPO TUTTI GLI AGGIORNAMENTI
    // Importante per riflettere immediatamente i cambiamenti di HP/Shield max dopo equipaggiamento
    if (uiSystem) {
      // Forza aggiornamento immediato dati HUD (credits/cosmos in alto a sinistra)
      const hasAmmoUpdate = normalizedAmmoInventory !== null;
      if ((inventory || hasAmmoUpdate) && typeof (uiSystem as any).updatePlayerData === 'function') {
        const updatePayload: any = {};
        if (inventory) {
          updatePayload.inventory = inventory;
        }
        if (hasAmmoUpdate) {
          updatePayload.ammoInventory = normalizedAmmoInventory;
          updatePayload.ammo = getSelectedAmmoCount(normalizedAmmoInventory);
        }
        if (missileAmmo) {
          updatePayload.missileAmmo = missileAmmo;
        }
        (uiSystem as any).updatePlayerData(updatePayload);
      }

      const uiManager = uiSystem.getUIManager();

      // 1. Aggiorna l'HUD classico
      uiSystem.showPlayerInfo();

      // 2. Aggiorna il pannello Pilot Status (UpgradePanel) se esiste
      const upgradePanel = uiSystem.getUpgradePanel();
      if (upgradePanel) {
        upgradePanel.updatePlayerStats();
      }

      // 3. Aggiorna il pannello Ship Systems (InventoryPanel) se esiste
      const inventoryPanel = uiManager.getPanel('inventory-panel');
      if (inventoryPanel && typeof (inventoryPanel as any).update === 'function') {
        if (source && source.startsWith('item_sell') && typeof (inventoryPanel as any).invalidateInventoryCache === 'function') {
          (inventoryPanel as any).invalidateInventoryCache();
        }
        (inventoryPanel as any).update();
      }

      if (normalizedResourceInventory) {
        const craftingPanel = uiManager.getPanel('crafting-panel');
        if (craftingPanel && typeof (craftingPanel as any).update === 'function') {
          (craftingPanel as any).update({
            resourceInventory: normalizedResourceInventory,
            petState: normalizedPetState ?? networkSystem.gameContext?.playerPetState ?? undefined
          });
        }
      }

      if (normalizedPetState) {
        const petPanel = uiManager.getPanel('pet-panel');
        if (petPanel && typeof (petPanel as any).update === 'function') {
          (petPanel as any).update({ petState: normalizedPetState });
        }
      }
    }

    if (inventory) {
      this.forceHudResourceRefresh(inventory);
    }

    if (shipSkins) {
      const selectedSkinId = getSelectedPlayerShipSkinId(shipSkins.selectedSkinId || null);
      if (selectedSkinId && selectedSkinId !== previousSelectedShipSkinId) {
        const playerEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
        const ecs = networkSystem.getECS();
        const assetManager = networkSystem.gameContext.assetManager;

        if (playerEntity && ecs && assetManager) {
          createPlayerShipAnimatedSprite(assetManager, selectedSkinId)
            .then((playerAnimatedSprite) => {
              ecs.addComponent(playerEntity, AnimatedSprite, playerAnimatedSprite);
              const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
              if (remotePlayerSystem && typeof remotePlayerSystem.updateSharedAnimatedSprite === 'function') {
                remotePlayerSystem.updateSharedAnimatedSprite(playerAnimatedSprite);
              }
            })
            .catch((error) => {
              if (import.meta.env.DEV) {
                console.warn(`[PlayerStateUpdateHandler] Failed to apply ship skin "${selectedSkinId}"`, error);
              }
            });
        }
      }
    }

    // Notifica esplicita vendite per feedback immediato all'utente
    if (source === 'item_sold' && typeof document !== 'undefined') {
      const sale = (message as any).sale;
      const saleCurrency = sale?.currency === 'cosmos' ? 'cosmos' : 'credits';
      const previousBalance = saleCurrency === 'cosmos' ? previousCosmos : previousCredits;
      const currentBalance = Number(
        saleCurrency === 'cosmos'
          ? (inventory?.cosmos ?? previousCosmos)
          : (inventory?.credits ?? previousCredits)
      );
      const fallbackDelta = Math.max(0, currentBalance - previousBalance);
      const soldAmount = Number(sale?.amount ?? fallbackDelta);
      const parsedQuantity = Number(sale?.quantity ?? 1);
      const soldQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0
        ? Math.floor(parsedQuantity)
        : 1;
      const currencyLabel = saleCurrency === 'cosmos' ? 'cosmos' : 'credits';
      const content = soldAmount > 0
        ? `Sold x${soldQuantity}: +${soldAmount} ${currencyLabel} (Total: ${currentBalance})`
        : 'Sale completed';

      document.dispatchEvent(new CustomEvent('ui:system-message', { detail: { content } }));
    }

    if (source === 'craft_item_success' && typeof document !== 'undefined') {
      const craftedName = String(crafting?.displayName || crafting?.itemId || crafting?.recipeId || 'Item').trim();
      document.dispatchEvent(new CustomEvent('ui:system-message', {
        detail: { content: `Craft completed: ${craftedName}` }
      }));
    }

    // Forza aggiornamento immediato di PlayerStatusDisplaySystem per messaggi di riparazione
    // (aggiorna HP/shield barre senza aspettare il prossimo UPDATE_INTERVAL)
    if ((typeof health === 'number' || typeof shield === 'number') && !upgrades) {
      const ecs = networkSystem.getECS();
      if (ecs) {
        // Cerca PlayerStatusDisplaySystem nell'ECS
        const systems = ecs.getSystems();
        const playerStatusSystem = systems.find((s: any) => s.constructor.name === 'PlayerStatusDisplaySystem') as any;
        if (playerStatusSystem && typeof playerStatusSystem.updateDisplay === 'function') {
          // Forza aggiornamento immediato del display
          playerStatusSystem.updateDisplay();
        }
      }
    }

    // Crea repair text se ci sono valori riparati (per messaggi di riparazione)
    if ((healthRepaired && healthRepaired > 0) || (shieldRepaired && shieldRepaired > 0)) {
      this.createRepairText(networkSystem, healthRepaired || 0, shieldRepaired || 0);
    }
  }

  private forceHudResourceRefresh(inventory: { credits: number; cosmos: number; experience: number; honor: number }): void {
    if (typeof document === 'undefined') return;

    const hudContainer = document.getElementById('player-hud');
    if (!hudContainer) return;

    const updateStat = (stat: 'credits' | 'cosmos' | 'experience' | 'honor', value: number): void => {
      const element = hudContainer.querySelector<HTMLElement>(`.stat-item[data-stat="${stat}"] .stat-value`);
      if (element) {
        element.textContent = NumberFormatter.format(Number(value || 0));
      }
    };

    updateStat('credits', inventory.credits);
    updateStat('cosmos', inventory.cosmos);
    updateStat('experience', inventory.experience);
    updateStat('honor', inventory.honor);
  }

  private normalizeResourceInventory(rawInventory: unknown): Record<string, number> | null {
    if (!rawInventory || typeof rawInventory !== 'object') return null;

    const normalizedInventory: Record<string, number> = {};
    for (const [rawType, rawQuantity] of Object.entries(rawInventory as Record<string, unknown>)) {
      const resourceType = String(rawType || '').trim();
      if (!resourceType) continue;

      const parsedQuantity = Number(rawQuantity);
      normalizedInventory[resourceType] = Number.isFinite(parsedQuantity)
        ? Math.max(0, Math.floor(parsedQuantity))
        : 0;
    }

    return normalizedInventory;
  }

  private notifyResourceInventoryUpdated(resourceInventory: Record<string, number>): void {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent('playerResourceInventoryUpdated', {
      detail: { resourceInventory }
    }));
  }

  private normalizePetState(rawPetState: unknown): PetStatePayload | null {
    if (!rawPetState || typeof rawPetState !== 'object') return null;

    const source = rawPetState as Record<string, unknown>;
    const petId = String(source.petId || '').trim();
    if (!petId) return null;

    const level = Math.max(1, Math.floor(Number(source.level || 1)));
    const maxLevel = Math.max(level, Math.floor(Number(source.maxLevel || level)));
    const experience = Math.max(0, Math.floor(Number(source.experience || 0)));
    const maxHealth = Math.max(1, Math.floor(Number(source.maxHealth || 1)));
    const maxShield = Math.max(0, Math.floor(Number(source.maxShield || 0)));
    const currentHealth = Math.max(0, Math.min(maxHealth, Math.floor(Number(source.currentHealth ?? maxHealth))));
    const currentShield = Math.max(0, Math.min(maxShield, Math.floor(Number(source.currentShield ?? maxShield))));
    const petNickname = String(source.petNickname ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24)
      .trim();
    const rawModuleSlot = source.moduleSlot ?? source.petModuleSlot ?? source.module ?? source.module_slot;
    const rawInventory = source.inventory ?? source.petInventory ?? source.cargo ?? source.pet_inventory;

    const moduleSlot = rawModuleSlot && typeof rawModuleSlot === 'object'
      ? (() => {
        const slotSource = rawModuleSlot as Record<string, unknown>;
        const itemId = String(slotSource.itemId ?? slotSource.id ?? slotSource.moduleId ?? '').trim();
        const itemName = String(slotSource.itemName ?? slotSource.name ?? '').trim();
        if (!itemId && !itemName) return undefined;

        return {
          itemId: itemId || itemName.toLowerCase().replace(/\s+/g, '_'),
          itemName: itemName || itemId,
          rarity: String(slotSource.rarity ?? slotSource.grade ?? 'common').trim().toLowerCase(),
          level: Math.max(1, Math.floor(Number(slotSource.level ?? slotSource.tier ?? 1)))
        };
      })()
      : undefined;

    const inventory: PetStatePayload['inventory'] = [];
    if (Array.isArray(rawInventory)) {
      for (const rawItem of rawInventory) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const itemSource = rawItem as Record<string, unknown>;
        const itemId = String(itemSource.itemId ?? itemSource.id ?? '').trim();
        const itemName = String(itemSource.itemName ?? itemSource.name ?? '').trim();
        if (!itemId && !itemName) continue;

        inventory.push({
          itemId: itemId || itemName.toLowerCase().replace(/\s+/g, '_'),
          itemName: itemName || itemId,
          quantity: Math.max(1, Math.floor(Number(itemSource.quantity ?? itemSource.count ?? 1))),
          rarity: String(itemSource.rarity ?? itemSource.grade ?? 'common').trim().toLowerCase()
        });
      }
    }

    const inventoryCapacity = Math.max(
      inventory.length,
      Math.floor(Number(source.inventoryCapacity ?? source.petInventoryCapacity ?? 8))
    );

    return {
      petId,
      petNickname: petNickname || petId,
      level,
      experience,
      maxLevel,
      currentHealth,
      maxHealth,
      currentShield,
      maxShield,
      isActive: source.isActive === undefined ? true : Boolean(source.isActive),
      moduleSlot,
      inventory,
      inventoryCapacity
    };
  }

  private notifyPetStateUpdated(petState: PetStatePayload): void {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent('playerPetStateUpdated', {
      detail: { petState }
    }));
  }

  /**
   * Crea repair text (simile a damage text ma con colori verdi/azzurri)
   */
  private createRepairText(networkSystem: ClientNetworkSystem, healthRepaired: number, shieldRepaired: number): void {
    const ecs = networkSystem.getECS();
    const playerSystem = networkSystem.getPlayerSystem();
    if (!ecs || !playerSystem) return;

    const playerEntity = playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    // Crea repair text per shield (azzurro, più in alto)
    if (shieldRepaired > 0) {
      const shieldTextEntity = ecs.createEntity();
      const repairText = new DamageText(
        shieldRepaired,
        playerEntity.id,
        (Math.random() - 0.5) * 20, // ±10px offset X
        -30, // Offset Y iniziale
        '#00ccff', // Azzurro per shield repair
        1500 // Lifetime 1.5 secondi
      );
      ecs.addComponent(shieldTextEntity, DamageText, repairText);
    }

    // Crea repair text per HP (verde, più in basso se c'è anche shield)
    if (healthRepaired > 0) {
      const healthTextEntity = ecs.createEntity();
      const repairText = new DamageText(
        healthRepaired,
        playerEntity.id,
        (Math.random() - 0.5) * 20, // ±10px offset X
        shieldRepaired > 0 ? -15 : -30, // Più in basso se c'è anche shield repair
        '#00ff88', // Verde per HP repair
        1500 // Lifetime 1.5 secondi
      );
      ecs.addComponent(healthTextEntity, DamageText, repairText);
    }
  }
}
