import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ElectronAPI } from '../shared/types'

// Custom APIs for renderer
const api: ElectronAPI = {
  // 截图相关 API
  screenshot: {
    take: () => ipcRenderer.invoke('screenshot:take'),
    takeRegion: () => ipcRenderer.invoke('screenshot:take-region'),
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
  
  // 编辑器 API
  editorInit: (data: any) => ipcRenderer.invoke('editor:init', data),
  editorApplyAction: (action: any) => ipcRenderer.invoke('editor:apply-action', action),
  editorUndo: () => ipcRenderer.invoke('editor:undo'),
  editorRedo: () => ipcRenderer.invoke('editor:redo'),
  editorSave: () => ipcRenderer.invoke('editor:save'),
  editorGetPreview: () => ipcRenderer.invoke('editor:get-preview'),
  onEditorInit: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('editor:init', subscription)
    return () => {
      ipcRenderer.removeListener('editor:init', subscription)
    }
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
  },
  
  // IPC 通信（用于覆盖层窗口）
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args)
    },
    on: (channel: string, callback: (...args: any[]) => void) => {
      const subscription = (_event: any, ...args: any[]) => callback(...args)
      ipcRenderer.on(channel, subscription)
      return () => {
        ipcRenderer.removeListener(channel, subscription)
      }
    }
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