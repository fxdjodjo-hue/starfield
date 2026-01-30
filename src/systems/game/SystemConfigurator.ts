// SystemConfigurator - Configurazione interazioni e dipendenze tra sistemi
// Responsabilità: Configurare callbacks, riferimenti, ordine esecuzione
// Dipendenze: ECS, GameContext, CreatedSystems

import { ECS } from '../../infrastructure/ecs/ECS';
import { GameContext } from '../../infrastructure/engine/GameContext';
import type { CreatedSystems } from './SystemFactory';
import { DisplayManager } from '../../infrastructure/display';

export interface SystemConfiguratorDependencies {
  ecs: ECS;
  context: GameContext;
  systems: CreatedSystems;
  playerStatusDisplaySystem: any;
  clientNetworkSystem?: any;
}

export class SystemConfigurator {
  /**
   * Aggiunge tutti i sistemi all'ECS nell'ordine corretto
   */
  static addSystemsToECS(ecs: ECS, systems: CreatedSystems, interpolationSystem?: any): void {
    const {
      inputSystem, playerControlSystem, npcSelectionSystem, npcMovementSystem, npcBehaviorSystem,
      damageSystem, projectileCreationSystem, combatStateSystem,
      cameraSystem, explosionSystem, repairEffectSystem, projectileSystem, movementSystem,
      parallaxSystem, renderSystem, boundsSystem, minimapSystem,
      damageTextSystem, chatTextSystem, logSystem, economySystem, rankSystem,
      rewardSystem, questSystem, questDiscoverySystem, uiSystem, playerStatusDisplaySystem,
      playerSystem, portalSystem, remoteNpcSystem, remoteProjectileSystem, asteroidSystem
    } = systems;

    // Ordine importante per l'esecuzione
    ecs.addSystem(inputSystem);
    ecs.addSystem(npcSelectionSystem);
    ecs.addSystem(npcBehaviorSystem);
    ecs.addSystem(npcMovementSystem);
    ecs.addSystem(playerControlSystem);
    ecs.addSystem(playerSystem);
    ecs.addSystem(damageSystem);
    ecs.addSystem(projectileCreationSystem);
    ecs.addSystem(combatStateSystem);
    ecs.addSystem(explosionSystem);
    ecs.addSystem(repairEffectSystem);
    ecs.addSystem(projectileSystem);
    ecs.addSystem(cameraSystem);
    // InterpolationSystem deve essere eseguito PRIMA di MovementSystem per aggiornare posizioni interpolate
    if (interpolationSystem) {
      ecs.addSystem(interpolationSystem);
    }
    ecs.addSystem(movementSystem);
    ecs.addSystem(asteroidSystem); // Aggiorna posizione e rotazione asteroidi
    ecs.addSystem(parallaxSystem);
    ecs.addSystem(renderSystem);
    ecs.addSystem(boundsSystem);
    ecs.addSystem(minimapSystem);
    ecs.addSystem(damageTextSystem);
    ecs.addSystem(chatTextSystem);
    ecs.addSystem(logSystem);
    ecs.addSystem(economySystem);
    ecs.addSystem(rankSystem);
    ecs.addSystem(rewardSystem);
    ecs.addSystem(questSystem);
    ecs.addSystem(questDiscoverySystem);
    ecs.addSystem(portalSystem);
    ecs.addSystem(remoteNpcSystem);
    ecs.addSystem(remoteProjectileSystem);
    if (uiSystem) {
      ecs.addSystem(uiSystem);
    }
    ecs.addSystem(systems.safeZoneSystem);
    ecs.addSystem(playerStatusDisplaySystem);
  }

