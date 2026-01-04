# 🎯 Entity Components

**Componenti ECS del gioco Starfield - organizzati per dominio funzionale**

I componenti rappresentano i dati e comportamenti delle entità di gioco, organizzati in tre domini principali per riflettere le responsabilità logiche del sistema.

## 📋 Struttura per Domini

### 🎨 **spatial/** - Componenti Spaziali
Gestisce tutto ciò che riguarda posizione, movimento e vista nel mondo di gioco.

**Componenti:**
- `Transform` - Posizione X/Y, rotazione, scala nel world space
- `Velocity` - Velocità lineare e angolare per movimento
- `Camera` - Viewport management e coordinate schermo
- `ParallaxLayer` - Sfondo spaziale con effetto profondità
- `InterpolationTarget` - Target di interpolazione per movimenti fluidi (multiplayer)

**Responsabilità:** Tutto ciò che si muove o ha una posizione fisica.

### ⚔️ **combat/** - Componenti di Combattimento
Gestisce stati vitali, capacità offensive e interazioni di battaglia.

**Componenti:**
- `Health` - Punti vita attuali e massimi, stato vitale
- `Damage` - Potenza attacco, range, sistema cooldown
- `SelectedNpc` - Stato selezione tattica per targeting
- `Projectile` - Proprietà proiettili (danno, velocità, lifetime)
- `DamageText` - Effetti UI per numeri danno fluttuanti

**Responsabilità:** Tutto ciò che riguarda danno, guarigione e combattimento.

### 🤖 **ai/** - Componenti AI
Gestisce comportamenti NPC, obiettivi e decisioni intelligenti.

**Componenti:**
- `Npc` - Definizione NPC (tipo, comportamento, nickname)
- `Destination` - Target di movimento per pathfinding AI

**Responsabilità:** Tutto ciò che riguarda comportamento autonomo delle entità.

## 🎯 Principi di Organizzazione

### Domain-Driven Grouping
I componenti sono raggruppati per **dominio funzionale** piuttosto che pattern tecnici:
- **Non** `interfaces/`, `data/`, `behaviors/` (pattern-driven)
- **Sì** `spatial/`, `combat/`, `ai/` (domain-driven)

### Single Responsibility per Dominio
Ogni sottocartella ha una responsabilità chiara e non sovrapposta:
- Spatial = movimento e posizione
- Combat = danno e sopravvivenza
- AI = comportamento intelligente

## 🔧 Utilizzo nei Sistemi

### Rendering System
```typescript
// Accesso ai componenti spaziali per rendering
const transform = entity.getComponent(Transform);
const camera = this.cameraSystem.getComponent(Camera);

// Conversione coordinate per display
const screenPos = camera.worldToScreen(transform.x, transform.y);
```

### Combat System
```typescript
// Logica di danno basata sui componenti
const attackerDamage = attacker.getComponent(Damage);
const targetHealth = target.getComponent(Health);

if (attackerDamage.canAttack(Date.now())) {
  targetHealth.current -= attackerDamage.damage;
}
```

### AI System
```typescript
// Decision making basato sui componenti AI
const npc = entity.getComponent(Npc);
const destination = entity.getComponent(Destination);

if (npc.behavior === 'pursuit') {
  // Logica inseguimento
}
```

## 📊 Statistiche Implementazione

- **Totale componenti:** 11
- **Distribuzione per dominio:**
  - Spatial: 4 componenti (36%)
  - Combat: 5 componenti (45%)
  - AI: 2 componenti (18%)
- **Pattern utilizzati:** ECS puro, composition over inheritance

## 🚀 Estensioni Future

### Nuovi Domini Possibili
- `inventory/` - Gestione oggetti e equipaggiamento
- `network/` - Sincronizzazione multiplayer
- `audio/` - Proprietà sonore delle entità
- `effects/` - Sistemi particellari e visual effects

### Aggiunta Nuovo Componente
1. Identificare dominio appropriato
2. Creare file nella sottocartella corretta
3. Aggiornare sistemi che lo utilizzano
4. Aggiungere alla documentazione

Questa organizzazione garantisce **manutenibilità scalabile** mantenendo la **separazione logica** tra aspetti del gioco, facilitando lo sviluppo e l'evoluzione del sistema ECS.
