import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import type { Display, Rectangle, OverlayWindowOptions } from '../../shared/types/screenshot'

export class OverlayWindow {
  private window: BrowserWindow | null = null
  private display: Display
  private onSelectionComplete?: (bounds: Rectangle) => void
  private onCancel?: () => void
  private isSelecting = false

  constructor(options: OverlayWindowOptions) {
    this.display = options.display
    this.onSelectionComplete = options.onSelectionComplete
    this.onCancel = options.onCancel
  }

  async create(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      return
    }

    // Create transparent overlay window
    this.window = new BrowserWindow({
      x: this.display.bounds.x,
      y: this.display.bounds.y,
      width: this.display.bounds.width,
      height: this.display.bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      focusable: true,
      show: false,
      fullscreen: false,
      thickFrame: false, // Important for transparent windows on Windows
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
        allowRunningInsecureContent: true
      }
    })

    // Set up window event handlers
    this.setupEventHandlers()

    // Load the overlay content
    try {
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        // In development, try to load from vite dev server
        const overlayURL = `${process.env['ELECTRON_RENDERER_URL']}/overlay.html`
        console.log('Loading overlay from dev server:', overlayURL)
        await this.window.loadURL(overlayURL)
      } else {
        // In production, load from built files
        const overlayPath = join(__dirname, '../renderer/overlay.html')
        console.log('Loading overlay from file:', overlayPath)
        await this.window.loadFile(overlayPath)
      }
    } catch (error) {
      console.error('Failed to load overlay window:', error)
      // Fallback: create a simple in-memory HTML page
      const overlayHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Screenshot Overlay</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              width: 100vw; height: 100vh; 
              background: rgba(0,0,0,0.3); 
              cursor: crosshair; 
              overflow: hidden;
              user-select: none;
            }
            #info {
              position: absolute;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 8px 16px;
              border-radius: 8px;
              font-family: system-ui;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div id="info">区域截图功能暂时不可用，请使用全屏截图</div>
          <script>
            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                window.close();
              }
            });
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
        </html>
      `
      await this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHTML)}`)
    }

    // Show window after loading
    this.window.once('ready-to-show', () => {
      if (this.window) {
        this.window.show()
        this.window.focus()
        this.window.setAlwaysOnTop(true, 'screen-saver')
      }
    })
  }

  private setupEventHandlers(): void {
    if (!this.window) return

    // Handle window closed
    this.window.on('closed', () => {
      this.window = null
      if (this.onCancel) {
        this.onCancel()
      }
    })

    // Handle key events
    this.window.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'Escape') {
        this.close()
      }
    })

    // Handle selection events from renderer
    this.window.webContents.ipc.on('overlay:selection-start', () => {
      this.isSelecting = true
    })

    this.window.webContents.ipc.on('overlay:selection-complete', (_event, bounds: Rectangle) => {
      this.isSelecting = false
      if (this.onSelectionComplete) {
        this.onSelectionComplete(bounds)
      }
      this.close()
    })

    this.window.webContents.ipc.on('overlay:cancel', () => {
      this.close()
    })

    // Prevent the window from being moved
    this.window.on('will-move', (_event) => {
      _event.preventDefault()
    })
  }

  show(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show()
      this.window.focus()
    }
  }

  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
    }
  }

  close(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close()
    }
    this.window = null
  }

  isDestroyed(): boolean {
    return !this.window || this.window.isDestroyed()
  }

  getDisplay(): Display {
    return this.display
  }

  isCurrentlySelecting(): boolean {
    return this.isSelecting
  }

  // Send display info to renderer process
  async sendDisplayInfo(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('overlay:display-info', {
        display: this.display,
        scaleFactor: this.display.scaleFactor
      })
    }
  }
}

export class OverlayWindowManager {
  private overlayWindows: Map<string, OverlayWindow> = new Map()
  private currentCallback: ((bounds: Rectangle | null) => void) | null = null

  async showSelectionOverlay(displayId?: string): Promise<Rectangle | null> {
    return new Promise((resolve) => {
      this.currentCallback = resolve
      
      if (displayId) {
        this.createOverlayForDisplay(displayId)
      } else {
        this.createOverlaysForAllDisplays()
      }
    })
  }

  private async createOverlayForDisplay(displayId: string): Promise<void> {
    const displays = screen.getAllDisplays()
    const targetDisplay = displays.find(d => d.id.toString() === displayId)
    
    if (!targetDisplay) {
      console.error(`Display ${displayId} not found`)
      if (this.currentCallback) {
        this.currentCallback(null)
        this.currentCallback = null
      }
      return
    }

    const display: Display = {
      id: targetDisplay.id.toString(),
      name: `Display ${targetDisplay.id}`,
      bounds: targetDisplay.bounds,
      workArea: targetDisplay.workArea,
      scaleFactor: targetDisplay.scaleFactor,
      rotation: targetDisplay.rotation,
      internal: targetDisplay.internal,
      touchSupport: targetDisplay.touchSupport
    }

    const overlay = new OverlayWindow({
      display,
      onSelectionComplete: (bounds) => {
        if (this.currentCallback) {
          this.currentCallback(bounds)
          this.currentCallback = null
        }
        this.closeAllOverlays()
      },
      onCancel: () => {
        if (this.currentCallback) {
          this.currentCallback(null)
          this.currentCallback = null
        }
        this.closeAllOverlays()
      }
    })

    this.overlayWindows.set(displayId, overlay)
    await overlay.create()
    await overlay.sendDisplayInfo()
  }

  private async createOverlaysForAllDisplays(): Promise<void> {
    const displays = screen.getAllDisplays()
    
    for (const electronDisplay of displays) {
      const display: Display = {
        id: electronDisplay.id.toString(),
        name: `Display ${electronDisplay.id}`,
        bounds: electronDisplay.bounds,
        workArea: electronDisplay.workArea,
        scaleFactor: electronDisplay.scaleFactor,
        rotation: electronDisplay.rotation,
        internal: electronDisplay.internal,
        touchSupport: electronDisplay.touchSupport
      }

      const overlay = new OverlayWindow({
        display,
        onSelectionComplete: (bounds) => {
          if (this.currentCallback) {
            this.currentCallback(bounds)
            this.currentCallback = null
          }
          this.closeAllOverlays()
        },
        onCancel: () => {
          if (this.currentCallback) {
            this.currentCallback(null)
            this.currentCallback = null
          }
          this.closeAllOverlays()
        }
      })

      this.overlayWindows.set(display.id, overlay)
      await overlay.create()
      await overlay.sendDisplayInfo()
    }
  }

  closeAllOverlays(): void {
    for (const [_displayId, overlay] of this.overlayWindows) {
      if (!overlay.isDestroyed()) {
        overlay.close()
      }
    }
    this.overlayWindows.clear()
  }

  getOverlay(displayId: string): OverlayWindow | undefined {
    return this.overlayWindows.get(displayId)
  }

  hasActiveOverlays(): boolean {
    for (const overlay of this.overlayWindows.values()) {
      if (!overlay.isDestroyed()) {
        return true
      }
    }
    return false
  }

  cleanup(): void {
    this.closeAllOverlays()
    if (this.currentCallback) {
      this.currentCallback(null)
      this.currentCallback = null
    }
  }
}

// Export singleton instance
export const overlayWindowManager = new OverlayWindowManager()