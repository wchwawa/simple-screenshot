export interface EditorState {
  mode: EditorMode
  selectedTool: EditorTool
  history: EditorAction[]
  historyIndex: number
  canvas: {
    width: number
    height: number
    scaleFactor: number
  }
}

export enum EditorMode {
  IDLE = 'idle',
  EDITING = 'editing',
  PROCESSING = 'processing'
}

export enum EditorTool {
  NONE = 'none',
  BRUSH = 'brush',
  TEXT = 'text',
  MOSAIC = 'mosaic'
}

export interface EditorAction {
  id: string
  tool: EditorTool
  timestamp: number
  data: BrushAction | TextAction | MosaicAction
}

export interface BrushAction {
  type: 'brush'
  color: string
  width: number
  points: Array<{ x: number; y: number }>
}

export interface TextAction {
  type: 'text'
  color: string
  fontSize: number
  fontFamily: string
  text: string
  position: { x: number; y: number }
  bounds: { width: number; height: number }
}

export interface MosaicAction {
  type: 'mosaic'
  intensity: number
  bounds: { x: number; y: number; width: number; height: number }
}

export interface BrushSettings {
  color: string
  width: number
}

export interface TextSettings {
  color: string
  fontSize: number
  fontFamily: string
}

export interface MosaicSettings {
  intensity: number
}

export interface EditorToolSettings {
  brush: BrushSettings
  text: TextSettings
  mosaic: MosaicSettings
}

export interface EditingBarPosition {
  x: number
  y: number
}

export interface EditorResult {
  success: boolean
  buffer?: Buffer
  error?: string
}