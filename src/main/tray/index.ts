import { Tray, Menu, nativeImage, app, shell } from 'electron'

class TrayManager {
  private tray: Tray | null = null
  private onScreenshotCallback?: () => void

  constructor() {
    this.createTray()
  }

  private createTray(): void {
    try {
      // 创建托盘图标 - 暂时使用空图标，后续添加实际图标
      const trayIcon = nativeImage.createEmpty()
      
      // 调整图标大小适配系统托盘
      if (process.platform === 'darwin') {
        trayIcon.setTemplateImage(true)
      }
      
      this.tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))
      this.tray.setToolTip('Simple Screenshot')
      
      // 创建右键菜单
      this.updateContextMenu()
      
      // macOS 左键点击显示菜单
      if (process.platform === 'darwin') {
        this.tray.on('click', () => {
          this.tray?.popUpContextMenu()
        })
      }
      
    } catch (error) {
      console.error('Failed to create tray:', error)
    }
  }

  private updateContextMenu(): void {
    if (!this.tray) return

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '截图',
        accelerator: 'Ctrl+A',
        click: () => {
          this.onScreenshotCallback?.()
        }
      },
      {
        type: 'separator'
      },
      {
        label: '设置快捷键...',
        click: () => {
          // 暂时显示当前快捷键，后续实现配置界面
          const { dialog } = require('electron')
          dialog.showMessageBox({
            type: 'info',
            title: '快捷键设置',
            message: '当前快捷键: Ctrl+A\n\n快捷键设置功能正在开发中...'
          })
        }
      },
      {
        label: '关于',
        click: () => {
          const { dialog } = require('electron')
          dialog.showMessageBox({
            type: 'info',
            title: '关于 Simple Screenshot',
            message: `Simple Screenshot v${app.getVersion()}\n\n一个简单高效的开源截图工具`,
            buttons: ['确定', '查看源码'],
            defaultId: 0
          }).then((result) => {
            if (result.response === 1) {
              shell.openExternal('https://github.com/username/simple-screenshot')
            }
          })
        }
      },
      {
        type: 'separator'
      },
      {
        label: '退出',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  public setOnScreenshotCallback(callback: () => void): void {
    this.onScreenshotCallback = callback
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }

  public isVisible(): boolean {
    return this.tray !== null && !this.tray.isDestroyed()
  }
}

export default TrayManager