import type { ImageEditorToolsState } from "../state.image-editor"

import type { TOOL_VALUES } from "@/constants"
import type { ImageEditorToolsActions } from "../state.image-editor"

export interface ImageEditorHeaderProps
  extends Omit<React.ComponentProps<"ul">, "onChange" | "onProgress"> {
  selectedTool: keyof typeof TOOL_VALUES
  toolsValues: typeof TOOL_VALUES
  dispatch: React.Dispatch<ImageEditorToolsActions>
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  onProgress?: (progress: number) => void
  progress?: number
}

export interface ImageEditorFooterProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "onProgress"> {
  image?: File
  operator?: string
  selectedTool: keyof typeof TOOL_VALUES
  toolsValues?: ImageEditorToolsState
  value: number
  label?: (value: number, operator: string) => React.ReactNode
  dispatch: React.Dispatch<ImageEditorToolsActions>
  onSelectedToolChange: (tool: keyof typeof TOOL_VALUES) => void
  onChange?: (value: number) => void
  onProgress?: (progress: number) => void
  progress?: number
}
