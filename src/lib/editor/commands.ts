import type {
  CanonicalEditorState,
  EditorLayer,
  AdjustmentLayer,
  LayerId,
  ViewportModel,
  ActiveToolModel,
  CanvasPosition,
} from "@/lib/editor/state"
import type { Command, CommandMeta } from "@/lib/editor/history"
import { capitalize } from "@/lib/utils/capitalize"
import { GPU_SECURITY_CONSTANTS } from "@/lib/security/gpu-security"
import { LayerDimensions } from "@/components/canvas.image-editor"

export type SerializedCommand =
  | {
      type: "addLayer"
      meta: CommandMeta
      layer: EditorLayer
      position: "top" | "bottom" | number
    }
  | {
      type: "addAdjustmentLayer"
      meta: CommandMeta
      adjustmentType: string
      parameters: Record<string, number | { value: number; color: string }>
      position: "top" | "bottom" | number
      id?: string
    }
  | { type: "removeLayer"; meta: CommandMeta; layerId: LayerId }
  | {
      type: "reorderLayers"
      meta: CommandMeta
      fromIndex: number
      toIndex: number
    }
  | {
      type: "updateLayer"
      meta: CommandMeta
      layerId: LayerId
      patch: Partial<Omit<EditorLayer, "id">>
    }
  | {
      type: "updateAdjustmentParameters"
      meta: CommandMeta
      layerId: LayerId
      parameters: Record<string, number | { value: number; color: string }>
    }
  | { type: "setSelection"; meta: CommandMeta; selected: LayerId[] }
  | { type: "setViewport"; meta: CommandMeta; patch: Partial<ViewportModel> }
  | { type: "setActiveTool"; meta: CommandMeta; active: ActiveToolModel }
  | {
      type: "documentRotate"
      meta: CommandMeta
      rotation: number
      previousRotations: Record<LayerId, number>
    }
  | {
      type: "documentFlip"
      meta: CommandMeta
      flipHorizontal?: boolean
      flipVertical?: boolean
      previousFlips: Record<
        LayerId,
        { flipHorizontal: boolean; flipVertical: boolean }
      >
    }
  | {
      type: "documentDimensions"
      meta: CommandMeta
      width: number
      height: number
      canvasPosition: CanvasPosition
      layers: Record<LayerId, EditorLayer>
      previousWidth: number
      previousHeight: number
      previousCanvasPosition: CanvasPosition
      previousLayers: Record<LayerId, EditorLayer>
    }

function deepSize(obj: unknown): number {
  try {
    return JSON.stringify(obj).length
  } catch {
    return 256
  }
}

export class AddLayerCommand implements Command {
  meta: CommandMeta
  private readonly layer: EditorLayer
  private readonly position: "top" | "bottom" | number

  constructor(
    layer: EditorLayer,
    position: "top" | "bottom" | number = "top",
    meta?: Partial<CommandMeta>
  ) {
    this.layer = layer
    this.position = position
    this.meta = {
      label: `Add Layer ${layer.name}`,
      scope: "layers",
      timestamp: Date.now(),
      coalescable: false,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    const order = [...state.layers.order]
    if (typeof this.position === "number") {
      const idx = Math.max(0, Math.min(order.length, this.position))
      order.splice(idx, 0, this.layer.id)
    } else if (this.position === "top") {
      order.unshift(this.layer.id)
    } else {
      order.push(this.layer.id)
    }
    const byId = { ...state.layers.byId, [this.layer.id]: this.layer }
    return { ...state, layers: { order, byId } }
  }

  invert(prev: CanonicalEditorState): Command {
    return new RemoveLayerCommand(this.layer.id)
  }

  estimateSize(): number {
    return 128 + deepSize(this.layer)
  }

  serialize(): SerializedCommand {
    return {
      type: "addLayer",
      meta: this.meta,
      layer: this.layer,
      position: this.position,
    }
  }
}

export class RemoveLayerCommand implements Command {
  meta: CommandMeta
  private readonly layerId: LayerId
  private backup?: EditorLayer
  private backupIndex?: number

