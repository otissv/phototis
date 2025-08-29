import { TOOL_VALUES } from "@/lib/tools/tools"
import { onToolControlValueChange } from "@/lib/utils"
import SlidingTrack from "@/components/sliding-track"

export interface ImageEditorFooterSliderProps
  extends Omit<
    React.ComponentProps<"div">,
    "onChange" | "value" | "onDragEnd" | "onDragStart" | "onProgress"
  > {
  isDecimal?: boolean
  operator?: string
  progress?: number
  selectedTool: keyof typeof TOOL_VALUES
  value: number
  label?: (value: string, operator: string) => React.ReactNode
  onChange?: (value: number) => void
  onDragEnd?: (value: number) => void
  onDragStart?: (value: number) => void
  onProgress?: (progress: number) => void
}

export function ImageEditorFooterSlider({
  className,
  operator,
  selectedTool,
  value,
  label,
  onChange,
  progress,
  onDragEnd,
  onDragStart,
  isDecimal,
}: ImageEditorFooterSliderProps) {
  const disabled = Boolean(progress)

  return (
    <SlidingTrack
      title={selectedTool}
      className={className}
      min={
        "min" in TOOL_VALUES[selectedTool] ? TOOL_VALUES[selectedTool].min : 0
      }
      max={
        "max" in TOOL_VALUES[selectedTool] ? TOOL_VALUES[selectedTool].max : 0
      }
      step={
        "step" in TOOL_VALUES[selectedTool] ? TOOL_VALUES[selectedTool].step : 0
      }
      defaultValue={value}
      operator={operator}
      onValueChange={onToolControlValueChange({
        selectedTool,
        onChange: onChange || (() => {}),
      })}
      label={label}
      isDecimal={isDecimal}
      disabled={disabled}
      onDragEnd={(v) => {
        try {
          onDragEnd?.(v)
        } catch {}
      }}
      onDragStart={(v) => {
        try {
          onDragStart?.(v)
        } catch {}
      }}
    />
  )
}
ImageEditorFooterSlider.displayName = "ImageEditorFooterSlider"
