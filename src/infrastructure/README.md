# 🏛️ Infrastructure Layer

**Fondamentali tecnici del motore di gioco - consolidati per stabilità**

L'infrastructure fornisce le basi tecniche riutilizzabili su cui si costruisce tutto il gioco, separate dalla logica di dominio specifica.

## 📋 Struttura Infrastructure

### 🔧 **ecs/** - Entity Component System Framework
Implementazione pura del pattern ECS, indipendentemente dal dominio di gioco.

**File:**
- `Entity.ts` - Contenitore componenti con ID univoco
- `Component.ts` - Interfaccia base per tutti i componenti
- `System.ts` - Classe base per sistemi di logica
- `ECS.ts` - Orchestratore principale del framework ECS

**Responsabilità:** Fornire l'architettura ECS riutilizzabile.

### ⚙️ **engine/** - Game Engine Core
Implementazione concreta del motore di gioco Starfield.

**File:**
- `Game.ts` - Orchestratore principale stati e loop
- `GameLoop.ts` - Gestione timing e frame rate
- `World.ts` - Contenitore mondo di gioco ECS
- `GameContext.ts` - Contesto condiviso tra sistemi

**Responsabilità:** Motore di gioco effettivo e lifecycle management.

### 🖥️ **display/** - Display & Viewport Management
Gestione display ad alta risoluzione e responsive design.

**File:**
- `DisplayManager.ts` - Singleton per gestione DPI e viewport
- `DisplayConfig.ts` - Configurazioni display e costanti

**Responsabilità:** Gestione corretta rendering su dispositivi diversi.

## 🎯 Separation of Concerns

### ECS Framework (Tecnico Puro)
- **Entity**: ID management e component storage
- **Component**: Data contracts senza logica
- **System**: Logic contracts per comportamenti
- **ECS**: Orchestrazione e query system

**Pattern:** Framework generico, riutilizzabile in altri progetti.

### Game Engine (Starfield-Specific)
- **Game**: State management specifico Starfield
- **GameLoop**: Timing ottimizzato per gioco spaziale
- **World**: ECS world container per Starfield
- **GameContext**: Shared state per meccaniche Starfield

**Pattern:** Implementazione concreta per questo specifico gioco.

## 🔧 Utilizzo nei Sistemi

### Sistema ECS Base
```typescript
import { System, ECS } from '../infrastructure/ecs';

class MySystem extends System {
  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    // Logica usando ECS framework
  }
}
```

### Game Engine Integration
```typescript
import { GameContext, World } from '../infrastructure/engine';

// Accesso a risorse di gioco
const context = this.getGameContext();
const world = context.getWorld();
```

## 📊 Design Principles

### Stability Over Flexibility
- **Infrastructure cambia raramente** (solo per ottimizzazioni major)
- **API stabili** per sistemi superiori
- **Performance-critical** - ottimizzato per basso overhead

### Clean Architecture Boundaries
```
Game Systems (Domain)    ← Usa
    ↓
Infrastructure (Technical) ← Fornisce API stabili
    ↓
Platform/Language        ← TypeScript + Canvas
```

### Testability Focus
```typescript
// Infrastructure facilmente testabile isolatamente
describe('ECS Framework', () => {
  it('should manage entities correctly', () => {
    const ecs = new ECS();
    const entity = ecs.createEntity();
    expect(ecs.entityExists(entity.id)).toBe(true);
  });
});
```

## 🚀 Evolution Path

### Current State
- **ECS puro**: Implementazione completa del pattern
- **Game engine**: Motore specifico per Starfield
- **Performance**: Ottimizzato per 10k-50k LOC

### Future Enhancements
- **ECS optimizations**: Spatial partitioning avanzato
- **Engine features**: Asset loading, scene management
- **Debug tools**: Entity inspector, performance profiler

### Migration Compatibility
- **API stable**: Sistemi esistenti non richiedono modifiche
- **Backward compatible**: Estensioni senza breaking changes
- **Versioned**: Possibilità di versioni multiple se necessario

Questa infrastructure fornisce **fondamentali solidi e stabili** su cui costruire l'esperienza di gioco Starfield, garantendo **performance** e **manutenibilità** a lungo termine.
