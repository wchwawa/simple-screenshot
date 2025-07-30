import { screen } from 'electron'
import type { Display, Rectangle } from '../../shared/types/screenshot'

export class DisplayManager {
  private displays: Map<string, Display> = new Map()
  private initialized = false

  constructor() {
    // Don't initialize in constructor - will be initialized when first used
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.refreshDisplays()
      screen.on('display-added', () => this.refreshDisplays())
      screen.on('display-removed', () => this.refreshDisplays())
      screen.on('display-metrics-changed', () => this.refreshDisplays())
      this.initialized = true
    }
  }

  private refreshDisplays(): void {
    this.displays.clear()
    const electronDisplays = screen.getAllDisplays()
    
    electronDisplays.forEach(display => {
      this.displays.set(display.id.toString(), {
        id: display.id.toString(),
        name: `Display ${display.id}`,
        bounds: display.bounds,
        workArea: display.workArea,
        scaleFactor: display.scaleFactor,
        rotation: display.rotation,
        internal: display.internal,
        touchSupport: display.touchSupport
      })
    })
  }

  getAllDisplays(): Display[] {
    this.ensureInitialized()
    return Array.from(this.displays.values())
  }

  getDisplay(id: string): Display | undefined {
    this.ensureInitialized()
    return this.displays.get(id)
  }

  getPrimaryDisplay(): Display {
    this.ensureInitialized()
    const primary = screen.getPrimaryDisplay()
    return this.getDisplay(primary.id.toString()) || this.getAllDisplays()[0]
  }

  getDisplayAtPoint(x: number, y: number): Display | undefined {
    this.ensureInitialized()
    const electronDisplay = screen.getDisplayNearestPoint({ x, y })
    return this.getDisplay(electronDisplay.id.toString())
  }

  getTotalBounds(): Rectangle {
    this.ensureInitialized()
    const displays = this.getAllDisplays()
    if (displays.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    displays.forEach(display => {
      minX = Math.min(minX, display.bounds.x)
      minY = Math.min(minY, display.bounds.y)
      maxX = Math.max(maxX, display.bounds.x + display.bounds.width)
      maxY = Math.max(maxY, display.bounds.y + display.bounds.height)
    })

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  normalizeCoordinates(x: number, y: number, fromDisplayId?: string): { x: number; y: number } {
    if (!fromDisplayId) {
      return { x, y }
    }

    const display = this.getDisplay(fromDisplayId)
    if (!display) {
      return { x, y }
    }

    return {
      x: x + display.bounds.x,
      y: y + display.bounds.y
    }
  }

  convertToDisplayCoordinates(
    globalX: number,
    globalY: number,
    targetDisplayId: string
  ): { x: number; y: number } | null {
    const display = this.getDisplay(targetDisplayId)
    if (!display) {
      return null
    }

    return {
      x: globalX - display.bounds.x,
      y: globalY - display.bounds.y
    }
  }
}