const { contextBridge } = require('electron');

// Preload script per comunicazione sicura tra main e renderer process
// Implementazione minimal come indicato nel piano

contextBridge.exposeInMainWorld('electronAPI', {
  // API methods qui se necessario per future espansioni
  // Per ora lasciato minimal
});