  /**
   * Configura le interazioni e dipendenze tra sistemi
   */
  static configureSystemInteractions(deps: SystemConfiguratorDependencies): void {
    const { ecs, context, systems, playerStatusDisplaySystem, clientNetworkSystem } = deps;
    const {
      movementSystem, playerControlSystem, npcSelectionSystem, minimapSystem, economySystem,
      rankSystem, rewardSystem, damageSystem, projectileCreationSystem, combatStateSystem,
      logSystem, boundsSystem, questTrackingSystem, inputSystem,
      chatTextSystem, uiSystem, cameraSystem, audioSystem, portalSystem
    } = systems;

    // Configura sistemi che richiedono riferimenti ad altri sistemi
    playerControlSystem.setCamera(cameraSystem.getCamera());
    playerControlSystem.setCameraSystem(cameraSystem);
    playerControlSystem.setAudioSystem(audioSystem);
    playerControlSystem.setLogSystem(logSystem);
    minimapSystem.setCamera(cameraSystem.getCamera());

    // Collega AudioSystem ai sistemi di combattimento
    if (projectileCreationSystem && typeof projectileCreationSystem.setAudioSystem === 'function') {
      projectileCreationSystem.setAudioSystem(audioSystem);
    }

    // Collega AudioSystem al sistema bounds
    if (boundsSystem && typeof boundsSystem.setAudioSystem === 'function') {
      boundsSystem.setAudioSystem(audioSystem);
    }

    // Collega AudioSystem al sistema UI
    if (uiSystem && typeof uiSystem.setAudioSystem === 'function') {
      uiSystem.setAudioSystem(audioSystem);
    }

    economySystem.setRankSystem(rankSystem);
    rankSystem.setPlayerEntity(null); // Sarà impostato dopo creazione player
    rewardSystem.setEconomySystem(economySystem);
    rewardSystem.setLogSystem(logSystem);
    boundsSystem.setPlayerEntity(null); // Sarà impostato dopo creazione player
    rewardSystem.setQuestTrackingSystem(questTrackingSystem);
    questTrackingSystem.setEconomySystem(economySystem);
    questTrackingSystem.setLogSystem(logSystem);

    // Configura callbacks per minimappa
    minimapSystem.setMoveToCallback((worldX: number, worldY: number) => {
      playerControlSystem.movePlayerTo(worldX, worldY);
    });

    playerControlSystem.setMinimapMovementCompleteCallback(() => {
      minimapSystem.clearDestination();
    });

    // Configura input handlers
    inputSystem.setMouseStateCallback((pressed: boolean, x: number, y: number, button?: number) => {
      if (pressed) {
        context.canvas.focus();

        // Minimappa ha priorità
        const minimapHandled = minimapSystem.handleMouseDown(x, y);

        // Controlla se il click è nel pannello glass della minimappa (anche nei bordi)
        const inMinimapGlassPanel = minimapSystem.isClickInGlassPanel(x, y);

        // Controlla se il click è nell'HUD del player status
        const inPlayerStatusHUD = playerStatusDisplaySystem.isClickInHUD(x, y);

        if (!minimapHandled && !inMinimapGlassPanel && !inPlayerStatusHUD) {
          // Converti coordinate schermo in coordinate mondo per la selezione NPC usando dimensioni logiche
          const { width, height } = DisplayManager.getInstance().getLogicalSize();
          const worldPos = cameraSystem.getCamera().screenToWorld(x, y, width, height);

          // Per click sinistro: prova selezione NPC, altrimenti movimento
          if (button === 0 || button === undefined) {
            const npcSelected = npcSelectionSystem.handleMouseClick(worldPos.x, worldPos.y);

            if (!npcSelected) {
              // Se non è stato selezionato un NPC, gestisci movimento player
              minimapSystem.clearDestination();
              playerControlSystem.handleMouseState(pressed, x, y);
            }
          }
          // Per click destro: solo selezione NPC (non movimento)
          // Il callback del click destro è gestito separatamente sotto
        }
      } else {
        minimapSystem.handleMouseUp();
        playerControlSystem.handleMouseState(pressed, x, y);
      }
    });

    // Callback per click destro - dedicato esclusivamente alla selezione NPC
    inputSystem.setRightMouseStateCallback((pressed: boolean, x: number, y: number) => {
      if (pressed) {
        context.canvas.focus();

        // Non controllare minimappa o HUD per click destro - è sempre selezione NPC
        const { width, height } = DisplayManager.getInstance().getLogicalSize();
        const worldPos = cameraSystem.getCamera().screenToWorld(x, y, width, height);

        // Click destro = sempre selezione NPC (se presente vicino al click)
        npcSelectionSystem.handleMouseClick(worldPos.x, worldPos.y);
      }
    });

    inputSystem.setMouseMoveWhilePressedCallback((x: number, y: number) => {
      const minimapHandled = minimapSystem.handleMouseMove(x, y);
      if (!minimapHandled) {
        playerControlSystem.handleMouseMoveWhilePressed(x, y);
      }
    });

    // Collega InputSystem al PortalSystem
    if (portalSystem && typeof portalSystem.setInputSystem === 'function') {
      portalSystem.setInputSystem(inputSystem);
    }

    // Collega ClientNetworkSystem al PortalSystem
    if (portalSystem && typeof portalSystem.setClientNetworkSystem === 'function' && clientNetworkSystem) {
      portalSystem.setClientNetworkSystem(clientNetworkSystem);
    }

    // Collega assets al ClientNetworkSystem per gestione cambi mappa
    if (clientNetworkSystem && typeof clientNetworkSystem.setAssets === 'function') {
      clientNetworkSystem.setAssets(systems.assets);
    }

    // Configura gestione tasti
    inputSystem.setKeyPressCallback((key: string) => {
      // Gestisci tasto E per portali
      if (key === 'e' && portalSystem && typeof portalSystem.handleEKeyPress === 'function') {
        portalSystem.handleEKeyPress();
      }
      // Gestisci altri tasti per player
      else {
        playerControlSystem.handleKeyPress(key);
      }
    });

    inputSystem.setKeyReleaseCallback((key: string) => {
      playerControlSystem.handleKeyRelease(key);
    });

    // Configura selezione NPC
    npcSelectionSystem.setOnNpcClickCallback((npcEntity: any) => {
      // La disattivazione dell'attacco è ora gestita direttamente nel NpcSelectionSystem
      // quando cambia la selezione, per una gestione più precisa
    });
  }