  constructor(layerId: LayerId, meta?: Partial<CommandMeta>) {
    this.layerId = layerId
    this.meta = {
      label: `Remove Layer`,
      scope: "layers",
      timestamp: Date.now(),
      coalescable: false,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    this.backup = state.layers.byId[this.layerId]
    this.backupIndex = state.layers.order.indexOf(this.layerId)
    const { [this.layerId]: _removed, ...rest } = state.layers.byId
    const order = state.layers.order.filter((id) => id !== this.layerId)
    const selection = state.selection.layerIds.filter(
      (id) => id !== this.layerId
    )
    return {
      ...state,
      layers: { order, byId: rest },
      selection: { layerIds: selection },
    }
  }

  invert(): Command {
    if (!this.backup || this.backupIndex === undefined) {
      throw new Error("Cannot invert RemoveLayerCommand without backup")
    }
    return new AddLayerCommand(this.backup, this.backupIndex)
  }

  estimateSize(): number {
    return 128 + (this.backup ? deepSize(this.backup) : 0)
  }

  serialize(): SerializedCommand {
    return { type: "removeLayer", meta: this.meta, layerId: this.layerId }
  }
}

export class ReorderLayersCommand implements Command {
  meta: CommandMeta
  private readonly fromIndex: number
  private readonly toIndex: number
  private movedId?: LayerId

  constructor(fromIndex: number, toIndex: number, meta?: Partial<CommandMeta>) {
    this.fromIndex = fromIndex
    this.toIndex = toIndex
    this.meta = {
      label: `Reorder Layers`,
      scope: "layers",
      timestamp: Date.now(),
      coalescable: true,
      mergeKey: "reorder:layers",
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    const order = [...state.layers.order]
    if (this.fromIndex < 0 || this.fromIndex >= order.length) return state
    const [id] = order.splice(this.fromIndex, 1)
    this.movedId = id
    const clamped = Math.max(0, Math.min(order.length, this.toIndex))
    order.splice(clamped, 0, id)
    return { ...state, layers: { ...state.layers, order } }
  }

  invert(prev: CanonicalEditorState, next: CanonicalEditorState): Command {
    if (!this.movedId) {
      // compute from states
      const before = prev.layers.order
      const after = next.layers.order
      const id =
        after.find((x, i) => x !== before[i]) || after[after.length - 1]
      const to = before.indexOf(id as string)
      const from = after.indexOf(id as string)
      return new ReorderLayersCommand(from, to)
    }
    const afterOrder = next.layers.order
    const newIndex = afterOrder.indexOf(this.movedId)
    const oldIndex = prev.layers.order.indexOf(this.movedId)
    return new ReorderLayersCommand(newIndex, oldIndex)
  }

  canCoalesceWith(other: Command): boolean {
    return other instanceof ReorderLayersCommand
  }

  coalesceWith(other: Command): Command {
    const o = other as ReorderLayersCommand
    return new ReorderLayersCommand(this.fromIndex, o.toIndex)
  }

  serialize(): SerializedCommand {
    return {
      type: "reorderLayers",
      meta: this.meta,
      fromIndex: this.fromIndex,
      toIndex: this.toIndex,
    }
  }
}

export class UpdateLayerCommand implements Command {
  meta: CommandMeta
  private readonly layerId: LayerId
  private readonly patch: Partial<Omit<EditorLayer, "id">>
  private previous?: Partial<Omit<EditorLayer, "id">>

  constructor(
    layerId: LayerId,
    patch: Partial<Omit<EditorLayer, "id">>,
    meta?: Partial<CommandMeta>
  ) {
    this.layerId = layerId
    this.patch = patch
    this.meta = {
      label: `Update Layer`,
      scope: "layers",
      timestamp: Date.now(),
      coalescable: false,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    const current = state.layers.byId[this.layerId]

    if (!current) return state

    // Store previous values for undo
    const prevSubset: Partial<Omit<EditorLayer, "id">> = {}
    for (const key of Object.keys(this.patch) as (keyof typeof this.patch)[]) {
      if (key in current) {
        // @ts-expect-error index ok
        prevSubset[key] = current[key]
      }
    }
    this.previous = prevSubset

    // Type-safe update - only apply patches that are valid for the current layer type
    const updated: EditorLayer = {
      ...current,
      ...this.patch,
      id: current.id,
    } as EditorLayer

    return {
      ...state,
      layers: {
        ...state.layers,
        byId: { ...state.layers.byId, [this.layerId]: updated },
      },
    }
  }

  invert(): Command {
    return new UpdateLayerCommand(this.layerId, this.previous ?? {})
  }

  estimateSize(): number {
    return 64 + deepSize(this.patch)
  }

  serialize(): SerializedCommand {
    return {
      type: "updateLayer",
      meta: this.meta,
      layerId: this.layerId,
      patch: this.patch,
    }
  }
}

export class SetSelectionCommand implements Command {
  meta: CommandMeta
  private readonly selected: LayerId[]
  private previous?: LayerId[]

