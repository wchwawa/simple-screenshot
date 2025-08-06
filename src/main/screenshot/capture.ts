import { desktopCapturer, nativeImage, screen } from 'electron'
import type { 
  CaptureOptions, 
  CaptureSource, 
  ScreenshotOptions, 
  ScreenshotData,
  Rectangle
} from '../../shared/types/screenshot'

export class ScreenshotCapture {
  private cache: Map<string, CaptureSource[]> = new Map()
  private cacheExpiry: Map<string, number> = new Map()
  private readonly CACHE_DURATION = 500 // Reduced cache duration
  private readonly MAX_THUMBNAIL_SIZE = { width: 3840, height: 2160 } // Further reduced to prevent memory issues
  private lastCaptureTime = 0
  private readonly MIN_CAPTURE_INTERVAL = 200 // Minimum time between captures (ms)

  async getSources(options: CaptureOptions = {}): Promise<CaptureSource[]> {
    const cacheKey = JSON.stringify(options)
    const now = Date.now()
    
    // Clean up expired cache entries
    this.cleanupExpiredCache()
    
    // Check cache
    if (this.cache.has(cacheKey) && this.cacheExpiry.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey)!
      if (now < expiry) {
        return this.cache.get(cacheKey)!
      }
    }

    try {
      const sources = await desktopCapturer.getSources({
        types: options.types || ['screen'],
        thumbnailSize: options.thumbnailSize || { width: 150, height: 150 },
        fetchWindowIcons: options.fetchWindowIcons || false
      })

      const captureSource: CaptureSource[] = sources.map(source => ({
        id: source.id,
        name: source.name,
        displayId: source.display_id,
        thumbnail: source.thumbnail,
        appIcon: source.appIcon
      }))

      // Update cache
      this.cache.set(cacheKey, captureSource)
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION)

