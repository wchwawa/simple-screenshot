import { ipcMain } from 'electron'
import { ImageProcessor } from './image-processor'
import type { ScreenshotData } from '../../shared/types/screenshot'
import type { EditorAction, EditorResult } from '../../shared/types/editor'
import { clipboardManager } from '../clipboard'

export class EditorManager {
  private imageProcessor: ImageProcessor | null = null
  private currentScreenshot: ScreenshotData | null = null
  private editHistory: EditorAction[] = []
  private historyIndex = -1
  
  constructor() {
    this.setupIpcHandlers()
  }
  
  private setupIpcHandlers(): void {
    ipcMain.handle('editor:init', async (_, screenshotData: ScreenshotData) => {
      return await this.initializeEditor(screenshotData)
    })
    
    ipcMain.handle('editor:apply-action', async (_, action: EditorAction) => {
      return await this.applyAction(action)
    })
    
    ipcMain.handle('editor:undo', async () => {
      return await this.undo()
    })
    
    ipcMain.handle('editor:redo', async () => {
      return await this.redo()
    })
    
    ipcMain.handle('editor:save', async () => {
      return await this.saveToClipboard()
    })
    
    ipcMain.handle('editor:get-preview', async () => {
      return await this.getPreview()
    })
  }
  
  async initializeEditor(screenshotData: ScreenshotData): Promise<boolean> {
    try {
      this.currentScreenshot = screenshotData
      this.imageProcessor = new ImageProcessor()
      await this.imageProcessor.initialize(screenshotData)
      this.editHistory = []
      this.historyIndex = -1
      return true
    } catch (error) {
      console.error('Failed to initialize editor:', error)
      return false
    }
  }
  
  async applyAction(action: EditorAction): Promise<EditorResult> {
    if (!this.imageProcessor) {
      return { success: false, error: 'Editor not initialized' }
    }
    
    try {
      await this.imageProcessor.applyAction(action)
      
      if (this.historyIndex < this.editHistory.length - 1) {
        this.editHistory = this.editHistory.slice(0, this.historyIndex + 1)
      }
      
      this.editHistory.push(action)
      this.historyIndex++
      
      return { success: true }
    } catch (error) {
      console.error('Failed to apply action:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
  
  async undo(): Promise<EditorResult> {
    if (!this.imageProcessor || this.historyIndex < 0) {
      return { success: false, error: 'Nothing to undo' }
    }
    
    try {
      this.historyIndex--
      await this.rebuildCanvas()
      return { success: true }
    } catch (error) {
      console.error('Failed to undo:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
  
  async redo(): Promise<EditorResult> {
    if (!this.imageProcessor || this.historyIndex >= this.editHistory.length - 1) {
      return { success: false, error: 'Nothing to redo' }
    }
    
    try {
      this.historyIndex++
      await this.rebuildCanvas()
      return { success: true }
    } catch (error) {
      console.error('Failed to redo:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
  
  private async rebuildCanvas(): Promise<void> {
    if (!this.imageProcessor) return
    
    await this.imageProcessor.resetToOriginal()
    
    for (let i = 0; i <= this.historyIndex; i++) {
      await this.imageProcessor.applyAction(this.editHistory[i])
    }
  }
  
  async getPreview(): Promise<Buffer | null> {
    if (!this.imageProcessor) return null
    
    try {
      return await this.imageProcessor.getProcessedImage()
    } catch (error) {
      console.error('Failed to get preview:', error)
      return null
    }
  }
  
  async saveToClipboard(): Promise<EditorResult> {
    if (!this.imageProcessor || !this.currentScreenshot) {
      return { success: false, error: 'No image to save' }
    }
    
    try {
      const buffer = await this.imageProcessor.getProcessedImage()
      const editedScreenshot: ScreenshotData = {
        ...this.currentScreenshot,
        buffer,
        timestamp: Date.now()
      }
      
      const success = await clipboardManager.copyScreenshot(editedScreenshot)
      
      if (success) {
        this.cleanup()
        return { success: true }
      } else {
        return { success: false, error: 'Failed to copy to clipboard' }
      }
    } catch (error) {
      console.error('Failed to save to clipboard:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }
  
  cleanup(): void {
    if (this.imageProcessor) {
      this.imageProcessor.cleanup()
      this.imageProcessor = null
    }
    this.currentScreenshot = null
    this.editHistory = []
    this.historyIndex = -1
  }
}

export const editorManager = new EditorManager()