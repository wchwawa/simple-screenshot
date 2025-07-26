import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// import icon from '../../assets/icons/icon.png?asset'

// 导入各模块
import TrayManager from './tray'
import ShortcutManager from './shortcuts'
import PermissionManager from './permissions'


// 全局管理器实例
let trayManager: TrayManager | null = null
let shortcutManager: ShortcutManager | null = null
let permissionManager: PermissionManager | null = null

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * 初始化应用模块
 */
async function initializeModules(): Promise<void> {
  try {
    console.log('Initializing application modules...')
    
    // 1. 初始化权限管理器
    permissionManager = new PermissionManager()
    
    // 2. 检查并请求必要权限
    const hasPermission = await permissionManager.validateAndPromptPermission()
    if (!hasPermission) {
      console.warn('Screen capture permission not granted')
      // 权限未获取时仍然继续初始化，但功能会受限
    }
    
    // 3. 初始化快捷键管理器
    shortcutManager = new ShortcutManager()
    
    // 4. 注册截图快捷键
    const screenshotCallback = async () => {
      console.log('Screenshot shortcut triggered')
      // TODO: 实现截图功能
      const { dialog } = require('electron')
      const result = await dialog.showMessageBox({
        type: 'info',
        title: '截图功能',
        message: '截图功能正在开发中...',
        buttons: ['确定']
      })
      console.log('Dialog result:', result.response)
    }
    
    if (!shortcutManager.registerScreenshotShortcut(screenshotCallback)) {
      console.error('Failed to register screenshot shortcut')
    }
    
    // 5. 初始化托盘管理器
    trayManager = new TrayManager()
    trayManager.setOnScreenshotCallback(screenshotCallback)
    
    console.log('All modules initialized successfully')
    
  } catch (error) {
    console.error('Failed to initialize modules:', error)
  }
}

/**
 * 清理资源
 */
function cleanup(): void {
  try {
    console.log('Cleaning up resources...')
    
    if (shortcutManager) {
      shortcutManager.unregisterAll()
      shortcutManager = null
    }
    
    if (trayManager) {
      trayManager.destroy()
      trayManager = null
    }
    
    console.log('Cleanup completed')
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.simple-screenshot')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 初始化应用模块
  await initializeModules()

  // 根据开发环境决定是否创建主窗口
  if (is.dev) {
    createWindow()
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // 对于截图应用，即使关闭所有窗口也保持运行（托盘应用）
  // 只有在非生产环境下才退出应用
  if (process.platform !== 'darwin' && is.dev) {
    cleanup()
    app.quit()
  }
})

// 应用即将退出时清理资源
app.on('before-quit', () => {
  cleanup()
})

// 处理应用退出
app.on('will-quit', () => {
  // 确保快捷键被正确注销
  if (shortcutManager) {
    shortcutManager.unregisterAll()
  }
})

// In this file you can include the rest of your app's main process code.
// You can also put them in separate files and require them here.