import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ElectronAPI } from '../shared/types'

// Custom APIs for renderer
const api: ElectronAPI = {
  // 截图相关 API
  screenshot: {
    take: () => ipcRenderer.invoke('screenshot:take'),
  },
  
  // 权限管理 API
  permission: {
    check: () => ipcRenderer.invoke('permission:check'),
  },
  
  // 应用控制 API
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },
  
  // 托盘操作 API
  tray: {
    showMenu: () => ipcRenderer.invoke('tray:show-menu'),
  },
  
  // 事件监听
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => callback(...args)
    ipcRenderer.on(channel, subscription)
    
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  
  // 移除事件监听
  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}