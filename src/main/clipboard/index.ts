import { clipboard, nativeImage } from 'electron'
import type { ScreenshotData } from '../../shared/types/screenshot'

export class ClipboardManager {
  /**
   * Copy screenshot data to clipboard
   */
  async copyScreenshot(screenshotData: ScreenshotData): Promise<boolean> {
    try {
      const image = nativeImage.createFromBuffer(screenshotData.buffer)
      
      if (image.isEmpty()) {
        console.error('Failed to create image from buffer')
        return false
      }

      // Copy image to clipboard
      clipboard.writeImage(image)
      
      console.log(`Screenshot copied to clipboard: ${screenshotData.width}x${screenshotData.height}`)
      return true
    } catch (error) {
      console.error('Failed to copy screenshot to clipboard:', error)
      return false
    }
  }

  /**
   * Copy text to clipboard
   */
  copyText(text: string): boolean {
    try {
      clipboard.writeText(text)
      console.log('Text copied to clipboard')
      return true
    } catch (error) {
      console.error('Failed to copy text to clipboard:', error)
      return false
    }
  }

  /**
   * Get text from clipboard
   */
  getText(): string {
    try {
      return clipboard.readText()
    } catch (error) {
      console.error('Failed to read text from clipboard:', error)
      return ''
    }
  }

  /**
   * Get image from clipboard
   */
  getImage(): Electron.NativeImage | null {
    try {
      const image = clipboard.readImage()
      return image.isEmpty() ? null : image
    } catch (error) {
      console.error('Failed to read image from clipboard:', error)
      return null
    }
  }

  /**
   * Check if clipboard has image
   */
  hasImage(): boolean {
    try {
      const image = clipboard.readImage()
      return !image.isEmpty()
    } catch (error) {
      console.error('Failed to check clipboard for image:', error)
      return false
    }
  }

  /**
   * Check if clipboard has text
   */
  hasText(): boolean {
    try {
      const text = clipboard.readText()
      return text.length > 0
    } catch (error) {
      console.error('Failed to check clipboard for text:', error)
      return false
    }
  }

  /**
   * Clear clipboard
   */
  clear(): boolean {
    try {
      clipboard.clear()
      console.log('Clipboard cleared')
      return true
    } catch (error) {
      console.error('Failed to clear clipboard:', error)
      return false
    }
  }

  /**
   * Get clipboard formats
   */
  getFormats(): string[] {
    try {
      return clipboard.availableFormats()
    } catch (error) {
      console.error('Failed to get clipboard formats:', error)
      return []
    }
  }

  /**
   * Copy multiple formats to clipboard
   */
  copyMultipleFormats(data: { text?: string; image?: Buffer; html?: string }): boolean {
    try {
      const formats: any = {}

      if (data.text) {
        formats.text = data.text
      }

      if (data.image) {
        const image = nativeImage.createFromBuffer(data.image)
        if (!image.isEmpty()) {
          formats.image = image
        }
      }

      if (data.html) {
        formats.html = data.html
      }

      if (Object.keys(formats).length === 0) {
        console.warn('No valid formats provided for clipboard')
        return false
      }

      clipboard.write(formats)
      console.log('Multiple formats copied to clipboard:', Object.keys(formats))
      return true
    } catch (error) {
      console.error('Failed to copy multiple formats to clipboard:', error)
      return false
    }
  }
}

// Export singleton instance
export const clipboardManager = new ClipboardManager()