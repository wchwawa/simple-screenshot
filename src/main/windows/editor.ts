import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import type { Rectangle, ScreenshotData } from '../../shared/types/screenshot'
import { editorManager } from '../editor'

export class EditorWindow {
  private window: BrowserWindow | null = null
  private screenshotData: ScreenshotData
  private selectionBounds: Rectangle
  private onComplete?: () => void
  private onCancel?: () => void

  constructor(
    screenshotData: ScreenshotData,
    selectionBounds: Rectangle,
    onComplete?: () => void,
    onCancel?: () => void
  ) {
    this.screenshotData = screenshotData
    this.selectionBounds = selectionBounds
    this.onComplete = onComplete
    this.onCancel = onCancel
  }

  async create(): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      return
    }

    const display = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = display.bounds

    this.window = new BrowserWindow({
      x: 0,
      y: 0,
      width: screenWidth,
      height: screenHeight,
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
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    this.setupEventHandlers()

    const editorHTML = this.createEditorHTML()
    await this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(editorHTML)}`)

    this.window.once('ready-to-show', async () => {
      if (this.window) {
        this.window.show()
        this.window.focus()
        this.window.setAlwaysOnTop(true, 'screen-saver')
        
        // Initialize editor in main process first
        const initialized = await editorManager.initializeEditor(this.screenshotData)
        if (initialized) {
          this.window.webContents.send('editor:init', {
            screenshotData: {
              width: this.screenshotData.width,
              height: this.screenshotData.height,
              displayId: this.screenshotData.displayId,
              scaleFactor: this.screenshotData.scaleFactor
            },
            selectionBounds: this.selectionBounds
          })
        }
      }
    })
  }

  private setupEventHandlers(): void {
    if (!this.window) return

    this.window.on('closed', () => {
      this.window = null
      editorManager.cleanup()
    })

    this.window.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'Escape') {
        if (this.onCancel) this.onCancel()
        this.close()
      }
    })

    this.window.webContents.ipc.on('editor:done', async () => {
      const result = await editorManager.saveToClipboard()
      if (result.success) {
        if (this.onComplete) this.onComplete()
        this.close()
      }
    })

    this.window.webContents.ipc.on('editor:cancel', () => {
      if (this.onCancel) this.onCancel()
      this.close()
    })
  }

  private createEditorHTML(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Screenshot Editor</title>
          <style>
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  width: 100vw;
                  height: 100vh;
                  background: rgba(0, 0, 0, 0.3);
                  overflow: hidden;
                  user-select: none;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              
              #editor-container {
                  position: relative;
                  width: 100%;
                  height: 100%;
              }
              
              #screenshot-canvas {
                  position: absolute;
                  background: white;
                  box-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
              }
              
              #editing-canvas {
                  position: absolute;
                  cursor: crosshair;
              }
              
              #editing-bar {
                  position: absolute;
                  background: rgba(30, 30, 30, 0.95);
                  border-radius: 8px;
                  padding: 8px;
                  display: flex;
                  gap: 8px;
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                  opacity: 0;
                  transform: translateY(10px);
                  transition: all 0.3s ease;
              }
              
              #editing-bar.show {
                  opacity: 1;
                  transform: translateY(0);
              }
              
              .tool-button {
                  width: 36px;
                  height: 36px;
                  border: none;
                  background: rgba(255, 255, 255, 0.1);
                  color: white;
                  border-radius: 6px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s ease;
                  font-size: 18px;
              }
              
              .tool-button:hover {
                  background: rgba(255, 255, 255, 0.2);
              }
              
              .tool-button.active {
                  background: #007AFF;
              }
              
              .tool-separator {
                  width: 1px;
                  background: rgba(255, 255, 255, 0.2);
                  margin: 0 4px;
              }
              
              .done-button {
                  background: #34C759;
                  padding: 0 16px;
                  width: auto;
                  font-size: 14px;
                  font-weight: 500;
              }
              
              .done-button:hover {
                  background: #30B350;
              }
              
              #tool-settings {
                  position: absolute;
                  background: rgba(30, 30, 30, 0.95);
                  border-radius: 8px;
                  padding: 12px;
                  display: none;
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
              }
              
              .setting-row {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
              }
              
              .setting-row:last-child {
                  margin-bottom: 0;
              }
              
              .setting-label {
                  color: rgba(255, 255, 255, 0.8);
                  font-size: 12px;
                  width: 60px;
              }
              
              .color-picker {
                  width: 30px;
                  height: 30px;
                  border: 2px solid rgba(255, 255, 255, 0.3);
                  border-radius: 4px;
                  cursor: pointer;
              }
              
              .size-slider {
                  width: 100px;
                  height: 4px;
                  -webkit-appearance: none;
                  appearance: none;
                  background: rgba(255, 255, 255, 0.2);
                  border-radius: 2px;
                  outline: none;
              }
              
              .size-slider::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 16px;
                  height: 16px;
                  background: #007AFF;
                  border-radius: 50%;
                  cursor: pointer;
              }
              
              #text-input {
                  position: absolute;
                  display: none;
                  padding: 4px 8px;
                  border: 2px solid #007AFF;
                  border-radius: 4px;
                  font-size: 16px;
                  background: white;
                  min-width: 100px;
                  outline: none;
              }
              
              .mosaic-selector {
                  position: absolute;
                  border: 2px dashed #007AFF;
                  background: rgba(0, 122, 255, 0.1);
                  pointer-events: none;
                  display: none;
              }
          </style>
      </head>
      <body>
          <div id="editor-container">
              <canvas id="screenshot-canvas"></canvas>
              <canvas id="editing-canvas"></canvas>
              
              <div id="editing-bar">
                  <button class="tool-button" id="brush-tool" title="画笔">✏️</button>
                  <button class="tool-button" id="text-tool" title="文字">📝</button>
                  <button class="tool-button" id="mosaic-tool" title="马赛克">🔲</button>
                  <div class="tool-separator"></div>
                  <button class="tool-button" id="undo-btn" title="撤销">↩️</button>
                  <button class="tool-button" id="redo-btn" title="重做">↪️</button>
                  <div class="tool-separator"></div>
                  <button class="tool-button done-button" id="done-btn">Done</button>
              </div>
              
              <div id="tool-settings">
                  <div id="brush-settings" style="display: none;">
                      <div class="setting-row">
                          <span class="setting-label">颜色:</span>
                          <input type="color" class="color-picker" id="brush-color" value="#FF0000">
                      </div>
                      <div class="setting-row">
                          <span class="setting-label">粗细:</span>
                          <input type="range" class="size-slider" id="brush-size" min="1" max="20" value="3">
                          <span id="brush-size-value" style="color: white; font-size: 12px;">3</span>
                      </div>
                  </div>
                  
                  <div id="text-settings" style="display: none;">
                      <div class="setting-row">
                          <span class="setting-label">颜色:</span>
                          <input type="color" class="color-picker" id="text-color" value="#000000">
                      </div>
                      <div class="setting-row">
                          <span class="setting-label">大小:</span>
                          <input type="range" class="size-slider" id="text-size" min="12" max="72" value="16">
                          <span id="text-size-value" style="color: white; font-size: 12px;">16</span>
                      </div>
                  </div>
                  
                  <div id="mosaic-settings" style="display: none;">
                      <div class="setting-row">
                          <span class="setting-label">强度:</span>
                          <input type="range" class="size-slider" id="mosaic-intensity" min="5" max="30" value="10">
                          <span id="mosaic-intensity-value" style="color: white; font-size: 12px;">10</span>
                      </div>
                  </div>
              </div>
              
              <input type="text" id="text-input" placeholder="输入文字...">
              <div class="mosaic-selector" id="mosaic-selector"></div>
          </div>
          
          <script>
              class ScreenshotEditor {
                  constructor() {
                      this.screenshotCanvas = document.getElementById('screenshot-canvas');
                      this.editingCanvas = document.getElementById('editing-canvas');
                      this.screenshotCtx = this.screenshotCanvas.getContext('2d');
                      this.editingCtx = this.editingCanvas.getContext('2d');
                      this.editingBar = document.getElementById('editing-bar');
                      this.toolSettings = document.getElementById('tool-settings');
                      
                      this.currentTool = 'none';
                      this.isDrawing = false;
                      this.currentPath = [];
                      this.screenshotData = null;
                      this.selectionBounds = null;
                      
                      this.brushSettings = {
                          color: '#FF0000',
                          width: 3
                      };
                      
                      this.textSettings = {
                          color: '#000000',
                          fontSize: 16,
                          fontFamily: 'Arial'
                      };
                      
                      this.mosaicSettings = {
                          intensity: 10
                      };
                      
                      this.init();
                  }
                  
                  init() {
                      this.setupEventListeners();
                      this.setupIPC();
                  }
                  
                  setupIPC() {
                      window.api.onEditorInit((data) => {
                          this.screenshotData = data.screenshotData;
                          this.selectionBounds = data.selectionBounds;
                          this.setupCanvas();
                          this.positionEditingBar();
                      });
                  }
                  
                  async setupCanvas() {
                      const { x, y, width, height } = this.selectionBounds;
                      
                      this.screenshotCanvas.style.left = x + 'px';
                      this.screenshotCanvas.style.top = y + 'px';
                      this.screenshotCanvas.width = width;
                      this.screenshotCanvas.height = height;
                      
                      this.editingCanvas.style.left = x + 'px';
                      this.editingCanvas.style.top = y + 'px';
                      this.editingCanvas.width = width;
                      this.editingCanvas.height = height;
                      
                      const screenshotBuffer = await window.api.editorGetPreview();
                      if (screenshotBuffer) {
                          const blob = new Blob([screenshotBuffer], { type: 'image/png' });
                          const url = URL.createObjectURL(blob);
                          const img = new Image();
                          img.onload = () => {
                              // Draw the screenshot (already cropped to selection)
                              this.screenshotCtx.drawImage(img, 0, 0, width, height);
                              URL.revokeObjectURL(url);
                          };
                          img.src = url;
                      }
                  }
                  
                  positionEditingBar() {
                      const { x, y, width, height } = this.selectionBounds;
                      const barHeight = 52;
                      const margin = 10;
                      
                      let barY = y + height + margin;
                      if (barY + barHeight > window.innerHeight - 20) {
                          barY = y - barHeight - margin;
                      }
                      
                      const barWidth = this.editingBar.offsetWidth;
                      const barX = Math.max(10, Math.min(x + (width - barWidth) / 2, window.innerWidth - barWidth - 10));
                      
                      this.editingBar.style.left = barX + 'px';
                      this.editingBar.style.top = barY + 'px';
                      setTimeout(() => {
                          this.editingBar.classList.add('show');
                      }, 100);
                  }
                  
                  setupEventListeners() {
                      document.getElementById('brush-tool').addEventListener('click', () => this.selectTool('brush'));
                      document.getElementById('text-tool').addEventListener('click', () => this.selectTool('text'));
                      document.getElementById('mosaic-tool').addEventListener('click', () => this.selectTool('mosaic'));
                      
                      document.getElementById('undo-btn').addEventListener('click', () => this.undo());
                      document.getElementById('redo-btn').addEventListener('click', () => this.redo());
                      document.getElementById('done-btn').addEventListener('click', () => this.done());
                      
                      this.editingCanvas.addEventListener('mousedown', this.onMouseDown.bind(this));
                      this.editingCanvas.addEventListener('mousemove', this.onMouseMove.bind(this));
                      this.editingCanvas.addEventListener('mouseup', this.onMouseUp.bind(this));
                      
                      document.getElementById('brush-color').addEventListener('change', (e) => {
                          this.brushSettings.color = e.target.value;
                      });
                      
                      document.getElementById('brush-size').addEventListener('input', (e) => {
                          this.brushSettings.width = parseInt(e.target.value);
                          document.getElementById('brush-size-value').textContent = e.target.value;
                      });
                      
                      document.getElementById('text-color').addEventListener('change', (e) => {
                          this.textSettings.color = e.target.value;
                      });
                      
                      document.getElementById('text-size').addEventListener('input', (e) => {
                          this.textSettings.fontSize = parseInt(e.target.value);
                          document.getElementById('text-size-value').textContent = e.target.value;
                      });
                      
                      document.getElementById('mosaic-intensity').addEventListener('input', (e) => {
                          this.mosaicSettings.intensity = parseInt(e.target.value);
                          document.getElementById('mosaic-intensity-value').textContent = e.target.value;
                      });
                      
                      document.getElementById('text-input').addEventListener('keydown', (e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                              this.finishText();
                          }
                      });
                  }
                  
                  selectTool(tool) {
                      document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
                      document.getElementById(tool + '-tool').classList.add('active');
                      
                      this.currentTool = tool;
                      this.updateCursor();
                      this.showToolSettings(tool);
                  }
                  
                  updateCursor() {
                      switch (this.currentTool) {
                          case 'brush':
                              this.editingCanvas.style.cursor = 'crosshair';
                              break;
                          case 'text':
                              this.editingCanvas.style.cursor = 'text';
                              break;
                          case 'mosaic':
                              this.editingCanvas.style.cursor = 'crosshair';
                              break;
                          default:
                              this.editingCanvas.style.cursor = 'default';
                      }
                  }
                  
                  showToolSettings(tool) {
                      document.getElementById('brush-settings').style.display = 'none';
                      document.getElementById('text-settings').style.display = 'none';
                      document.getElementById('mosaic-settings').style.display = 'none';
                      
                      if (tool !== 'none') {
                          document.getElementById(tool + '-settings').style.display = 'block';
                          this.toolSettings.style.display = 'block';
                          
                          const toolBtn = document.getElementById(tool + '-tool');
                          const rect = toolBtn.getBoundingClientRect();
                          this.toolSettings.style.left = rect.left + 'px';
                          this.toolSettings.style.top = (rect.bottom + 8) + 'px';
                      } else {
                          this.toolSettings.style.display = 'none';
                      }
                  }
                  
                  onMouseDown(e) {
                      const rect = this.editingCanvas.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      
                      switch (this.currentTool) {
                          case 'brush':
                              this.startDrawing(x, y);
                              break;
                          case 'text':
                              this.startText(e.clientX, e.clientY);
                              break;
                          case 'mosaic':
                              this.startMosaic(x, y);
                              break;
                      }
                  }
                  
                  onMouseMove(e) {
                      const rect = this.editingCanvas.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      
                      if (this.isDrawing && this.currentTool === 'brush') {
                          this.draw(x, y);
                      } else if (this.isDrawing && this.currentTool === 'mosaic') {
                          this.updateMosaicSelector(x, y);
                      }
                  }
                  
                  onMouseUp(e) {
                      if (this.currentTool === 'brush' && this.isDrawing) {
                          this.endDrawing();
                      } else if (this.currentTool === 'mosaic' && this.isDrawing) {
                          this.endMosaic();
                      }
                  }
                  
                  startDrawing(x, y) {
                      this.isDrawing = true;
                      this.currentPath = [{ x, y }];
                      
                      this.editingCtx.beginPath();
                      this.editingCtx.moveTo(x, y);
                      this.editingCtx.strokeStyle = this.brushSettings.color;
                      this.editingCtx.lineWidth = this.brushSettings.width;
                      this.editingCtx.lineCap = 'round';
                      this.editingCtx.lineJoin = 'round';
                  }
                  
                  draw(x, y) {
                      this.currentPath.push({ x, y });
                      this.editingCtx.lineTo(x, y);
                      this.editingCtx.stroke();
                  }
                  
                  async endDrawing() {
                      this.isDrawing = false;
                      
                      if (this.currentPath.length > 1) {
                          const action = {
                              id: Date.now().toString(),
                              tool: 'brush',
                              timestamp: Date.now(),
                              data: {
                                  type: 'brush',
                                  color: this.brushSettings.color,
                                  width: this.brushSettings.width,
                                  points: this.currentPath
                              }
                          };
                          
                          await window.api.editorApplyAction(action);
                      }
                      
                      this.currentPath = [];
                  }
                  
                  startText(clientX, clientY) {
                      const input = document.getElementById('text-input');
                      input.style.left = clientX + 'px';
                      input.style.top = clientY + 'px';
                      input.style.fontSize = this.textSettings.fontSize + 'px';
                      input.style.color = this.textSettings.color;
                      input.style.display = 'block';
                      input.value = '';
                      input.focus();
                      
                      this.textPosition = { x: clientX, y: clientY };
                  }
                  
                  async finishText() {
                      const input = document.getElementById('text-input');
                      const text = input.value.trim();
                      
                      if (text) {
                          const rect = this.editingCanvas.getBoundingClientRect();
                          const x = this.textPosition.x - rect.left;
                          const y = this.textPosition.y - rect.top;
                          
                          this.editingCtx.fillStyle = this.textSettings.color;
                          this.editingCtx.font = this.textSettings.fontSize + 'px ' + this.textSettings.fontFamily;
                          this.editingCtx.textBaseline = 'top';
                          this.editingCtx.fillText(text, x, y);
                          
                          const action = {
                              id: Date.now().toString(),
                              tool: 'text',
                              timestamp: Date.now(),
                              data: {
                                  type: 'text',
                                  color: this.textSettings.color,
                                  fontSize: this.textSettings.fontSize,
                                  fontFamily: this.textSettings.fontFamily,
                                  text: text,
                                  position: { x, y },
                                  bounds: { width: 0, height: 0 }
                              }
                          };
                          
                          await window.api.editorApplyAction(action);
                      }
                      
                      input.style.display = 'none';
                      input.value = '';
                  }
                  
                  startMosaic(x, y) {
                      this.isDrawing = true;
                      this.mosaicStart = { x, y };
                      this.mosaicEnd = { x, y };
                      
                      const selector = document.getElementById('mosaic-selector');
                      selector.style.display = 'block';
                      this.updateMosaicSelector(x, y);
                  }
                  
                  updateMosaicSelector(x, y) {
                      this.mosaicEnd = { x, y };
                      
                      const selector = document.getElementById('mosaic-selector');
                      const rect = this.editingCanvas.getBoundingClientRect();
                      
                      const left = Math.min(this.mosaicStart.x, x) + rect.left;
                      const top = Math.min(this.mosaicStart.y, y) + rect.top;
                      const width = Math.abs(x - this.mosaicStart.x);
                      const height = Math.abs(y - this.mosaicStart.y);
                      
                      selector.style.left = left + 'px';
                      selector.style.top = top + 'px';
                      selector.style.width = width + 'px';
                      selector.style.height = height + 'px';
                  }
                  
                  async endMosaic() {
                      this.isDrawing = false;
                      
                      const selector = document.getElementById('mosaic-selector');
                      selector.style.display = 'none';
                      
                      const x = Math.min(this.mosaicStart.x, this.mosaicEnd.x);
                      const y = Math.min(this.mosaicStart.y, this.mosaicEnd.y);
                      const width = Math.abs(this.mosaicEnd.x - this.mosaicStart.x);
                      const height = Math.abs(this.mosaicEnd.y - this.mosaicStart.y);
                      
                      if (width > 5 && height > 5) {
                          this.applyMosaicEffect(x, y, width, height);
                          
                          const action = {
                              id: Date.now().toString(),
                              tool: 'mosaic',
                              timestamp: Date.now(),
                              data: {
                                  type: 'mosaic',
                                  intensity: this.mosaicSettings.intensity,
                                  bounds: { x, y, width, height }
                              }
                          };
                          
                          await window.api.editorApplyAction(action);
                      }
                  }
                  
                  applyMosaicEffect(x, y, width, height) {
                      const imageData = this.screenshotCtx.getImageData(x, y, width, height);
                      const data = imageData.data;
                      const pixelSize = this.mosaicSettings.intensity;
                      
                      for (let py = 0; py < height; py += pixelSize) {
                          for (let px = 0; px < width; px += pixelSize) {
                              const red = data[(py * width + px) * 4];
                              const green = data[(py * width + px) * 4 + 1];
                              const blue = data[(py * width + px) * 4 + 2];
                              
                              for (let y2 = py; y2 < py + pixelSize && y2 < height; y2++) {
                                  for (let x2 = px; x2 < px + pixelSize && x2 < width; x2++) {
                                      const index = (y2 * width + x2) * 4;
                                      data[index] = red;
                                      data[index + 1] = green;
                                      data[index + 2] = blue;
                                  }
                              }
                          }
                      }
                      
                      this.editingCtx.putImageData(imageData, x, y);
                  }
                  
                  async undo() {
                      await window.api.editorUndo();
                      await this.refreshCanvas();
                  }
                  
                  async redo() {
                      await window.api.editorRedo();
                      await this.refreshCanvas();
                  }
                  
                  async refreshCanvas() {
                      this.editingCtx.clearRect(0, 0, this.editingCanvas.width, this.editingCanvas.height);
                      
                      const buffer = await window.api.editorGetPreview();
                      if (buffer) {
                          const blob = new Blob([buffer], { type: 'image/png' });
                          const url = URL.createObjectURL(blob);
                          const img = new Image();
                          img.onload = () => {
                              this.screenshotCtx.clearRect(0, 0, this.screenshotCanvas.width, this.screenshotCanvas.height);
                              this.screenshotCtx.drawImage(img, 0, 0);
                              URL.revokeObjectURL(url);
                          };
                          img.src = url;
                      }
                  }
                  
                  async done() {
                      window.api.ipcRenderer.send('editor:done');
                  }
              }
              
              if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', () => {
                      new ScreenshotEditor();
                  });
              } else {
                  new ScreenshotEditor();
              }
          </script>
      </body>
      </html>
    `
  }

  close(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close()
    }
    this.window = null
  }
}

export class EditorWindowManager {
  private editorWindow: EditorWindow | null = null

  async showEditor(
    screenshotData: ScreenshotData,
    selectionBounds: Rectangle,
    onComplete?: () => void,
    onCancel?: () => void
  ): Promise<void> {
    if (this.editorWindow) {
      this.editorWindow.close()
    }

    this.editorWindow = new EditorWindow(
      screenshotData,
      selectionBounds,
      onComplete,
      onCancel
    )

    await this.editorWindow.create()
  }

  cleanup(): void {
    if (this.editorWindow) {
      this.editorWindow.close()
      this.editorWindow = null
    }
  }
}

export const editorWindowManager = new EditorWindowManager()