  constructor(selected: LayerId[], meta?: Partial<CommandMeta>) {
    this.selected = Array.from(new Set(selected))
    this.meta = {
      label: `Select Layers`,
      scope: "layers",
      timestamp: Date.now(),
      coalescable: false,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    this.previous = state.selection.layerIds
    return { ...state, selection: { layerIds: this.selected } }
  }

  invert(): Command {
    return new SetSelectionCommand(this.previous ?? [])
  }

  serialize(): SerializedCommand {
    return { type: "setSelection", meta: this.meta, selected: this.selected }
  }
}

export class SetViewportCommand implements Command {
  meta: CommandMeta
  private readonly patch: Partial<ViewportModel>
  private previous?: Partial<ViewportModel>

  constructor(patch: Partial<ViewportModel>, meta?: Partial<CommandMeta>) {
    this.patch = patch
    this.meta = {
      label: `Update Viewport`,
      scope: "canvas",
      timestamp: Date.now(),
      coalescable: true,
      mergeKey: Object.prototype.hasOwnProperty.call(patch, "zoom")
        ? "viewport:zoom"
        : "viewport:pan",
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    const prev: Partial<ViewportModel> = {}
    for (const key of Object.keys(this.patch) as (keyof ViewportModel)[]) {
      // @ts-expect-error index ok
      prev[key] = state.viewport[key]
    }
    this.previous = prev
    const viewport: ViewportModel = { ...state.viewport, ...this.patch }
    return { ...state, viewport }
  }

  invert(): Command {
    return new SetViewportCommand(this.previous ?? {})
  }

  serialize(): SerializedCommand {
    return { type: "setViewport", meta: this.meta, patch: this.patch }
  }
}

export class SetActiveToolCommand implements Command {
  meta: CommandMeta
  private readonly nextActive: ActiveToolModel
  private previous?: ActiveToolModel

  constructor(active: ActiveToolModel, meta?: Partial<CommandMeta>) {
    this.nextActive = active
    this.meta = {
      label: `Set Active Tool`,
      scope: "tool",
      timestamp: Date.now(),
      coalescable: false,
      nonUndoable: true,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    this.previous = state.activeTool
    return { ...state, activeTool: this.nextActive }
  }

  invert(): Command {
    return new SetActiveToolCommand(this.previous ?? ({} as ActiveToolModel))
  }

  serialize(): SerializedCommand {
    return { type: "setActiveTool", meta: this.meta, active: this.nextActive }
  }
}

export class AddAdjustmentLayerCommand implements Command {
  meta: CommandMeta
  private readonly adjustmentType: string
  private readonly parameters: Record<
    string,
    number | { value: number; color: string }
  >
  private readonly position: "top" | "bottom" | number
  private readonly providedId?: string
  private createdLayerId?: string

  constructor(
    adjustmentType: string,
    parameters: Record<string, number | { value: number; color: string }>,
    position: "top" | "bottom" | number = "top",
    id?: string,
    meta?: Partial<CommandMeta>
  ) {
    this.adjustmentType = adjustmentType
    this.parameters = parameters
    this.position = position
    this.providedId = id
    this.meta = {
      label: `Add ${adjustmentType} Adjustment`,
      scope: "layers",
      timestamp: Date.now(),
      coalescable: false,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    const newLayer: AdjustmentLayer = {
      id: this.providedId ?? `adjustment-${Date.now()}`,
      name: capitalize(`${this.adjustmentType}`),
      visible: true,
      locked: false,
      opacity: 100,
      blendMode: "normal",
      type: "adjustment",
      adjustmentType: this.adjustmentType as any,
      parameters: this.parameters,
    }

    // Store the created layer ID for undo
    this.createdLayerId = newLayer.id

    // Add to layers collection
    const order = [...state.layers.order]
    if (typeof this.position === "number") {
      const idx = Math.max(0, Math.min(order.length, this.position))
      order.splice(idx, 0, newLayer.id)
    } else if (this.position === "top") {
      order.unshift(newLayer.id)
    } else {
      order.push(newLayer.id)
    }

    const byId = { ...state.layers.byId, [newLayer.id]: newLayer }
    return { ...state, layers: { order, byId } }
  }

  getCreatedLayerId(): string | undefined {
    return this.createdLayerId
  }

  invert(): Command {
    if (!this.createdLayerId) {
      throw new Error(
        "Cannot invert AddAdjustmentLayerCommand without created layer ID"
      )
    }
    return new RemoveLayerCommand(this.createdLayerId)
  }

  estimateSize(): number {
    return 128 + deepSize(this.parameters)
  }

  serialize(): SerializedCommand {
    return {
      type: "addAdjustmentLayer",
      meta: this.meta,
      adjustmentType: this.adjustmentType,
      parameters: this.parameters,
      position: this.position,
      id: this.providedId ?? this.createdLayerId,
    }
  }
}

export class UpdateAdjustmentParametersCommand implements Command {
  meta: CommandMeta
  private readonly layerId: LayerId
  private readonly parameters: Record<
    string,
    number | { value: number; color: string }
  >
  private previous?: Record<string, number | { value: number; color: string }>

