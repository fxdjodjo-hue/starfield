# 🔧 Core Infrastructure Layer

**Servizi infrastrutturali cross-cutting essenziali per tutto il sistema**

Il core infrastructure fornisce servizi tecnici fondamentali che attraversano tutti i layer dell'applicazione, garantendo comunicazione, gestione risorse e interazione con la piattaforma.

## 📋 Struttura Core Infrastructure

### 🎨 **Asset Management** - Gestione Risorse
Sistema unificato per caricamento e gestione di tutte le risorse di gioco.

**File:**
- `AssetLoader.ts` - Caricamento asincrono risorse con caching
- `AssetManager.ts` - Gestione centralizzata spritesheets e immagini

**Responsabilità:** Fornire API unificata per accesso risorse.

### 📡 **Communication Services** - Servizi di Comunicazione
Gestione broadcasting e comunicazione tra componenti.

**File:**
- `BroadcastManager.ts` - Broadcasting messaggi multiplayer
- `DOMEventManager.ts` - Gestione eventi DOM centralizzata

**Responsabilità:** Coordinamento comunicazione client-server e user interaction.

## 🎯 Design Principles

### Cross-Cutting Services
```typescript
// Servizi utilizzati da tutti i layer
import { AssetManager } from '../core/infrastructure/AssetManager';
import { BroadcastManager } from '../core/infrastructure/BroadcastManager';
import { DOMEventManager } from '../core/infrastructure/DOMEventManager';
```

### High Performance Focus
- **Caching intelligente** per risorse frequentemente usate
- **Event batching** per ridurre overhead comunicazione
- **Memory management** ottimizzato per web environment

### Platform Abstraction
```typescript
// Astrarre differenze browser/device
AssetManager.loadImage('sprite.png')
  .then(image => /* handle loaded image */)
  .catch(error => /* handle loading error */);
```

## 🔧 Utilizzo nei Sistemi

### Asset Loading
```typescript
import { AssetManager } from '../../core/infrastructure/AssetManager';

class RenderSystem extends System {
  async loadAssets(): Promise<void> {
    const spaceshipSprite = await AssetManager.loadImage('ships/player.png');
    // Use loaded asset
  }
}
```

### Event Broadcasting
```typescript
import { BroadcastManager } from '../../core/infrastructure/BroadcastManager';

class CombatSystem extends System {
  broadcastHit(entityId: number, damage: number): void {
    BroadcastManager.broadcast({
      type: 'entity_hit',
      entityId,
      damage
    });
  }
}
```

## 📊 Organization Rules

### Single Responsibility per Service
- **AssetManager**: Solo gestione risorse
- **BroadcastManager**: Solo comunicazione
- **DOMEventManager**: Solo eventi DOM

### Import Hierarchy
```
Application Layers    ← Usano
    ↓
Core Infrastructure   ← Fornisce servizi
    ↓
Platform APIs        ← Browser APIs
```

Questa core infrastructure garantisce **servizi stabili e performanti** utilizzati da tutto il sistema, mantenendo **separazione chiara** tra infrastruttura tecnica e logica di dominio.