import type { ImageEditorToolsState } from "@/lib/state.image-editor"
import type { TOOL_VALUES } from "@/lib/tools"
import type { ImageEditorToolsActions } from "@/lib/state.image-editor"
import type { EditorLayer } from "@/lib/editor/state"

export interface ImageEditorHeaderProps
  extends Omit<React.ComponentProps<"ul">, "onChange" | "onProgress"> {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  drawFnRef: React.RefObject<() => void>
  progress?: number
  selectedTool: keyof typeof TOOL_VALUES
  toolsValues: ImageEditorToolsState
  dispatch: React.Dispatch<ImageEditorToolsActions>
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
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
  selectedTool: keyof typeof TOOL_VALUES
  toolsValues?: ImageEditorToolsState
  value: number | { width: number; height: number }
  label?: (value: number, operator: string) => React.ReactNode
  dispatch: (value: ImageEditorToolsActions | ImageEditorToolsActions[]) => void
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  onChange?: (value: number) => void
  onProgress?: (progress: number) => void
}