      return captureSource
    } catch (error) {
      console.error('Failed to get capture sources:', error)
      throw new Error('Failed to access screen capture sources')
    }
  }

  async captureScreen(options: ScreenshotOptions = {}): Promise<ScreenshotData> {
    const startTime = Date.now()
    
    // Prevent too frequent captures to avoid memory issues
    if (startTime - this.lastCaptureTime < this.MIN_CAPTURE_INTERVAL) {
      throw new Error(`Too frequent capture requests. Please wait ${this.MIN_CAPTURE_INTERVAL}ms between captures.`)
    }
    
    this.lastCaptureTime = startTime
    
    try {
      const sources = await this.getSources({ types: ['screen'] })
      
      if (sources.length === 0) {
        throw new Error('No screen sources available. Check display permissions.')
      }
      
      let targetSource: CaptureSource | undefined
      
      if (options.displayId) {
        console.log('Looking for display:', options.displayId)
        console.log('Available sources:', sources.map(s => ({ id: s.id, displayId: s.displayId, name: s.name })))
        targetSource = sources.find(source => source.displayId === options.displayId)
        if (!targetSource) {
          throw new Error(`Display ${options.displayId} not found. Available displays: ${sources.map(s => s.displayId).join(', ')}`)
        }
      } else {
        // Use first available screen source
        targetSource = sources.find(source => source.id.startsWith('screen'))
        if (!targetSource) {
          throw new Error('No screen sources found')
        }
      }

      // Get full resolution screenshot with optimized size
      // For high DPI displays, we need to capture at the actual physical resolution
      const displays = screen.getAllDisplays()
      const targetDisplay = displays.find(d => d.id.toString() === targetSource.displayId)
      
      let captureSize = this.MAX_THUMBNAIL_SIZE
      if (targetDisplay) {
        // Use actual display size in physical pixels
        captureSize = {
          width: Math.round(targetDisplay.bounds.width * targetDisplay.scaleFactor),
          height: Math.round(targetDisplay.bounds.height * targetDisplay.scaleFactor)
        }
        console.log('Using display-specific capture size:', captureSize, 'for display:', targetDisplay.id)
      }
      
      const fullSources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: captureSize
      })

      const fullSource = fullSources.find(source => source.id === targetSource!.id)
      if (!fullSource) {
        throw new Error(`Failed to get full resolution screenshot for source ${targetSource.id}`)
      }

      const thumbnail = fullSource.thumbnail
      if (thumbnail.isEmpty()) {
        throw new Error('Captured screenshot is empty')
      }

      let imageBuffer: Buffer
      const size = thumbnail.getSize()

      // Validate bounds if specified
      if (options.bounds) {
        const bounds = options.bounds
        console.log('=== CROP VALIDATION ===')
        console.log('Input bounds (physical pixels):', bounds)
        console.log('Captured image size (physical pixels):', size)
        
        // Ensure bounds are within image dimensions
        const adjustedBounds = {
          x: Math.max(0, Math.min(bounds.x, size.width - 1)),
          y: Math.max(0, Math.min(bounds.y, size.height - 1)),
          width: Math.min(bounds.width, size.width - bounds.x),
          height: Math.min(bounds.height, size.height - bounds.y)
        }
        
        if (adjustedBounds.width < 1 || adjustedBounds.height < 1) {
          throw new Error(`Invalid bounds dimensions after adjustment: ${adjustedBounds.width}x${adjustedBounds.height}`)
        }
        
        if (JSON.stringify(bounds) !== JSON.stringify(adjustedBounds)) {
          console.warn('⚠️ Bounds were adjusted to fit within image!')
          console.log('Original bounds:', bounds)
          console.log('Adjusted bounds:', adjustedBounds)
        }

        const croppedImage = await this.cropImage(thumbnail, adjustedBounds)
        imageBuffer = croppedImage.toPNG()
      } else {
        imageBuffer = thumbnail.toPNG()
      }

      // Convert format if needed
      if (options.format === 'jpg') {
        const image = nativeImage.createFromBuffer(imageBuffer)
        imageBuffer = image.toJPEG(Math.max(10, Math.min(100, options.quality || 90)))
      }

      const endTime = Date.now()
      console.log(`Screenshot capture completed in ${endTime - startTime}ms`)

      return {
        buffer: imageBuffer,
        width: options.bounds?.width || size.width,
        height: options.bounds?.height || size.height,
        displayId: targetSource.displayId,
        scaleFactor: 1, // Will be updated by display manager
        timestamp: Date.now()
      }
    } catch (error) {
      const endTime = Date.now()
      console.error(`Screenshot capture failed after ${endTime - startTime}ms:`, error)
      throw new Error(`Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async captureWindow(windowId: string): Promise<ScreenshotData> {
    try {
      const sources = await this.getSources({ types: ['window'] })
      const windowSource = sources.find(source => source.id === windowId)
      
      if (!windowSource) {
        throw new Error('Window not found')
      }

      const fullSources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: this.MAX_THUMBNAIL_SIZE
      })

      const fullSource = fullSources.find(source => source.id === windowId)
      if (!fullSource) {
        throw new Error('Failed to capture window')
      }

      const imageBuffer = fullSource.thumbnail.toPNG()
      const size = fullSource.thumbnail.getSize()

      return {
        buffer: imageBuffer,
        width: size.width,
        height: size.height,
        displayId: windowSource.displayId,
        scaleFactor: 1,
        timestamp: Date.now()
      }
    } catch (error) {
      console.error('Window capture failed:', error)
      throw new Error(`Window capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async cropImage(image: Electron.NativeImage, bounds: Rectangle): Promise<Electron.NativeImage> {
    try {
      // Important: Use exact values without modification
      const cropBounds = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }
      
      console.log('=== CROPPING ===')
      console.log('Image size:', image.getSize())
      console.log('Crop bounds:', cropBounds)
      
      const croppedImage = image.crop(cropBounds)
      
      console.log('Cropped image size:', croppedImage.getSize())
      
      return croppedImage
    } catch (error) {
      console.error('Image cropping failed:', error)
      console.error('Failed bounds:', bounds)
      throw new Error('Failed to crop image')
    }
  }

  clearCache(): void {
    this.cache.clear()
    this.cacheExpiry.clear()
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    console.log('Screenshot capture cache cleared')
  }

  // Clean up expired cache entries
  private cleanupExpiredCache(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    for (const [key, expiry] of this.cacheExpiry) {
      if (now > expiry) {
        expiredKeys.push(key)
      }
    }
    
    expiredKeys.forEach(key => {
      this.cache.delete(key)
      this.cacheExpiry.delete(key)
    })
    
    if (expiredKeys.length > 0) {
      console.log(`Cleaned up ${expiredKeys.length} expired cache entries`)
    }
  }

  // Get memory usage statistics
  getMemoryUsage(): { cache: number; total: number } {
    const cacheEntries = this.cache.size
    const process = require('process')
    const memUsage = process.memoryUsage()
    
    return {
      cache: cacheEntries,
      total: Math.round(memUsage.heapUsed / 1024 / 1024) // MB
    }
  }

  // Helper method to validate capture permissions
  async validatePermissions(): Promise<boolean> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1, height: 1 }
      })
      return sources.length > 0
    } catch (error) {
      console.error('Permission validation failed:', error)
      return false
    }
  }
}