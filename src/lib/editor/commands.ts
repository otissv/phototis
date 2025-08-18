import type {
  CanonicalEditorState,
  EditorLayer,
  ImageLayer,
  AdjustmentLayer,
  LayerId,
  ViewportModel,
  ActiveToolModel,
} from "@/lib/editor/state"
import type { Command, CommandMeta } from "@/lib/editor/history"
import { capitalize } from "../capitalize"

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
      parameters: Record<string, number>
      position: "top" | "bottom" | number
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
      parameters: Record<string, number>
    }
  | { type: "setSelection"; meta: CommandMeta; selected: LayerId[] }
  | { type: "setViewport"; meta: CommandMeta; patch: Partial<ViewportModel> }
  | { type: "setActiveTool"; meta: CommandMeta; active: ActiveToolModel }

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
  private readonly parameters: Record<string, number>
  private readonly position: "top" | "bottom" | number
  private createdLayerId?: string

  constructor(
    adjustmentType: string,
    parameters: Record<string, number>,
    position: "top" | "bottom" | number = "top",
    meta?: Partial<CommandMeta>
  ) {
    this.adjustmentType = adjustmentType
    this.parameters = parameters
    this.position = position
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
      id: `adjustment-${Date.now()}`,
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
    }
  }
}

export class UpdateAdjustmentParametersCommand implements Command {
  meta: CommandMeta
  private readonly layerId: LayerId
  private readonly parameters: Record<string, number>
  private previous?: Record<string, number>

  constructor(
    layerId: LayerId,
    parameters: Record<string, number>,
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

export function deserializeCommand(json: SerializedCommand): Command {
  switch (json.type) {
    case "addLayer":
      return new AddLayerCommand(json.layer, json.position, json.meta)
    case "addAdjustmentLayer":
      return new AddAdjustmentLayerCommand(
        json.adjustmentType,
        json.parameters,
        json.position,
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
    default:
      throw new Error(`Unknown command type ${(json as any).type}`)
  }
}
