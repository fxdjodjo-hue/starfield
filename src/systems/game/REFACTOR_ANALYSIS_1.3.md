# 📋 FASE 1.3 — GameInitializationSystem Analysis

## 📊 Situazione Attuale

**File**: `src/systems/game/GameInitializationSystem.ts`  
**Righe**: 737  
**Status**: ❌ Supera soglia (900 righe)  
**Responsabilità multiple**: ❌ Creazione sistemi, configurazione interazioni, creazione entità

## 🎯 Obiettivo

Identificare blocchi logici separabili senza modificare il comportamento.

## 📦 Mappatura Blocchi Logici

### 1. **SystemFactory** - Creazione dei sistemi

**Responsabilità**: Istanziare tutti i sistemi del gioco

**Metodi**:
- `createSystems()` (linee 157-295)

**Blocchi identificati**:

#### 1.1 Caricamento Assets (linee 158-168)
- `playerSprite` - Sprite player
- `scouterAnimatedSprite` - Sprite NPC Scouter
- `kronosAnimatedSprite` - Sprite NPC Kronos
- `teleportAnimatedSprite` - Sprite portale
- **Dipendenze**: `context.assetManager`, `getNpcDefinition()`

#### 1.2 Creazione Sistemi Base (linee 171-190)
- `AudioSystem` (171)
- `CameraSystem` (172)
- `MovementSystem` (173) - dipende da `cameraSystem`
- `ParallaxSystem` (174) - dipende da `cameraSystem`
- `InputSystem` (175) - dipende da `context.canvas`
- `PlayerControlSystem` (176)
- `NpcSelectionSystem` (177)
- `ExplosionSystem` (178)
- `ChatTextSystem` (179) - dipende da `cameraSystem`
- `MinimapSystem` (180) - dipende da `context.canvas`
- `LogSystem` (182)
- `EconomySystem` (183)
- `RankSystem` (184)
- `RewardSystem` (185) - dipende da `playState`
- `BoundsSystem` (186) - dipende da `cameraSystem`
- `QuestTrackingSystem` (187) - dipende da `world`, `questManager`, `playState`
- `PlayerStatusDisplaySystem` (188)
- `PlayerSystem` (189)
- `RenderSystem` (190) - dipende da `cameraSystem`, `playerSystem`, `assetManager`
- **Dipendenze**: `ecs`, `cameraSystem`, `context`, `world`, `questManager`, `playState`

#### 1.3 Creazione Sistemi Combattimento (linee 192-199)
- `DamageSystem` (192)
- `ProjectileCreationSystem` (193)
- `CombatStateSystem` (194)
- **Dipendenze**: `ecs`

#### 1.4 Caricamento Explosion Frames (linee 202-213)
- Parsing atlas esplosioni
- Estrazione frames
- Configurazione `clientNetworkSystem` (se disponibile)
- **Dipendenze**: `AtlasParser`, `clientNetworkSystem`

#### 1.5 Creazione Sistemi Rendering Avanzati (linee 214-219)
- `DamageTextSystem` (214) - dipende da `cameraSystem`, `damageSystem`
- Collegamento `DamageTextSystem` a `RenderSystem` (216-218)
- `ProjectileSystem` (219) - dipende da `playerSystem`, `uiSystem`
- **Dipendenze**: `cameraSystem`, `damageSystem`, `playerSystem`, `uiSystem`

#### 1.6 Creazione Sistemi Multiplayer (linee 222-233)
- `RemoteNpcSystem` (223) - dipende da `npcSprites`, `assetManager`
- Registrazione sprite NPC (225-230)
- `RemoteProjectileSystem` (233)
- **Dipendenze**: `ecs`, `npcSprites`, `assetManager`, `scouterAnimatedSprite`, `kronosAnimatedSprite`

#### 1.7 Collegamenti Interni Sistemi Combattimento (linee 236-248)
- Collegamento `CombatStateSystem` con altri sistemi (236-242)
- Collegamento `ProjectileCreationSystem` con altri sistemi (244-248)
- **Dipendenze**: `playerControlSystem`, `cameraSystem`, `playerSystem`, `logSystem`, `audioSystem`

#### 1.8 Collegamenti ClientNetworkSystem (linee 251-259)
- Configurazione `CombatStateSystem` con `clientNetworkSystem`
- Configurazione `ProjectileCreationSystem` con `clientNetworkSystem`
- **Dipendenze**: `clientNetworkSystem`

#### 1.9 Costruzione Result Object (linee 261-292)
- Assemblaggio oggetto con tutti i sistemi creati
- **Dipendenze**: Tutti i sistemi creati sopra

---

