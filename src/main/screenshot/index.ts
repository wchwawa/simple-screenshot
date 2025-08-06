import { DisplayManager } from './display'
import { ScreenshotCapture } from './capture'
import { overlayWindowManager } from '../windows/overlay'
import { clipboardManager } from '../clipboard'
import { editorWindowManager } from '../windows/editor'
import { editorManager } from '../editor'
import type { 
  ScreenshotOptions, 
  ScreenshotData, 
  Rectangle,
  Display,
  ScreenshotResult
} from '../../shared/types/screenshot'
import { ScreenshotMode } from '../../shared/types/screenshot'

export class ScreenshotManager {
  private displayManager: DisplayManager
  private capture: ScreenshotCapture
  private isCapturing = false

  constructor() {
    this.displayManager = new DisplayManager()
    this.capture = new ScreenshotCapture()
  }

  async initialize(): Promise<void> {
    // Validate permissions
    const hasPermission = await this.capture.validatePermissions()
    if (!hasPermission) {
      throw new Error('Screen capture permission denied')
    }

    console.log('ScreenshotManager initialized successfully')
  }

  async takeScreenshot(
    mode: ScreenshotMode = ScreenshotMode.FULLSCREEN,
    options: Partial<ScreenshotOptions> = {}
  ): Promise<ScreenshotResult> {
    // Prevent concurrent captures
    if (this.isCapturing) {
      console.warn('Screenshot already in progress, ignoring request')
      return {
        success: false,
        error: 'Screenshot already in progress'
      }
    }

    this.isCapturing = true

    try {
      let screenshotData: ScreenshotData

      switch (mode) {
        case ScreenshotMode.FULLSCREEN:
          screenshotData = await this.captureFullscreen(options)
          break
        
        case ScreenshotMode.REGION:
          screenshotData = await this.captureRegionWithSelection(options)
          break
        
        case ScreenshotMode.WINDOW:
          if (!options.displayId) {
            throw new Error('Window ID required for window capture')
          }
          screenshotData = await this.capture.captureWindow(options.displayId)
          break
        
        default:
          throw new Error(`Unsupported screenshot mode: ${mode}`)
      }

      // For region mode, enter edit mode instead of directly copying
      if (mode === ScreenshotMode.REGION) {
        // Initialize editor with screenshot data
        await editorManager.initializeEditor(screenshotData)
        
        // Show editor window
        await editorWindowManager.showEditor(
          screenshotData,
          options.bounds || { x: 0, y: 0, width: screenshotData.width, height: screenshotData.height },
          () => {
            console.log('Editing completed')
          },
          () => {
            console.log('Editing cancelled')
          }
        )
      } else {
        // For other modes, copy directly to clipboard
        const clipboardSuccess = await clipboardManager.copyScreenshot(screenshotData)
        if (!clipboardSuccess) {
          console.warn('Failed to copy screenshot to clipboard')
        }
      }

      return {
        success: true,
        data: screenshotData
      }
    } catch (error) {
      console.error('Screenshot failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    } finally {
      this.isCapturing = false
      
      // Clear cache to free memory
      this.capture.clearCache()
    }
  }

  private async captureFullscreen(options: Partial<ScreenshotOptions>): Promise<ScreenshotData> {
    if (options.displayId) {
      const display = this.displayManager.getDisplay(options.displayId)
      if (!display) {
        throw new Error(`Display ${options.displayId} not found`)
      }
      
      const screenshotData = await this.capture.captureScreen({
        displayId: options.displayId,
        format: options.format,
        quality: options.quality
      })
      
      // Update scale factor from display info
      screenshotData.scaleFactor = display.scaleFactor
      return screenshotData
    }
    
    // Default to primary display
    const primary = this.displayManager.getPrimaryDisplay()
    const screenshotData = await this.capture.captureScreen({
      displayId: primary.id,
      format: options.format,
      quality: options.quality
    })
    
    screenshotData.scaleFactor = primary.scaleFactor
    return screenshotData
  }

  private async captureRegionWithSelection(options: Partial<ScreenshotOptions>): Promise<ScreenshotData> {
    // Show selection overlay and wait for user selection
    // NOTE: selectedBounds are in logical pixels (DIPs) from the overlay
    const selectedBounds = await this.showSelectionOverlay(options.displayId)
    
    if (!selectedBounds) {
      throw new Error('No region selected or selection was cancelled')
    }

    console.log('User selected region (logical pixels):', selectedBounds)

    // Use the user-selected bounds for capture
    const screenshotData = await this.captureRegion({ ...options, bounds: selectedBounds })
    
    // Store the selected bounds for editor positioning
    if (options) {
      options.bounds = selectedBounds
    }
    
    return screenshotData
  }

  private async captureRegion(options: Partial<ScreenshotOptions>): Promise<ScreenshotData> {
    if (!options.bounds) {
      throw new Error('Bounds required for region capture')
    }

    // Bounds are in logical pixels (DIPs) from overlay
    const logicalBounds = options.bounds
    console.log('Capture region - Logical bounds:', logicalBounds)
    
    // Find which display contains the region
    const centerX = logicalBounds.x + logicalBounds.width / 2
    const centerY = logicalBounds.y + logicalBounds.height / 2
    const display = this.displayManager.getDisplayAtPoint(centerX, centerY)
    
    if (!display) {
      throw new Error('No display found for the specified region')
    }
    
    console.log('Selected display:', display.id, 'scaleFactor:', display.scaleFactor)

    // Convert global logical coordinates to display-relative logical coordinates
    const relativeLogicalBounds = {
      x: logicalBounds.x - display.bounds.x,
      y: logicalBounds.y - display.bounds.y,
      width: logicalBounds.width,
      height: logicalBounds.height
    }
    
    console.log('Relative logical bounds:', relativeLogicalBounds)

    // Convert to physical pixels for capture
    const scaleFactor = display.scaleFactor
    const physicalBounds: Rectangle = {
      x: Math.floor(relativeLogicalBounds.x * scaleFactor),
      y: Math.floor(relativeLogicalBounds.y * scaleFactor),
      width: Math.round(relativeLogicalBounds.width * scaleFactor),
      height: Math.round(relativeLogicalBounds.height * scaleFactor)
    }
    
    console.log('Physical bounds for capture:', physicalBounds)

    const screenshotData = await this.capture.captureScreen({
      displayId: display.id,
      bounds: physicalBounds,
      format: options.format,
      quality: options.quality
    })

    // Store the scale factor
    screenshotData.scaleFactor = display.scaleFactor
    return screenshotData
  }

  async showSelectionOverlay(displayId?: string): Promise<Rectangle | null> {
    return await overlayWindowManager.showSelectionOverlay(displayId)
  }

  getDisplays(): Display[] {
    return this.displayManager.getAllDisplays()
  }

  getPrimaryDisplay(): Display {
    return this.displayManager.getPrimaryDisplay()
  }

  getTotalBounds(): Rectangle {
    return this.displayManager.getTotalBounds()
  }

  async cleanup(): Promise<void> {
    // Close any open overlay windows
    overlayWindowManager.cleanup()

    // Clear capture cache
    this.capture.clearCache()
    
    console.log('ScreenshotManager cleaned up')
  }
}

// Export a singleton instance
export const screenshotManager = new ScreenshotManager()