// IPC API 接口类型定义

import type { Rectangle, ScreenshotMode } from './types/screenshot'

export interface ScreenshotResult {
  success: boolean
  message?: string
  timestamp?: string
  dialogResult?: number
  error?: string
  data?: {
    buffer: Buffer
    width: number
    height: number
    bounds: Rectangle
  }
}

export interface ScreenshotRequest {
  mode: ScreenshotMode
  displayId?: string
  bounds?: Rectangle
}

export interface PermissionResult {
  granted: boolean
  timestamp?: string
  error?: string
}

export interface TrayResult {
  success: boolean
  error?: string
}

// Electron API 接口定义
export interface ElectronAPI {
  screenshot: {
    take: () => Promise<ScreenshotResult>
    takeRegion: () => Promise<ScreenshotResult>
  }
  permission: {
    check: () => Promise<PermissionResult>
  }
  app: {
    getVersion: () => Promise<string>
    quit: () => Promise<void>
  }
  tray: {
    showMenu: () => Promise<TrayResult>
  }
  editorInit: (data: any) => Promise<boolean>
  editorApplyAction: (action: any) => Promise<any>
  editorUndo: () => Promise<any>
  editorRedo: () => Promise<any>
  editorSave: () => Promise<any>
  editorGetPreview: () => Promise<Buffer | null>
  onEditorInit: (callback: (data: any) => void) => (() => void)
  on: (channel: string, callback: (...args: any[]) => void) => (() => void)
  off: (channel: string, callback: (...args: any[]) => void) => void
  ipcRenderer?: {
    send: (channel: string, ...args: any[]) => void
    on: (channel: string, callback: (...args: any[]) => void) => (() => void)
  }
}

// 全局类型声明
declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}