### 2. **SystemConfigurator** - Configurazione delle interazioni

**Responsabilità**: Configurare dipendenze e interazioni tra sistemi

**Metodi**:
- `configureSystemInteractions()` (linee 341-446)
- `setClientNetworkSystem()` (linee 93-134) - configurazione ClientNetworkSystem
- `addSystemsToECS()` (linee 300-336) - ordine di esecuzione sistemi

**Blocchi identificati**:

#### 2.1 Configurazione Riferimenti Base (linee 350-354)
- `playerControlSystem.setCamera()` (350)
- `playerControlSystem.setAudioSystem()` (351)
- `playerControlSystem.setLogSystem()` (352)
- `minimapSystem.setCamera()` (353)
- **Dipendenze**: `cameraSystem`, `audioSystem`, `logSystem`

#### 2.2 Configurazione AudioSystem (linee 356-370)
- Collegamento `AudioSystem` a `ProjectileCreationSystem` (356-358)
- Collegamento `AudioSystem` a `BoundsSystem` (363-365)
- Collegamento `AudioSystem` a `UiSystem` (368-370)
- **Dipendenze**: `audioSystem`, `projectileCreationSystem`, `boundsSystem`, `uiSystem`

#### 2.3 Configurazione Economy/Rank/Reward (linee 371-378)
- `economySystem.setRankSystem()` (371)
- `rankSystem.setPlayerEntity(null)` (372) - placeholder
- `rewardSystem.setEconomySystem()` (373)
- `rewardSystem.setLogSystem()` (374)
- `boundsSystem.setPlayerEntity(null)` (375) - placeholder
- `rewardSystem.setQuestTrackingSystem()` (376)
- `questTrackingSystem.setEconomySystem()` (377)
- `questTrackingSystem.setLogSystem()` (378)
- **Dipendenze**: `economySystem`, `rankSystem`, `rewardSystem`, `boundsSystem`, `questTrackingSystem`, `logSystem`

#### 2.4 Configurazione Minimap Callbacks (linee 383-389)
- `minimapSystem.setMoveToCallback()` (383-385)
- `playerControlSystem.setMinimapMovementCompleteCallback()` (387-389)
- **Dipendenze**: `minimapSystem`, `playerControlSystem`

#### 2.5 Configurazione Input Handlers (linee 392-439)
- `inputSystem.setMouseStateCallback()` (392-423)
  - Gestione click minimappa
  - Gestione click player status HUD
  - Conversione coordinate schermo → mondo
  - Selezione NPC
  - Movimento player
- `inputSystem.setMouseMoveWhilePressedCallback()` (425-430)
- `inputSystem.setKeyPressCallback()` (433-435)
- `inputSystem.setKeyReleaseCallback()` (437-439)
- **Dipendenze**: `inputSystem`, `minimapSystem`, `playerStatusDisplaySystem`, `cameraSystem`, `npcSelectionSystem`, `playerControlSystem`

#### 2.6 Configurazione NPC Selection (linee 442-445)
- `npcSelectionSystem.setOnNpcClickCallback()` (442-445)
- **Dipendenze**: `npcSelectionSystem`

#### 2.7 Configurazione ClientNetworkSystem (linee 93-134)
- Impostazione `clientNetworkSystem` in vari sistemi
- Configurazione riferimenti a sistemi esistenti (119-130)
- **Dipendenze**: `clientNetworkSystem`, `systemsCache`

#### 2.8 Aggiunta Sistemi all'ECS (linee 300-336)
- Ordine di esecuzione sistemi
- **Dipendenze**: `ecs`, tutti i sistemi

---

### 3. **EntityFactory** - Creazione entità iniziali

**Responsabilità**: Creare entità di gioco (player, NPC, portali, background)

**Metodi**:
- `createGameEntities()` (linee 452-482)
- `setPlayerEntityInSystems()` (linee 503-520)
- `createTeleport()` (linee 487-498)
- `createScouter()` (linee 526-609) - DISABLED (NPC gestiti dal server)
- `createFrigate()` (linee 614-695) - DISABLED (NPC gestiti dal server)
- `createMapBackground()` (linee 700-714) - DISABLED

**Blocchi identificati**:

#### 3.1 Creazione Player Entity (linee 456-470)
- `playerSystem.createPlayer()` (458)
- Aggiunta componente `Authority` (461-462)
- Rimozione `Sprite` statico (465-467)
- Aggiunta `AnimatedSprite` (468)
- **Dipendenze**: `playerSystem`, `ecs`, `context.localClientId`, `assets.playerSprite`

