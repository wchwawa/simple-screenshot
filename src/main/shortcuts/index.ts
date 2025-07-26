import { globalShortcut, dialog } from 'electron'

interface ShortcutConfig {
  key: string
  description: string
  callback: () => void
}

class ShortcutManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map()
  private defaultShortcuts = {
    SCREENSHOT: 'Ctrl+A'
  }

  constructor() {
    // 初始化时不注册快捷键，等待应用准备就绪
  }

  /**
   * 注册截图快捷键
   */
  public registerScreenshotShortcut(callback: () => void): boolean {
    const shortcut = this.defaultShortcuts.SCREENSHOT
    
    try {
      const success = this.registerShortcut(shortcut, {
        key: shortcut,
        description: '截图',
        callback
      })
      
      if (!success) {
        this.handleShortcutConflict(shortcut)
        return false
      }
      
      console.log(`Global shortcut registered: ${shortcut}`)
      return true
      
    } catch (error) {
      console.error('Failed to register screenshot shortcut:', error)
      return false
    }
  }

  /**
   * 注册单个快捷键
   */
  private registerShortcut(accelerator: string, config: ShortcutConfig): boolean {
    try {
      // 检查快捷键是否已经被占用
      if (globalShortcut.isRegistered(accelerator)) {
        console.warn(`Shortcut ${accelerator} is already registered`)
        return false
      }

      const success = globalShortcut.register(accelerator, () => {
        try {
          config.callback()
        } catch (error) {
          console.error(`Error executing shortcut ${accelerator}:`, error)
        }
      })

      if (success) {
        this.shortcuts.set(accelerator, config)
        return true
      } else {
        console.error(`Failed to register shortcut: ${accelerator}`)
        return false
      }
      
    } catch (error) {
      console.error(`Error registering shortcut ${accelerator}:`, error)
      return false
    }
  }

  /**
   * 处理快捷键冲突
   */
  private handleShortcutConflict(shortcut: string): void {
    const alternatives = this.getSuggestedAlternatives(shortcut)
    
    dialog.showMessageBox({
      type: 'warning',
      title: '快捷键冲突',
      message: `快捷键 ${shortcut} 已被其他应用占用`,
      detail: `建议使用以下替代快捷键：\n${alternatives.join('\n')}`,
      buttons: ['确定', '尝试替代快捷键'],
      defaultId: 1
    }).then((result) => {
      if (result.response === 1) {
        this.tryAlternativeShortcuts(alternatives)
      }
    })
  }

  /**
   * 获取建议的替代快捷键
   */
  private getSuggestedAlternatives(originalShortcut: string): string[] {
    const alternatives = [
      'CmdOrCtrl+Shift+S',
      'CmdOrCtrl+Alt+A',
      'CmdOrCtrl+Shift+X',
      'F9',
      'F10'
    ]
    
    return alternatives.filter(alt => alt !== originalShortcut)
  }

  /**
   * 尝试注册替代快捷键
   */
  private tryAlternativeShortcuts(alternatives: string[]): void {
    for (const alternative of alternatives) {
      if (!globalShortcut.isRegistered(alternative)) {
        const callback = this.shortcuts.get(this.defaultShortcuts.SCREENSHOT)?.callback
        if (callback) {
          const success = this.registerShortcut(alternative, {
            key: alternative,
            description: '截图',
            callback
          })
          
          if (success) {
            dialog.showMessageBox({
              type: 'info',
              title: '快捷键已更新',
              message: `截图快捷键已更新为: ${alternative}`,
              buttons: ['确定']
            })
            break
          }
        }
      }
    }
  }

  /**
   * 注销指定快捷键
   */
  public unregister(accelerator: string): void {
    try {
      globalShortcut.unregister(accelerator)
      this.shortcuts.delete(accelerator)
      console.log(`Shortcut unregistered: ${accelerator}`)
    } catch (error) {
      console.error(`Error unregistering shortcut ${accelerator}:`, error)
    }
  }

  /**
   * 注销所有快捷键
   */
  public unregisterAll(): void {
    try {
      globalShortcut.unregisterAll()
      this.shortcuts.clear()
      console.log('All shortcuts unregistered')
    } catch (error) {
      console.error('Error unregistering all shortcuts:', error)
    }
  }

  /**
   * 获取已注册的快捷键列表
   */
  public getRegisteredShortcuts(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * 检查是否支持全局快捷键
   */
  public isSupported(): boolean {
    return process.platform !== 'linux' || process.env.XDG_SESSION_TYPE !== 'wayland'
  }

  /**
   * 验证快捷键格式
   */
  public validateShortcut(accelerator: string): boolean {
    const validKeys = /^(CmdOrCtrl|Cmd|Ctrl|Alt|AltGr|Shift|Super)\+.*$/
    return validKeys.test(accelerator)
  }
}

export default ShortcutManager