  constructor(
    layerId: LayerId,
    parameters: Record<string, number | { value: number; color: string }>,
    meta?: Partial<CommandMeta>
  ) {
    this.layerId = layerId
    this.parameters = parameters
    this.meta = {
      label: `Update Adjustment Parameters`,
      scope: "layers",
      timestamp: Date.now(),
      coalescable: true,
      mergeKey: `adjustment:${layerId}`,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    const layer = state.layers.byId[this.layerId]
    if (!layer || layer.type !== "adjustment") return state

    // Store previous values for undo
    this.previous = { ...layer.parameters }

    const updatedLayer: AdjustmentLayer = {
      ...layer,
      parameters: { ...layer.parameters, ...this.parameters },
    }

    return {
      ...state,
      layers: {
        ...state.layers,
        byId: { ...state.layers.byId, [this.layerId]: updatedLayer },
      },
    }
  }

  invert(): Command {
    if (!this.previous) throw new Error("Cannot invert without previous state")
    return new UpdateAdjustmentParametersCommand(this.layerId, this.previous)
  }

  estimateSize(): number {
    return 64 + deepSize(this.parameters)
  }

  serialize(): SerializedCommand {
    return {
      type: "updateAdjustmentParameters",
      meta: this.meta,
      layerId: this.layerId,
      parameters: this.parameters,
    }
  }
}

export class DocumentRotateCommand implements Command {
  meta: CommandMeta
  private readonly rotation: number
  private readonly previousRotations: Record<LayerId, number>

  constructor(
    rotation: number,
    previousRotations: Record<LayerId, number>,
    meta?: Partial<CommandMeta>
  ) {
    this.rotation = rotation
    this.previousRotations = previousRotations
    this.meta = {
      label: `Rotate Document ${rotation > 0 ? "+" : ""}${rotation}°`,
      scope: "document",
      timestamp: Date.now(),
      coalescable: false,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    const byId = { ...state.layers.byId }

    // Apply rotation to all image layers
    for (const layerId of state.layers.order) {
      const layer = byId[layerId]
      if (layer.type === "image") {
        const imageLayer = layer as any
        const currentRotation = imageLayer.filters?.rotate || 0
        const newRotation = (currentRotation + this.rotation + 360) % 360

        byId[layerId] = {
          ...imageLayer,
          filters: {
            ...imageLayer.filters,
            rotate: newRotation,
          },
        }
      }
    }

    return {
      ...state,
      layers: {
        ...state.layers,
        byId,
      },
    }
  }

  invert(prev: CanonicalEditorState): Command {
    return new DocumentRotateCommand(-this.rotation, this.previousRotations, {
      label: `Undo Rotate Document ${this.rotation > 0 ? "+" : ""}${this.rotation}°`,
      scope: "document",
      timestamp: Date.now(),
      coalescable: false,
    })
  }

  estimateSize(): number {
    return 128 + deepSize(this.rotation) + deepSize(this.previousRotations)
  }

  serialize(): SerializedCommand {
    return {
      type: "documentRotate",
      meta: this.meta,
      rotation: this.rotation,
      previousRotations: this.previousRotations,
    }
  }

  static deserialize(
    data: SerializedCommand & { type: "documentRotate" }
  ): DocumentRotateCommand {
    return new DocumentRotateCommand(
      data.rotation,
      data.previousRotations,
      data.meta
    )
  }
}

export class DocumentFlipCommand implements Command {
  meta: CommandMeta
  private readonly flipHorizontal?: boolean
  private readonly flipVertical?: boolean
  private readonly previousFlips: Record<
    LayerId,
    { flipHorizontal: boolean; flipVertical: boolean }
  >

