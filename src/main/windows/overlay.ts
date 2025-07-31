import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { Display, Rectangle, OverlayWindowOptions } from '../../shared/types/screenshot'

export class OverlayWindow {
  private window: BrowserWindow | null = null
  private display: Display
  private onSelectionComplete?: (bounds: Rectangle) => void
  private onCancel?: () => void
  private isSelecting = false
  private selectionResult: Rectangle | null = null

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

    // Load the overlay content - use a simpler, more reliable approach
    const overlayHTML = this.createOverlayHTML()
    await this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHTML)}`)

    // Show window after loading
    this.window.once('ready-to-show', () => {
      if (this.window) {
        this.window.show()
        this.window.focus()
        this.window.setAlwaysOnTop(true, 'screen-saver')
        
        // No need to expose methods - using simple global variables
      }
    })
  }

  private setupEventHandlers(): void {
    if (!this.window) return

    // Handle window closed - simple and clean
    this.window.on('closed', () => {
      console.log('Overlay window closed')
      this.window = null
      
      // Process the selection result
      if (this.selectionResult && this.onSelectionComplete) {
        this.onSelectionComplete(this.selectionResult)
      } else if (this.onCancel) {
        this.onCancel()
      }
    })

    // Handle key events  
    this.window.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'Escape') {
        this.close()
      }
    })

    // Listen for selection events from renderer
    this.window.webContents.ipc.on('overlay:selection-complete', (_event, bounds) => {
      console.log('Received selection from renderer:', bounds)
      this.selectionResult = bounds
      this.close()
    })

    this.window.webContents.ipc.on('overlay:selection-cancel', (_event) => {
      console.log('Received cancel from renderer')
      this.selectionResult = null
      this.close()
    })

    // No longer need IPC events - using executeJavaScript instead

    // Prevent the window from being moved
    this.window.on('will-move', (_event) => {
      _event.preventDefault()
    })
  }

  private createOverlayHTML(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Screenshot Selection Overlay</title>
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  width: 100vw;
                  height: 100vh;
                  background: transparent;
                  cursor: crosshair;
                  overflow: hidden;
                  -webkit-app-region: no-drag;
                  user-select: none;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              
              #overlay-canvas {
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  cursor: crosshair;
              }
              
              #selection-info {
                  position: absolute;
                  background: rgba(0, 0, 0, 0.8);
                  color: white;
                  padding: 4px 8px;
                  border-radius: 4px;
                  font-size: 12px;
                  pointer-events: none;
                  display: none;
                  z-index: 1000;
              }
              
              #instructions {
                  position: absolute;
                  top: 20px;
                  left: 50%;
                  transform: translateX(-50%);
                  background: rgba(0, 0, 0, 0.8);
                  color: white;
                  padding: 8px 16px;
                  border-radius: 8px;
                  font-size: 14px;
                  text-align: center;
                  animation: fadeIn 0.3s ease-in-out;
                  z-index: 1000;
              }
              
              @keyframes fadeIn {
                  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                  to { opacity: 1; transform: translateX(-50%) translateY(0); }
              }
              
              .hidden {
                  display: none !important;
              }
          </style>
      </head>
      <body>
          <canvas id="overlay-canvas"></canvas>
          <div id="selection-info"></div>
          <div id="instructions">
              drag to select screenshot area• press ESC to cancel
          </div>
          
          <script>
              class ScreenshotOverlay {
                  constructor() {
                      this.canvas = document.getElementById('overlay-canvas');
                      this.ctx = this.canvas.getContext('2d');
                      this.selectionInfo = document.getElementById('selection-info');
                      this.instructions = document.getElementById('instructions');
                      
                      this.isSelecting = false;
                      this.startX = 0;
                      this.startY = 0;
                      this.currentX = 0;
                      this.currentY = 0;
                      
                      this.init();
                  }
                  
                  init() {
                      this.setupCanvas();
                      this.setupEventListeners();
                      this.drawOverlay();
                      
                      // Hide instructions after 3 seconds
                      setTimeout(() => {
                          this.instructions.classList.add('hidden');
                      }, 3000);
                  }
                  
                  setupCanvas() {
                      const rect = document.body.getBoundingClientRect();
                      this.canvas.width = rect.width;
                      this.canvas.height = rect.height;
                  }
                  
                  setupEventListeners() {
                      // Mouse events
                      this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
                      this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
                      this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
                      
                      // Keyboard events
                      document.addEventListener('keydown', this.onKeyDown.bind(this));
                      
                      // Window events
                      window.addEventListener('resize', this.onResize.bind(this));
                  }
                  
                  onMouseDown(event) {
                      this.isSelecting = true;
                      this.startX = event.clientX;
                      this.startY = event.clientY;
                      this.currentX = event.clientX;
                      this.currentY = event.clientY;
                      
                      this.instructions.classList.add('hidden');
                      
                      // Notify main process
                      console.log('Selection started');
                  }
                  
                  onMouseMove(event) {
                      this.currentX = event.clientX;
                      this.currentY = event.clientY;
                      
                      if (this.isSelecting) {
                          this.drawOverlay();
                          this.updateSelectionInfo();
                      }
                  }
                  
                  onMouseUp(event) {
                      if (!this.isSelecting) return;
                      
                      this.isSelecting = false;
                      
                      const bounds = this.getSelectionBounds();
                      if (bounds.width > 5 && bounds.height > 5) {
                          // Valid selection - send via IPC
                          console.log('Selection completed:', bounds);
                          if (window.api && window.api.ipcRenderer) {
                              window.api.ipcRenderer.send('overlay:selection-complete', bounds);
                          } else {
                              // Fallback: store in global variable
                              window.__selectionResult = bounds;
                              window.close();
                          }
                      } else {
                          // Invalid selection, restart
                          this.drawOverlay();
                          this.selectionInfo.style.display = 'none';
                      }
                  }
                  
                  onKeyDown(event) {
                      if (event.key === 'Escape') {
                          console.log('Selection cancelled');
                          if (window.api && window.api.ipcRenderer) {
                              window.api.ipcRenderer.send('overlay:selection-cancel');
                          } else {
                              // Fallback: store null and close
                              window.__selectionResult = null;
                              window.close();
                          }
                      }
                  }
                  
                  onResize() {
                      this.setupCanvas();
                      this.drawOverlay();
                  }
                  
                  getSelectionBounds() {
                      const left = Math.min(this.startX, this.currentX);
                      const top = Math.min(this.startY, this.currentY);
                      const width = Math.abs(this.currentX - this.startX);
                      const height = Math.abs(this.currentY - this.startY);
                      
                      return { x: left, y: top, width, height };
                  }
                  
                  drawOverlay() {
                      const ctx = this.ctx;
                      const width = this.canvas.width;
                      const height = this.canvas.height;
                      
                      // Clear canvas
                      ctx.clearRect(0, 0, width, height);
                      
                      // Draw semi-transparent overlay
                      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                      ctx.fillRect(0, 0, width, height);
                      
                      if (this.isSelecting) {
                          const bounds = this.getSelectionBounds();
                          
                          // Clear selection area
                          ctx.clearRect(bounds.x, bounds.y, bounds.width, bounds.height);
                          
                          // Draw selection border
                          ctx.strokeStyle = '#007AFF';
                          ctx.lineWidth = 2;
                          ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
                          
                          // Draw corner handles
                          this.drawCornerHandles(bounds);
                      }
                  }
                  
                  drawCornerHandles(bounds) {
                      const ctx = this.ctx;
                      const handleSize = 8;
                      const halfHandle = handleSize / 2;
                      
                      ctx.fillStyle = '#007AFF';
                      
                      // Top-left
                      ctx.fillRect(bounds.x - halfHandle, bounds.y - halfHandle, handleSize, handleSize);
                      // Top-right
                      ctx.fillRect(bounds.x + bounds.width - halfHandle, bounds.y - halfHandle, handleSize, handleSize);
                      // Bottom-left
                      ctx.fillRect(bounds.x - halfHandle, bounds.y + bounds.height - halfHandle, handleSize, handleSize);
                      // Bottom-right
                      ctx.fillRect(bounds.x + bounds.width - halfHandle, bounds.y + bounds.height - halfHandle, handleSize, handleSize);
                  }
                  
                  updateSelectionInfo() {
                      const bounds = this.getSelectionBounds();
                      
                      this.selectionInfo.textContent = \`\${Math.round(bounds.width)} × \${Math.round(bounds.height)}\`;
                      this.selectionInfo.style.display = 'block';
                      
                      // Position info box near mouse but avoid edges
                      let infoX = this.currentX + 10;
                      let infoY = this.currentY - 30;
                      
                      const infoRect = this.selectionInfo.getBoundingClientRect();
                      if (infoX + infoRect.width > window.innerWidth) {
                          infoX = this.currentX - infoRect.width - 10;
                      }
                      if (infoY < 0) {
                          infoY = this.currentY + 20;
                      }
                      
                      this.selectionInfo.style.left = infoX + 'px';
                      this.selectionInfo.style.top = infoY + 'px';
                  }
              }
              
              // Selection result will be communicated via IPC or global variable
              
              // Initialize when DOM is ready
              if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', () => {
                      new ScreenshotOverlay();
                  });
              } else {
                  new ScreenshotOverlay();
              }
          </script>
      </body>
      </html>
    `
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

  // Method to be called from HTML
  setSelectionResult(bounds: Rectangle | null): void {
    console.log('Selection result set:', bounds)
    this.selectionResult = bounds
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