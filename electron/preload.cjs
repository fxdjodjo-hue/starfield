const { contextBridge, ipcRenderer } = require('electron');

// Preload script per comunicazione sicura tra main e renderer process
// Implementazione minimal come indicato nel piano

contextBridge.exposeInMainWorld('electronAPI', {
  // Update events
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback)
});