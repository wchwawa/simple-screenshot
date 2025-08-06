import { nativeImage } from 'electron'
import { createCanvas, Image } from 'canvas'
import type { ScreenshotData } from '../../shared/types/screenshot'
import type { EditorAction, BrushAction, TextAction, MosaicAction } from '../../shared/types/editor'

export class ImageProcessor {
  private canvas: any = null
  private ctx: any = null
  private originalImage: any = null
  private width: number = 0
  private height: number = 0
  
  async initialize(screenshotData: ScreenshotData): Promise<void> {
    try {
      this.width = screenshotData.width
      this.height = screenshotData.height
      
      // Create canvas
      this.canvas = createCanvas(this.width, this.height)
      this.ctx = this.canvas.getContext('2d')
      
      if (!this.ctx) {
        throw new Error('Failed to get canvas context')
      }
      
      // Load image from buffer
      const image = nativeImage.createFromBuffer(screenshotData.buffer)
      const dataUrl = image.toDataURL()
      
      // Create and load image
      this.originalImage = new Image()
      await new Promise((resolve, reject) => {
        this.originalImage.onload = resolve
        this.originalImage.onerror = reject
        this.originalImage.src = dataUrl
      })
      
      // Draw original image to canvas
      this.ctx.drawImage(this.originalImage, 0, 0)
    } catch (error) {
      console.error('Failed to initialize image processor:', error)
      throw error
    }
  }
  
  async applyAction(action: EditorAction): Promise<void> {
    if (!this.ctx || !this.canvas) {
      throw new Error('Image processor not initialized')
    }
    
    switch (action.tool) {
      case 'brush':
        await this.applyBrushAction(action.data as BrushAction)
        break
      case 'text':
        await this.applyTextAction(action.data as TextAction)
        break
      case 'mosaic':
        await this.applyMosaicAction(action.data as MosaicAction)
        break
    }
  }
  
  private async applyBrushAction(action: BrushAction): Promise<void> {
    if (!this.ctx) return
    
    this.ctx.strokeStyle = action.color
    this.ctx.lineWidth = action.width
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    
    if (action.points.length < 2) return
    
    this.ctx.beginPath()
    this.ctx.moveTo(action.points[0].x, action.points[0].y)
    
    for (let i = 1; i < action.points.length; i++) {
      this.ctx.lineTo(action.points[i].x, action.points[i].y)
    }
    
    this.ctx.stroke()
  }
  
  private async applyTextAction(action: TextAction): Promise<void> {
    if (!this.ctx) return
    
    this.ctx.fillStyle = action.color
    this.ctx.font = `${action.fontSize}px ${action.fontFamily}`
    this.ctx.textBaseline = 'top'
    
    const lines = action.text.split('\n')
    let y = action.position.y
    
    for (const line of lines) {
      this.ctx.fillText(line, action.position.x, y)
      y += action.fontSize * 1.2
    }
  }
  
  private async applyMosaicAction(action: MosaicAction): Promise<void> {
    if (!this.ctx || !this.canvas) return
    
    const { x, y, width, height } = action.bounds
    const pixelSize = Math.max(5, action.intensity)
    
    const imageData = this.ctx.getImageData(x, y, width, height)
    const data = imageData.data
    
    for (let py = 0; py < height; py += pixelSize) {
      for (let px = 0; px < width; px += pixelSize) {
        const red = data[(py * width + px) * 4]
        const green = data[(py * width + px) * 4 + 1]
        const blue = data[(py * width + px) * 4 + 2]
        
        for (let y2 = py; y2 < py + pixelSize && y2 < height; y2++) {
          for (let x2 = px; x2 < px + pixelSize && x2 < width; x2++) {
            const index = (y2 * width + x2) * 4
            data[index] = red
            data[index + 1] = green
            data[index + 2] = blue
          }
        }
      }
    }
    
    this.ctx.putImageData(imageData, x, y)
  }
  
  async resetToOriginal(): Promise<void> {
    if (!this.ctx || !this.originalImage) return
    
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.ctx.drawImage(this.originalImage, 0, 0)
  }
  
  async getProcessedImage(): Promise<Buffer> {
    if (!this.canvas) {
      throw new Error('Canvas not initialized')
    }
    
    return this.canvas.toBuffer('image/png')
  }
  
  cleanup(): void {
    this.canvas = null
    this.ctx = null
    this.originalImage = null
  }
}