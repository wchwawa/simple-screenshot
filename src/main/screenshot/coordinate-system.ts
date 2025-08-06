import { screen } from 'electron'
import type { Display, Rectangle } from '../../shared/types/screenshot'

/**
 * Coordinate System Helper
 * 
 * This module provides utilities for converting between different coordinate systems:
 * - Logical Pixels (DIPs): Used by Electron BrowserWindow, mouse events
 * - Physical Pixels: Used by desktopCapturer, actual screen pixels
 * 
 * Key principle: All internal calculations use PHYSICAL PIXELS for pixel-perfect accuracy
 */

export class CoordinateSystem {
  /**
   * Convert logical pixels to physical pixels
   */
  static toPhysicalPixels(logicalRect: Rectangle, scaleFactor: number): Rectangle {
    return {
      x: logicalRect.x * scaleFactor,
      y: logicalRect.y * scaleFactor,
      width: logicalRect.width * scaleFactor,
      height: logicalRect.height * scaleFactor
    }
  }

  /**
   * Convert physical pixels to logical pixels
   */
  static toLogicalPixels(physicalRect: Rectangle, scaleFactor: number): Rectangle {
    return {
      x: physicalRect.x / scaleFactor,
      y: physicalRect.y / scaleFactor,
      width: physicalRect.width / scaleFactor,
      height: physicalRect.height / scaleFactor
    }
  }

  /**
   * Get display containing a physical pixel point
   */
  static getDisplayForPhysicalPoint(physicalX: number, physicalY: number): Display | null {
    const displays = screen.getAllDisplays()
    
    for (const display of displays) {
      const scaleFactor = display.scaleFactor
      const physicalBounds = this.toPhysicalPixels(display.bounds, scaleFactor)
      
      if (physicalX >= physicalBounds.x && 
          physicalX < physicalBounds.x + physicalBounds.width &&
          physicalY >= physicalBounds.y && 
          physicalY < physicalBounds.y + physicalBounds.height) {
        return {
          id: display.id.toString(),
          name: `Display ${display.id}`,
          bounds: display.bounds,
          workArea: display.workArea,
          scaleFactor: display.scaleFactor,
          rotation: display.rotation,
          internal: display.internal,
          touchSupport: display.touchSupport
        }
      }
    }
    
    return null
  }

  /**
   * Convert global physical coordinates to display-relative physical coordinates
   */
  static toDisplayRelativePhysical(
    globalPhysicalBounds: Rectangle, 
    display: Display
  ): Rectangle {
    const displayPhysicalBounds = this.toPhysicalPixels(display.bounds, display.scaleFactor)
    
    return {
      x: globalPhysicalBounds.x - displayPhysicalBounds.x,
      y: globalPhysicalBounds.y - displayPhysicalBounds.y,
      width: globalPhysicalBounds.width,
      height: globalPhysicalBounds.height
    }
  }

  /**
   * Convert display-relative physical coordinates to global physical coordinates
   */
  static toGlobalPhysical(
    relativePhysicalBounds: Rectangle,
    display: Display
  ): Rectangle {
    const displayPhysicalBounds = this.toPhysicalPixels(display.bounds, display.scaleFactor)
    
    return {
      x: relativePhysicalBounds.x + displayPhysicalBounds.x,
      y: relativePhysicalBounds.y + displayPhysicalBounds.y,
      width: relativePhysicalBounds.width,
      height: relativePhysicalBounds.height
    }
  }

  /**
   * Debug helper: Log coordinate transformation
   */
  static debugCoordinates(
    label: string,
    logical: Rectangle | null,
    physical: Rectangle | null,
    scaleFactor: number
  ): void {
    console.log(`[Coordinates] ${label}:`)
    if (logical) {
      console.log(`  Logical (DIPs): x=${logical.x}, y=${logical.y}, w=${logical.width}, h=${logical.height}`)
    }
    if (physical) {
      console.log(`  Physical: x=${physical.x}, y=${physical.y}, w=${physical.width}, h=${physical.height}`)
    }
    console.log(`  Scale Factor: ${scaleFactor}`)
  }
}