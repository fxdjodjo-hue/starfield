# Systems Layer - README

## 🎮 Sistemi di Gioco

Questa cartella contiene tutti i **sistemi trasversali** del gioco, implementati secondo l'architettura ECS (Entity-Component-System) e i principi di **Single Responsibility** e **Plugin Architecture**.

Ogni sistema è:
- **Indipendente** e testabile isolatamente
- **Plugin-like**: facilmente sostituibile/integrabile
- **Responsabile di una sola funzionalità**
- **Ottimizzato** per performance

## 📁 Struttura Sistemi

### 🎯 Core Systems
- **MovementSystem**: Gestione movimento entità e camera
- **RenderSystem**: Rendering di tutte le entità e sfondi
- **InputSystem**: Gestione input utente (tastiera/mouse)

### ⚔️ Combat Systems
- **CombatSystem**: Logica combattimento e creazione testi danno
- **ProjectileSystem**: Gestione proiettili e collisioni
- **BoundsSystem**: Sistema confini mappa e danno fuori area

### 🎨 Rendering Systems
- **DamageTextSystem**: Animazione testi danno fluttuanti
- **LogSystem**: Messaggi di log centrati in alto
- **MinimapSystem**: Rendering e interazione minimappa
- **ParallaxSystem**: Sfondo parallax con stelle

### 🔧 Utility Systems
- **EconomySystem**: Gestione risorse economiche
- **NpcBehaviorSystem**: AI e comportamenti NPC
- **NpcSelectionSystem**: Selezione e targeting NPC
- **NpcRespawnSystem**: Rigenerazione NPC morti in posizioni sicure
- **PlayerControlSystem**: Controlli movimento player
- **RankSystem**: Sistema progressione e gradi
- **RewardSystem**: Assegnazione ricompense sconfitte

## 🚀 Sistema BoundsSystem

### 📋 Descrizione
Il **BoundsSystem** gestisce i confini della mappa di gioco, fornendo feedback visivo e penalità per i giocatori che superano i limiti dell'area giocabile.

### 🎯 Funzionalità
- **Linee di confine**: Rendering linee rosse continue intorno alla mappa
- **Danno periodico**: 10 HP danno ogni secondo quando fuori bounds
- **Feedback visivo**: Testi danno fluttuanti "-10" rossi
- **Timer intelligente**: Reset automatico quando si rientra in area sicura

### 🔧 Implementazione
```typescript
// Creazione sistema
const boundsSystem = new BoundsSystem(ecs, movementSystem);

// Integrazione nel PlayState
ecs.addSystem(boundsSystem);
boundsSystem.setPlayerEntity(playerShip);
```

### ⚙️ Configurazione
```typescript
// Parametri configurabili in BoundsSystem.ts
private readonly DAMAGE_INTERVAL = 1000; // ms tra danni
private readonly DAMAGE_AMOUNT = 10;     // HP per danno
private readonly BOUNDS_MARGIN = 0;      // Margine dai bordi (attualmente 0)
```

### 🎨 Rendering
- **Colore linea**: Rosso (#ff0000)
- **Spessore**: 3px
- **Stile**: Linea continua (non tratteggiata)
- **Trasparenza**: 80% (globalAlpha = 0.8)

### 🔄 Flusso Operativo
```
1. Update: Controllo posizione player
2. Fuori bounds? → Accumula timer danno
3. Timer ≥ 1s → Applica 10 HP danno + mostra "-10"
4. Dentro bounds? → Reset timer
5. Render: Disegna linee rosse di confine
```

### 🛡️ Sicurezza
- **Limite danni**: Illimitato per bounds (diversamente dai danni normali)
- **Reset automatico**: Timer si azzera quando si rientra in mappa
- **Performance**: Controlli leggeri, rendering efficiente

### 🎮 Gameplay Impact
- **Avvertimento visivo**: Linee rosse segnalano zona pericolosa
- **Penalità chiara**: Danno prevedibile incoraggia ritorno in area sicura
- **Balance**: 10 HP/s permette sopravvivenza ma scoraggia esplorazione oltre confini

## 🔄 Sistema NpcRespawnSystem

### 📋 Descrizione
Il **NpcRespawnSystem** mantiene il gameplay dinamico rigenerando gli NPC morti in posizioni sicure lontane dal player, garantendo un mondo sempre popolato.

### 🎯 Funzionalità
- **Respawn automatico**: 10 secondi dopo la morte dell'NPC
- **Posizioni dinamiche**: Spawn sicuro 800-2000px dal player
- **Anti-sovrapposizione**: Evita spawn vicino ad altri NPC
- **Event-driven**: Integrato con RewardSystem per cattura morti

### 🔧 Implementazione
```typescript
// Creazione e configurazione
const respawnSystem = new NpcRespawnSystem(ecs);
respawnSystem.setPlayerEntity(playerShip);

// Integrazione con RewardSystem
rewardSystem.setRespawnSystem(respawnSystem);

// Sistema cattura automaticamente morti NPC
```

### ⚙️ Configurazione
```typescript
// Parametri in CONFIG.ts
NPC_RESPAWN_DELAY: 10000,        // 10 secondi attesa
NPC_RESPAWN_DISTANCE_MIN: 800,   // Distanza minima dal player
NPC_RESPAWN_DISTANCE_MAX: 2000,  // Distanza massima dal player
NPC_RESPAWN_ANGLE_VARIATION: Math.PI * 0.5  // ±90° variazione
```

### 🔄 Flusso Operativo
```
1. NPC muore → RewardSystem cattura evento
2. Pianifica respawn: morte_time + 10s
3. Timer scaduto → Calcola posizione sicura
4. Verifica distanza da player (>800px)
5. Verifica distanza da altri NPC (>200px)
6. Crea nuovo NPC con stesse caratteristiche
7. Respawn completato! ✨
```

### 🎮 Gameplay Impact
- **Gameplay infinito**: NPC si rigenerano continuamente
- **Mondo vivo**: Popolazione costante di nemici
- **Posizioni casuali**: Mai spawn prevedibili
- **Bilanciamento**: Mantiene difficoltà costante

### 🛡️ Sicurezza
- **Fallback position**: Se non trova posizione sicura, usa posizione di backup
- **Massimo 20 tentativi**: Per evitare loop infiniti
- **Validazione**: Solo posizioni entro bounds della mappa

## 🧪 Testing
```bash
# Testare bounds:
1. Avviare gioco
2. Volare verso bordi mappa
3. Verificare linee rosse visibili
4. Uscire bounds → verificare danno periodico
5. Rientrare → verificare stop danno
```

## 🔧 Estensioni Future
- **Suoni**: Audio quando si toccano i bounds
- **Particelle**: Effetti visivi ai confini
- **Configurazione dinamica**: Bounds modificabili per livelli
- **Multi-area**: Zone sicure multiple nella stessa mappa

---
*Questo sistema segue perfettamente l'architettura stabilita: responsabilità singola, indipendenza, plugin-like integration.*