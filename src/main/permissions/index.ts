import { systemPreferences, dialog, shell, app } from 'electron'

export type PermissionStatus = 'granted' | 'denied' | 'restricted' | 'unknown'

interface PermissionResult {
  granted: boolean
  status: PermissionStatus
  canPrompt: boolean
}

class PermissionManager {
  private static instance: PermissionManager
  private hasShownPermissionDialog = false

  constructor() {
    if (PermissionManager.instance) {
      return PermissionManager.instance
    }
    PermissionManager.instance = this
  }

  /**
   * 检查屏幕录制权限状态
   */
  public async checkScreenCapturePermission(): Promise<PermissionResult> {
    try {
      if (process.platform === 'darwin') {
        const status = systemPreferences.getMediaAccessStatus('screen')
        
        return {
          granted: status === 'granted',
          status: status as PermissionStatus,
          canPrompt: status === 'not-determined'
        }
      } else if (process.platform === 'win32') {
        // Windows 通常不需要特殊权限
        return {
          granted: true,
          status: 'granted',
          canPrompt: false
        }
      } else {
        // Linux - 检查是否在 Wayland 环境下
        const isWayland = process.env.XDG_SESSION_TYPE === 'wayland'
        if (isWayland) {
          // Wayland 环境下权限检查较复杂，暂时返回 unknown
          return {
            granted: false,
            status: 'unknown',
            canPrompt: true
          }
        } else {
          // X11 环境通常不需要特殊权限
          return {
            granted: true,
            status: 'granted',
            canPrompt: false
          }
        }
      }
    } catch (error) {
      console.error('Error checking screen capture permission:', error)
      return {
        granted: false,
        status: 'unknown',
        canPrompt: false
      }
    }
  }

  /**
   * 请求屏幕录制权限
   */
  public async requestScreenCapturePermission(): Promise<PermissionResult> {
    const currentStatus = await this.checkScreenCapturePermission()
    
    if (currentStatus.granted) {
      return currentStatus
    }

    if (process.platform === 'darwin') {
      return this.requestMacOSPermission()
    } else if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland') {
      return this.requestLinuxWaylandPermission()
    }

    return currentStatus
  }

  /**
   * macOS 权限请求流程
   */
  private async requestMacOSPermission(): Promise<PermissionResult> {
    if (this.hasShownPermissionDialog) {
      return await this.checkScreenCapturePermission()
    }

    this.hasShownPermissionDialog = true

    const result = await dialog.showMessageBox({
      type: 'info',
      title: '需要屏幕录制权限',
      message: 'Simple Screenshot 需要屏幕录制权限才能正常工作',
      detail: '请在系统偏好设置中授予屏幕录制权限，然后重启应用。\n\n点击"打开系统偏好设置"将自动打开相关设置页面。',
      buttons: ['取消', '打开系统偏好设置'],
      defaultId: 1,
      cancelId: 0
    })

    if (result.response === 1) {
      try {
        // 打开系统偏好设置的隐私和安全性 -> 屏幕录制页面
        await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
        
        // 开始监听权限变化
        this.startPermissionMonitoring()
        
        // 显示等待权限确认的对话框
        this.showPermissionWaitingDialog()
        
      } catch (error) {
        console.error('Failed to open system preferences:', error)
        
        // 备用方案：显示手动操作指引
        await dialog.showMessageBox({
          type: 'info',
          title: '手动设置权限',
          message: '请手动打开系统偏好设置进行权限配置',
          detail: '1. 打开"系统偏好设置"\n2. 选择"安全性与隐私"\n3. 点击"隐私"标签\n4. 选择"屏幕录制"\n5. 勾选"Simple Screenshot"\n6. 重启应用',
          buttons: ['确定']
        })
      }
    }

    return await this.checkScreenCapturePermission()
  }

  /**
   * Linux Wayland 权限请求流程
   */
  private async requestLinuxWaylandPermission(): Promise<PermissionResult> {
    await dialog.showMessageBox({
      type: 'info',
      title: '需要屏幕共享权限',
      message: '在 Wayland 环境下，屏幕截图需要特殊权限',
      detail: '应用将尝试请求屏幕共享权限。\n请在弹出的权限对话框中点击"允许"。',
      buttons: ['确定']
    })

    // Wayland 环境下的权限处理较复杂，这里返回需要用户手动处理的状态
    return {
      granted: false,
      status: 'unknown',
      canPrompt: true
    }
  }

  /**
   * 开始监听权限变化 (macOS)
   */
  private startPermissionMonitoring(): void {
    if (process.platform !== 'darwin') return

    const checkInterval = setInterval(async () => {
      const status = await this.checkScreenCapturePermission()
      
      if (status.granted) {
        clearInterval(checkInterval)
        
        // 权限获取成功，提示用户重启应用
        const restartResult = await dialog.showMessageBox({
          type: 'info',
          title: '权限获取成功',
          message: '屏幕录制权限已获取，需要重启应用以生效',
          buttons: ['稍后重启', '立即重启'],
          defaultId: 1
        })

        if (restartResult.response === 1) {
          app.relaunch()
          app.exit(0)
        }
      }
    }, 2000) // 每2秒检查一次

    // 30秒后停止监听
    setTimeout(() => {
      clearInterval(checkInterval)
    }, 30000)
  }

  /**
   * 显示等待权限确认的对话框
   */
  private showPermissionWaitingDialog(): void {
    dialog.showMessageBox({
      type: 'info',
      title: '等待权限确认',
      message: '正在等待您在系统偏好设置中确认权限...',
      detail: '完成权限设置后，应用将自动检测并提示重启。\n\n如果没有自动检测到权限变化，请手动重启应用。',
      buttons: ['确定']
    })
  }

  /**
   * 验证权限并显示错误信息
   */
  public async validateAndPromptPermission(): Promise<boolean> {
    const permission = await this.checkScreenCapturePermission()
    
    if (!permission.granted) {
      const requestResult = await this.requestScreenCapturePermission()
      return requestResult.granted
    }
    
    return true
  }

  /**
   * 获取权限状态的用户友好描述
   */
  public getPermissionStatusDescription(status: PermissionStatus): string {
    switch (status) {
      case 'granted':
        return '已授权'
      case 'denied':
        return '已拒绝'
      case 'restricted':
        return '受限制'
      case 'unknown':
      default:
        return '未知状态'
    }
  }

  /**
   * 重置权限请求状态
   */
  public resetPermissionState(): void {
    this.hasShownPermissionDialog = false
  }
}

export default PermissionManager