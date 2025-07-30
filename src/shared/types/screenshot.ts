export interface Display {
  id: string
  name: string
  bounds: Rectangle
  workArea: Rectangle
  scaleFactor: number
  rotation: number
  internal: boolean
  touchSupport: 'available' | 'unavailable' | 'unknown'
}

export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface CaptureOptions {
  types?: Array<'window' | 'screen'>
  thumbnailSize?: {
    width: number
    height: number
  }
  fetchWindowIcons?: boolean
}

export interface CaptureSource {
  id: string
  name: string
  displayId: string
  thumbnail: any // NativeImage from Electron
  appIcon?: any // NativeImage from Electron
}

export interface ScreenshotOptions {
  displayId?: string
  bounds?: Rectangle
  format?: 'png' | 'jpg'
  quality?: number
}

export interface ScreenshotData {
  buffer: Buffer
  width: number
  height: number
  displayId: string
  scaleFactor: number
  timestamp: number
}

export interface SelectionState {
  isSelecting: boolean
  startPoint: Point | null
  endPoint: Point | null
  currentBounds: Rectangle | null
}

export interface OverlayWindowOptions {
  display: Display
  onSelectionComplete?: (bounds: Rectangle) => void
  onCancel?: () => void
}

export interface MagnifierConfig {
  zoom: number
  size: number
  crosshairColor: string
  borderColor: string
}

export interface WindowInfo {
  id: number
  bounds: Rectangle
  title: string
  ownerName: string
}

export const ScreenshotMode = {
  FULLSCREEN: 'fullscreen',
  REGION: 'region',
  WINDOW: 'window'
} as const

export type ScreenshotMode = typeof ScreenshotMode[keyof typeof ScreenshotMode]

export interface ScreenshotResult {
  success: boolean
  data?: ScreenshotData
  error?: string
}