import type { ImageEditorToolsState } from "@/lib/tools/tools-state"
import type { SIDEBAR_TOOLS } from "@/lib/tools/tools-state"
import type { ImageEditorToolsActions } from "@/lib/tools/tools-state"
import type { EditorLayer } from "@/lib/editor/state"

export interface ImageEditorHeaderProps
  extends Omit<React.ComponentProps<"ul">, "onChange" | "onProgress"> {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  drawFnRef: React.RefObject<() => void>
  progress?: number
  selectedTool: keyof typeof SIDEBAR_TOOLS
  toolsValues: ImageEditorToolsState
  dispatch: React.Dispatch<ImageEditorToolsActions>
  onSelectedToolChange: (tool: keyof typeof SIDEBAR_TOOLS) => void
  onProgress?: (progress: number) => void
}

export interface ImageEditorFooterProps
  extends Omit<
    React.ComponentProps<"div">,
    "onChange" | "onProgress" | "value"
  > {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  drawFnRef: React.RefObject<() => void>
  operator?: string
  progress?: number
  selectedLayer: EditorLayer | null
  selectedTool: keyof typeof SIDEBAR_TOOLS
  toolsValues: ImageEditorToolsState
  value: number | { width: number; height: number }
  label?: (value: number, operator: string) => React.ReactNode
  dispatch: (value: ImageEditorToolsActions | ImageEditorToolsActions[]) => void
  onProgress?: (progress: number) => void
  onSelectedToolChange: (tool: keyof typeof SIDEBAR_TOOLS) => void
}