  constructor(
    opts: { flipHorizontal?: boolean; flipVertical?: boolean },
    previousFlips: Record<
      LayerId,
      { flipHorizontal: boolean; flipVertical: boolean }
    >,
    meta?: Partial<CommandMeta>
  ) {
    this.flipHorizontal = opts.flipHorizontal
    this.flipVertical = opts.flipVertical
    this.previousFlips = previousFlips
    const dir =
      `${opts.flipHorizontal ? "H" : ""}${opts.flipVertical ? " V" : ""}`.trim() ||
      ""
    this.meta = {
      label: `Flip Document${dir ? ` ${dir}` : ""}`,
      scope: "document",
      timestamp: Date.now(),
      coalescable: false,
      ...meta,
    }
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    const byId = { ...state.layers.byId }
    for (const layerId of state.layers.order) {
      const layer = byId[layerId]
      if (layer.type === "image") {
        const imageLayer = layer as any
        const curFH = Boolean(imageLayer.filters?.flipHorizontal)
        const curFV = Boolean(imageLayer.filters?.flipVertical)
        const nextFH = this.flipHorizontal ? !curFH : curFH
        const nextFV = this.flipVertical ? !curFV : curFV
        byId[layerId] = {
          ...imageLayer,
          filters: {
            ...imageLayer.filters,
            flipHorizontal: nextFH,
            flipVertical: nextFV,
          },
        }
      }
      // Mirror state on the document layer so preview uniforms reflect flips when document is selected
      if (layer.type === "document") {
        const docLayer = layer as any
        const curFH = Boolean(docLayer.filters?.flipHorizontal)
        const curFV = Boolean(docLayer.filters?.flipVertical)
        const nextFH = this.flipHorizontal ? !curFH : curFH
        const nextFV = this.flipVertical ? !curFV : curFV
        byId[layerId] = {
          ...docLayer,
          filters: {
            ...docLayer.filters,
            flipHorizontal: nextFH,
            flipVertical: nextFV,
          },
        }
      }
    }

    return {
      ...state,
      layers: {
        ...state.layers,
        byId,
      },
    }
  }

  invert(): Command {
    // Flip is its own inverse: applying the same flips again reverts
    return new DocumentFlipCommand(
      { flipHorizontal: this.flipHorizontal, flipVertical: this.flipVertical },
      this.previousFlips,
      { label: `Undo ${this.meta.label}` }
    )
  }

  estimateSize(): number {
    return 128 + deepSize(this.previousFlips)
  }

  serialize(): SerializedCommand {
    return {
      type: "documentFlip",
      meta: this.meta,
      flipHorizontal: this.flipHorizontal,
      flipVertical: this.flipVertical,
      previousFlips: this.previousFlips,
    }
  }

  static deserialize(
    data: SerializedCommand & { type: "documentFlip" }
  ): DocumentFlipCommand {
    return new DocumentFlipCommand(
      { flipHorizontal: data.flipHorizontal, flipVertical: data.flipVertical },
      data.previousFlips,
      data.meta
    )
  }
}

export class DocumentDimensionsCommand implements Command {
  meta: CommandMeta
  private readonly width: number
  private readonly height: number
  private readonly canvasPosition: CanvasPosition
  private readonly layers: CanonicalEditorState['layers']['byId']
  private previous?: {
    width: number
    height: number
    canvasPosition: CanvasPosition
    layers: CanonicalEditorState['layers']['byId']
  }

  constructor({width, height, canvasPosition, layers, meta, label}:{
    width: number,
    height: number,
    canvasPosition: CanvasPosition,
    layers: CanonicalEditorState['layers']['byId'],
    meta?: Partial<CommandMeta>
    label?: string
  }) {
    // Validate dimensions before creating the command
    const validationError = this.validateDimensions(width, height)
    if (validationError) {
      throw new Error(`Invalid dimensions: ${validationError}`)
    }

    this.width = Math.max(1, Math.floor(width))
    this.height = Math.max(1, Math.floor(height))
    this.canvasPosition = canvasPosition
    this.layers = layers
    
    this.meta = {
      label: label || `Dimensions Document ${this.width}×${this.height} (${canvasPosition})`,
      scope: "document",
      timestamp: Date.now(),
      coalescable: false,
      ...meta,
    }
  }

