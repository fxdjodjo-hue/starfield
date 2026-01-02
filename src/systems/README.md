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