  /**
   * Configura ClientNetworkSystem nei sistemi che ne hanno bisogno
   */
  static configureClientNetworkSystem(
    ecs: ECS,
    clientNetworkSystem: any,
    systems: CreatedSystems,
    systemsCache?: any
  ): void {
    // Imposta il riferimento all'ECS per la gestione del combattimento
    if (clientNetworkSystem && typeof clientNetworkSystem.setEcs === 'function') {
      clientNetworkSystem.setEcs(ecs);
    }

    // Configura i sistemi modulari con il ClientNetworkSystem
    if (systems.combatStateSystem && typeof systems.combatStateSystem.setClientNetworkSystem === 'function') {
      systems.combatStateSystem.setClientNetworkSystem(clientNetworkSystem);
    }

    if (systems.projectileCreationSystem && typeof systems.projectileCreationSystem.setClientNetworkSystem === 'function') {
      systems.projectileCreationSystem.setClientNetworkSystem(clientNetworkSystem);
    }

    // Imposta il ClientNetworkSystem anche nel MinimapSystem per il rendering dei giocatori remoti
    if (systems.minimapSystem && typeof systems.minimapSystem.setClientNetworkSystem === 'function') {
      systems.minimapSystem.setClientNetworkSystem(clientNetworkSystem);
      if (clientNetworkSystem && typeof clientNetworkSystem.setMinimapSystem === 'function') {
        clientNetworkSystem.setMinimapSystem(systems.minimapSystem);
      }
    }

    // Imposta il ClientNetworkSystem nel PortalSystem
    if (systems.portalSystem && typeof systems.portalSystem.setClientNetworkSystem === 'function') {
      systems.portalSystem.setClientNetworkSystem(clientNetworkSystem);
    }

    // Configura le impostazioni specifiche del ClientNetworkSystem
    if (clientNetworkSystem && systemsCache) {
      if (systemsCache.logSystem) {
        clientNetworkSystem.setLogSystem(systemsCache.logSystem);
      }
      if (systemsCache.uiSystem) {
        clientNetworkSystem.setUiSystem(systemsCache.uiSystem);
      }
      if (systemsCache.economySystem) {
        clientNetworkSystem.setEconomySystem(systemsCache.economySystem);
      }
      if (systemsCache.rewardSystem) {
        clientNetworkSystem.setRewardSystem(systemsCache.rewardSystem);
      }

      // Configura DeathPopupManager nel PlayerControlSystem per disabilitare input
      if (systems.playerControlSystem) {
        systems.playerControlSystem.setDeathPopupManager(clientNetworkSystem.getDeathPopupManager());
      }
    }

  }
}
