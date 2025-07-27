// IPC API 接口类型定义

export interface ScreenshotResult {
  success: boolean
  message?: string
  timestamp?: string
  dialogResult?: number
  error?: string
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
  on: (channel: string, callback: (...args: any[]) => void) => (() => void)
  off: (channel: string, callback: (...args: any[]) => void) => void
}

// 全局类型声明
declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}