  private validateDimensions(width: number, height: number): string | null {
    // Basic validation
    if (width <= 0 || height <= 0) {
      return "Dimensions must be positive numbers"
    }

    // Check against GPU security constants - individual dimension limits
    if (
      width > GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE ||
      height > GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE
    ) {
      return `Dimensions exceed maximum texture size (${GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE}px)`
    }

    // Check for reasonable limits to prevent browser crashes
    if (width > 32768 || height > 32768) {
      return "Dimensions are too large and may cause browser instability"
    }

    // Calculate total area and check against reasonable limits
    const totalArea = width * height
    const maxArea =
      GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE *
      GPU_SECURITY_CONSTANTS.MAX_TEXTURE_SIZE

    // Allow up to 90% of the maximum possible area to leave room for other operations
    const maxAllowedArea = Math.floor(maxArea * 0.9)

    if (totalArea > maxAllowedArea) {
      return `Canvas area (${totalArea.toLocaleString()} pixels) exceeds maximum allowed area (${maxAllowedArea.toLocaleString()} pixels)`
    }

    return null
  }

  apply(state: CanonicalEditorState): CanonicalEditorState {
    this.previous = {
      width: state.document.width,
      height: state.document.height,
      canvasPosition: state.document.canvasPosition,
      layers: state.layers.byId,
    }

    return {
      ...state,
      layers: {
        ...state.layers,
        byId: {
          ...state.layers.byId,
          ...this.layers,
        },
      },
      document: {
        ...state.document,
        width: this.width,
        height: this.height,
        canvasPosition: this.canvasPosition,
      },
    }
  }

  invert(): Command {
    const prevW = this.previous?.width ?? 1
    const prevH = this.previous?.height ?? 1
    const prevPosition = this.previous?.canvasPosition ?? "centerCenter"
    return new DocumentDimensionsCommand({
      width: prevW,
      height: prevH,
      canvasPosition: prevPosition,
      layers: this.previous?.layers ?? {},
      label: `Undo Dimensions Document to ${prevW}×${prevH} (${prevPosition})`,
    })
  }

  estimateSize(): number {
    // Rough estimate for width/height numbers + canvas position
    return 96
  }

  serialize(): SerializedCommand {
    return {
      type: "documentDimensions",
      meta: this.meta,
      width: this.width,
      height: this.height,
      layers: this.layers,
      canvasPosition: this.canvasPosition,
      previousWidth: this.previous?.width ?? 0,
      previousHeight: this.previous?.height ?? 0,
      previousCanvasPosition: this.previous?.canvasPosition ?? "centerCenter",
      previousLayers: this.previous?.layers ?? {},
    }
  }

  static deserialize(
    data: SerializedCommand & { type: "documentDimensions" }
  ): DocumentDimensionsCommand {
    return new DocumentDimensionsCommand({
      width: data.width,
      height: data.height,
      canvasPosition: data.canvasPosition,
      layers: data.layers,
      meta: data.meta,
    })
  }
}

export function deserializeCommand(json: SerializedCommand): Command {
  switch (json.type) {
    case "addLayer":
      return new AddLayerCommand(json.layer, json.position, json.meta)
    case "addAdjustmentLayer":
      return new AddAdjustmentLayerCommand(
        json.adjustmentType,
        json.parameters,
        json.position,
        json.id,
        json.meta
      )
    case "removeLayer":
      return new RemoveLayerCommand(json.layerId, json.meta)
    case "reorderLayers":
      return new ReorderLayersCommand(json.fromIndex, json.toIndex, json.meta)
    case "updateLayer":
      return new UpdateLayerCommand(json.layerId, json.patch, json.meta)
    case "updateAdjustmentParameters":
      return new UpdateAdjustmentParametersCommand(
        json.layerId,
        json.parameters,
        json.meta
      )
    case "setSelection":
      return new SetSelectionCommand(json.selected, json.meta)
    case "setViewport":
      return new SetViewportCommand(json.patch, json.meta)
    case "setActiveTool":
      return new SetActiveToolCommand(json.active, json.meta)
    case "documentRotate":
      return DocumentRotateCommand.deserialize(json)
    case "documentFlip":
      return DocumentFlipCommand.deserialize(json)
    case "documentDimensions":
      return DocumentDimensionsCommand.deserialize(json)
    default:
      throw new Error(`Unknown command type ${(json as any).type}`)
  }
}
