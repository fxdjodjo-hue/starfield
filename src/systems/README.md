# ⚙️ Game Systems

**Sistemi ECS di Starfield - logica di gioco organizzata per dominio funzionale**

I sistemi contengono la logica operativa del gioco, orchestrando i componenti per produrre comportamenti complessi. Organizzati per responsabilità funzionale anziché pattern tecnici.

## 📋 Architettura Sistemi

### 🎨 **rendering/** - Pipeline Visuale
Sistema di rendering completo per visualizzare il mondo di gioco.

**Sistemi inclusi:**
- `RenderSystem` - Rendering principale entità e mondo
- `ParallaxSystem` - Sfondo spaziale con effetto profondità
- `DamageTextSystem` - Effetti testo danno fluttuante

**Responsabilità:** Tutto ciò che viene disegnato a schermo.

### 🎮 **input/** - Gestione Input
Sistemi per input utente e controlli di gioco.

**Sistemi inclusi:**
- `InputSystem` - Mouse e keyboard handling di basso livello
- `PlayerControlSystem` - Logica controllo giocatore (click-to-move)

**Responsabilità:** Traduzione input utente in azioni di gioco.

### 🤖 **ai/** - Intelligenza Artificiale
Sistemi per comportamenti NPC e decisioni autonome.

**Sistemi inclusi:**
- `NpcBehaviorSystem` - Logica movimento e comportamento NPC
- `NpcSelectionSystem` - Targeting e selezione entità

**Responsabilità:** Comportamenti intelligenti delle entità non-giocatore.

### ⚡ **physics/** - Fisica e Movimento
Sistema di fisica per movimento e collisioni.

**Sistemi inclusi:**
- `MovementSystem` - Integrazione movimento basata su velocity

**Responsabilità:** Tutto ciò che si muove nel mondo di gioco.

### ⚔️ **combat/** - Sistema di Combattimento
Logica completa di danno, proiettili e risoluzione battaglie.

**Sistemi inclusi:**
- `CombatSystem` - Applicazione danno e risoluzione combattimento
- `ProjectileSystem` - Gestione proiettili e armi a distanza

**Responsabilità:** Tutto ciò che riguarda danno, guarigione e combattimento.

## 🎯 Pattern di Organizzazione

### Functional Domain Grouping
Sistemi raggruppati per **funzione di business**:
- **Non** `update/`, `render/`, `logic/` (pattern-driven)
- **Sì** `rendering/`, `combat/`, `ai/` (domain-driven)

### Update Order Critico
```
1. input/     → Leggi input utente
2. ai/        → Calcola comportamenti NPC
3. physics/   → Applica movimento
4. combat/    → Risolvi danni e collisioni
5. rendering/ → Visualizza risultati
```

## 🔧 Implementazione ECS

### System Base Class
Tutti i sistemi ereditano da `System` e implementano:
```typescript
class MySystem extends System {
  update(deltaTime: number): void {
    // Logica sistema
  }

  render?(ctx: CanvasRenderingContext2D): void {
    // Rendering specifico (opzionale)
  }
}
```

### ECS Integration
```typescript
// Registrazione sistemi nell'ordine corretto
ecs.addSystem(new InputSystem(ecs));
ecs.addSystem(new MovementSystem(ecs));
ecs.addSystem(new RenderSystem(ecs));

// Game loop chiama automaticamente
ecs.update(deltaTime);
ecs.render(canvasContext);
```

## 📊 Metriche e Statistiche

- **Totale sistemi:** 7
- **Distribuzione per dominio:**
  - Rendering: 3 sistemi (43%)
  - Input: 2 sistemi (29%)
  - AI: 2 sistemi (29%)
  - Physics: 1 sistema (14%)
  - Combat: 2 sistemi (29%)
- **Pattern:** ECS puro con composition

## 🎮 Sistemi in Azione

### Frame Update Sequence
```
Input → AI Decision → Physics → Combat → Render
  ↓      ↓           ↓        ↓        ↓
Mouse  Pathfind   Move    Damage   Draw
Click  Target    Entity   Entity   World
```

### Esempio Combat Flow
```typescript
// 1. Input system rileva click
inputSystem.detectClicks();

// 2. Combat system trova target validi
const targets = combatSystem.findTargetsInRange(attacker);

// 3. Projectile system crea proiettili
projectileSystem.fireAt(targets[0]);

// 4. Physics system muove proiettili
movementSystem.updateProjectiles();

// 5. Combat system applica danni su collisione
combatSystem.resolveHits();

// 6. Render system mostra tutto
renderSystem.drawWorld();
```

## 🚀 Estensioni Future

### Nuovi Domini Possibili
- `network/` - Sincronizzazione multiplayer
- `audio/` - Sistema audio spaziale
- `ui/` - HUD e interfaccia dinamica
- `save/` - Persistence e caricamento

### Aggiunta Nuovo Sistema
1. Identificare dominio appropriato
2. Creare classe estendente `System`
3. Registrare nell'ordine corretto in `PlayState`
4. Aggiornare documentazione

Questa struttura garantisce **flusso logico di esecuzione** mantenendo **modularità** e **estensibilità** del sistema di gioco.