#### 3.2 Impostazione Player Entity nei Sistemi (linee 470, 503-520)
- `setPlayerEntityInSystems()` chiamato dopo creazione player
- Impostazione player in:
  - `playerControlSystem` (510)
  - `economySystem` (511)
  - `rankSystem` (512)
  - `rewardSystem` (513)
  - `boundsSystem` (514)
  - `questTrackingSystem` (515)
  - `playerStatusDisplaySystem` (516)
  - `uiSystem.setPlayerSystem()` (519)
- **Dipendenze**: `playerEntity`, tutti i sistemi che necessitano player

#### 3.3 Creazione Portale (linee 479, 487-498)
- `createTeleport()` (479) - chiamato con posizione (9000, 0)
- Creazione entità portale (488)
- Aggiunta componenti: `Transform`, `AnimatedSprite` (491-494)
- **Dipendenze**: `ecs`, `assets.teleportAnimatedSprite`

#### 3.4 Creazione NPC (DISABLED - linee 526-695)
- `createScouter()` (526-609) - NON USATO (NPC dal server)
- `createFrigate()` (614-695) - NON USATO (NPC dal server)
- **Nota**: Metodi presenti ma non chiamati (NPC gestiti dal server)

#### 3.5 Creazione Background (DISABLED - linee 700-714)
- `createMapBackground()` (700-714) - NON USATO (sfondo nero + stelle)
- **Nota**: Metodo presente ma non chiamato

---

## 📊 Statistiche

### SystemFactory
- **Righe**: ~138 (linee 157-295)
- **Responsabilità**: Creazione 20+ sistemi, caricamento assets
- **Dipendenze**: `ecs`, `context`, `world`, `questManager`, `playState`, `clientNetworkSystem`

### SystemConfigurator
- **Righe**: ~246 (linee 93-134, 300-336, 341-446)
- **Responsabilità**: Configurazione interazioni, callbacks, ordine esecuzione
- **Dipendenze**: Tutti i sistemi creati, `ecs`, `context`

### EntityFactory
- **Righe**: ~235 (linee 452-482, 487-498, 503-520, 526-695, 700-714)
- **Responsabilità**: Creazione player, portali, NPC (disabled), background (disabled)
- **Dipendenze**: `ecs`, `playerSystem`, `assets`, sistemi configurati

### Altro
- **Righe**: ~118 (costruttore, metodi utility, getSystems, update)
- **Totale**: 737 righe

---

## 🎯 Proposta Refactor

### Moduli da Estrarre

1. **`SystemFactory.ts`** (~138 righe)
   - `createSystems()` - Creazione tutti i sistemi
   - Caricamento assets
   - Costruzione result object

2. **`SystemConfigurator.ts`** (~246 righe)
   - `configureSystemInteractions()` - Configurazione interazioni
   - `addSystemsToECS()` - Ordine esecuzione
   - `setClientNetworkSystem()` - Configurazione rete

3. **`EntityFactory.ts`** (~235 righe)
   - `createGameEntities()` - Creazione entità principali
   - `setPlayerEntityInSystems()` - Impostazione player
   - `createTeleport()` - Creazione portali
   - Metodi NPC/background (disabled, da rimuovere o mantenere per futuro)

### Orchestratore Finale

**`GameInitializationSystem.ts`** (~118 righe)
- Coordinamento moduli
- Metodo `initialize()` principale
- Metodi utility

---

## ⚠️ Note Importanti

1. **NPC Creation**: Metodi `createScouter()` e `createFrigate()` sono presenti ma NON chiamati (NPC gestiti dal server). Valutare se rimuoverli o mantenerli per test/futuro.

2. **Background Creation**: Metodo `createMapBackground()` presente ma NON chiamato (sfondo nero + stelle). Valutare se rimuoverlo.

3. **Dipendenze Cicliche**: Alcuni sistemi hanno dipendenze circolari (es. `RenderSystem` dipende da `PlayerSystem`, ma `PlayerSystem` potrebbe essere creato prima). Verificare ordine creazione.

4. **Assets Loading**: Caricamento assets è parte di `createSystems()` ma potrebbe essere estratto in un modulo separato `AssetLoader`.

5. **ClientNetworkSystem**: Configurazione avviene in due momenti:
   - Durante `createSystems()` se già disponibile (linee 208-210, 252-259)
   - Dopo tramite `setClientNetworkSystem()` (linee 93-134)

---

## 📝 Prossimi Step

1. ✅ Analisi completata
2. ⏳ Definire interfacce moduli
3. ⏳ Estrarre SystemFactory
4. ⏳ Estrarre SystemConfigurator
5. ⏳ Estrarre EntityFactory
6. ⏳ Refactorare orchestratore
7. ⏳ Testing completo
