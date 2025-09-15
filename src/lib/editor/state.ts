/**
 * EditorState schema and invariants (canonical vs ephemeral)
 *
 * This module defines the canonical source-of-truth state for the image editor
 * and a separate ephemeral interaction state. It includes runtime invariant
 * checks and narrow, typed helper functions that preserve those invariants.
 *
 * Note: No external schema library (e.g., zod) is used. Validation is
 * implemented via explicit runtime guards and strongly typed APIs.
 */

import type { BlendMode } from "@/lib/shaders/blend-modes/types.blend"
import type {
  ImageEditorToolsState,
  SIDEBAR_TOOLS,
} from "@/lib/tools/tools-state"
import type { TOOL_VALUES } from "@/lib/tools/tools"
import type { AdjustmentTypes } from "./types.adjustment"

/**
 * Canonical types
 */

export type LayerId = string

// New layer type system
export type LayerType =
  | "image"
  | "adjustment"
  | "group"
  | "solid"
  | "document"
  | "mask"

// Base layer properties shared by all layer types
export interface BaseLayer {
  id: LayerId
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  type: LayerType
  parentGroupId?: string
}

// Document layer

// Image layer with embedded filters (current system)
export interface ImageLayer extends BaseLayer {
  type: "image"
  image?: File | null
  isEmpty: boolean
  filters: ImageEditorToolsState
}

// Adjustment layer
export interface AdjustmentLayer extends BaseLayer {
  type: "adjustment"
  adjustmentType: AdjustmentTypes
  parameters: Record<string, number | { value: number; color: string }>
}

// Solid color layer
export interface SolidLayer extends BaseLayer {
  type: "solid"
  color: [number, number, number, number] // RGBA
}

// Document layer for global document properties
export interface DocumentLayer extends BaseLayer {
  type: "document"
  filters: ImageEditorToolsState
}

// Mask data for adjustment layers
export interface MaskLayer extends BaseLayer {
  type: "mask"
  enabled: boolean
  inverted: boolean
  // TODO: Add actual mask texture/path data
}

// Union type for all layer types
export type BaseEditorLayer =
  | ImageLayer
  | AdjustmentLayer
  | SolidLayer
  | DocumentLayer
  | MaskLayer

// Group layer for organizing layers
export interface GroupLayer extends BaseLayer {
  type: "group"
  children: BaseEditorLayer[]
  collapsed: boolean
}

// Union type for all layer types
export type EditorLayer = BaseEditorLayer | GroupLayer

/**
 * Layers collection uses an order array for deterministic z-order and a map
 * for O(1) lookups. The order's head is the top-most layer.
 */
export interface LayersModel {
  order: LayerId[]
  byId: Record<LayerId, EditorLayer>
}

export type CanvasPosition =
  | "topLeft"
  | "topCenter"
  | "topRight"
  | "centerLeft"
  | "centerCenter"
  | "centerRight"
  | "bottomLeft"
  | "bottomCenter"
  | "bottomRight"

export interface DocumentMetadata {
  width: number
  height: number
  canvasPosition: CanvasPosition
  /** Background description; transparent or a solid color */
  background:
    | { type: "transparent" }
    | { type: "color"; rgba: [number, number, number, number] }
  /** Optional color profile descriptor */
  colorProfile?: "srgb" | "display-p3" | "adobe-rgb" | string
  /** Optional DPI/PPI metadata */
  dpi?: number
  /** Global layers applied to the entire document (like adjustment layers but document-wide) */
  globalLayers: (AdjustmentLayer | SolidLayer | MaskLayer)[]
  /** Global document parameters for tool filters (applied to all layers) */
  globalParameters: Record<string, number | { value: number; color: string }>
}

export interface SelectionModel {
  /** Selected layer IDs; empty means no selection. */
  layerIds: LayerId[]
}

export interface ViewportModel {
  /** Zoom percentage (e.g., 100 = 100%). */
  zoom: number
  /** Canvas pan offsets in CSS pixels of the viewport. */
  panX: number
  panY: number
  /** Viewport rotation in degrees (0-359). */
  rotation: number
  /** Feature toggles */
  snappingEnabled: boolean
  guidesVisible: boolean
}

export interface ActiveToolModel {
  /** Currently selected sidebar (transform, effects, etc.). */
  sidebar: keyof typeof SIDEBAR_TOOLS
  /** Currently selected tool within the sidebar. */
  tool: keyof typeof TOOL_VALUES
}

/**
 * Canonical editor state. This is the single source of truth the renderer
 * reads from. No transient UI/interaction state lives here.
 */
export interface CanonicalEditorState {
  document: DocumentMetadata
  layers: LayersModel
  selection: SelectionModel
  viewport: ViewportModel
  activeTool: ActiveToolModel
}

/**
 * Ephemeral interaction state that should not participate in undo/redo.
 * This includes pointer drags, marquee previews, hover, and in-flight
 * transactions prior to commit.
 */
export interface EphemeralEditorState {
  interaction: {
    isDragging: boolean
    dragLayerId?: LayerId
    dragStart?: { x: number; y: number }
    hoverLayerId?: LayerId
    marquee?: { x: number; y: number; width: number; height: number }
  }
  transaction: {
    /** True while a tool interaction is accumulating changes prior to commit */
    active: boolean
    /** Optional user-friendly label for the pending transaction */
    name?: string
    /** Epoch millis of when the transaction began */
    startedAt?: number
  }
  preview?: {
    active: boolean
    layerId?: LayerId
    filters?: Partial<import("@/lib/tools/tools-state").ImageEditorToolsState>
  }
}

/**
 * Combined runtime container that holds both canonical and ephemeral state.
 * Consumers can store this in a context/provider. History operates on
 * canonical only; ephemeral is reset or ignored across do/undo.
 */
export interface EditorRuntimeState {
  canonical: CanonicalEditorState
  ephemeral: EphemeralEditorState
}

/**
 * Defaults and constraints
 */

export const VIEWPORT = {
  MIN_ZOOM: 5, // percent
  MAX_ZOOM: 800, // percent
} as const

/**
 * Factory helpers
 */

export function createEmptyLayers(): LayersModel {
  return { order: [], byId: {} }
}

export function createDefaultDocument(
  width = 800,
  height = 600
): DocumentMetadata {
  return {
    width,
    height,
    canvasPosition: "centerCenter",
    background: { type: "transparent" },
    colorProfile: "srgb",
    dpi: 72,
    globalLayers: [],
    globalParameters: {},
  }
}

export function createDefaultViewport(): ViewportModel {
  return {
    zoom: 100,
    panX: 0,
    panY: 0,
    rotation: 0,
    snappingEnabled: true,
    guidesVisible: false,
  }
}

export function createDefaultSelection(): SelectionModel {
  return { layerIds: [] }
}

export function createDefaultActiveTool(
  sidebar: keyof typeof SIDEBAR_TOOLS,
  tool: keyof typeof TOOL_VALUES
): ActiveToolModel {
  return { sidebar, tool }
}

export function createEphemeralState(): EphemeralEditorState {
  return {
    interaction: { isDragging: false },
    transaction: { active: false },
    preview: { active: false },
  }
}

export function createEditorRuntimeState(params?: {
  document?: Partial<DocumentMetadata>
  layers?: LayersModel
  selection?: SelectionModel
  viewport?: Partial<ViewportModel>
  activeTool?: Partial<ActiveToolModel> & {
    sidebar: keyof typeof SIDEBAR_TOOLS
    tool: keyof typeof TOOL_VALUES
  }
}): EditorRuntimeState {
  const document = { ...createDefaultDocument(), ...(params?.document ?? {}) }
  const layers = params?.layers ?? createEmptyLayers()
  const selection = params?.selection ?? createDefaultSelection()
  const viewport = { ...createDefaultViewport(), ...(params?.viewport ?? {}) }
  const activeTool = params?.activeTool
    ? ({ ...params.activeTool } as ActiveToolModel)
    : createDefaultActiveTool(
        "transform" as keyof typeof SIDEBAR_TOOLS,
        "rotate" as keyof typeof TOOL_VALUES
      )

  const canonical: CanonicalEditorState = {
    document,
    layers,
    selection,
    viewport,
    activeTool,
  }

  const runtime: EditorRuntimeState = {
    canonical,
    ephemeral: createEphemeralState(),
  }

  const result = validateEditorState(runtime.canonical)
  if (!result.ok) {
    // Throw early for programmer errors at construction time
    throw new Error(
      `Invalid initial EditorState: ${result.errors.map((e) => e.message).join("; ")}`
    )
  }

  return runtime
}

/**
 * Invariant validation
 */

export interface ValidationIssue {
  path: string
  message: string
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationIssue[]
}

export function validateEditorState(
  state: CanonicalEditorState
): ValidationResult {
  const errors: ValidationIssue[] = []

  // Document
  if (!Number.isFinite(state.document.width) || state.document.width <= 0) {
    errors.push({
      path: "document.width",
      message: "Width must be a positive number",
    })
  }
  if (!Number.isFinite(state.document.height) || state.document.height <= 0) {
    errors.push({
      path: "document.height",
      message: "Height must be a positive number",
    })
  }
  if (state.document.background.type === "color") {
    const rgba = state.document.background.rgba
    const valid =
      rgba.length === 4 &&
      rgba.every((v) => Number.isFinite(v) && v >= 0 && v <= 1)
    if (!valid) {
      errors.push({
        path: "document.background.rgba",
        message: "RGBA must be 4 numbers in [0,1]",
      })
    }
  }

  // Layers: unique IDs, order alignment, property ranges
  const { order, byId } = state.layers
  const idSet = new Set<string>()
  for (const id of order) {
    if (idSet.has(id)) {
      errors.push({
        path: "layers.order",
        message: `Duplicate layer id in order: ${id}`,
      })
    }
    idSet.add(id)
    if (!byId[id]) {
      errors.push({
        path: `layers.byId.${id}`,
        message: "Layer id in order must exist in byId",
      })
    }
  }
  for (const id of Object.keys(byId)) {
    if (!idSet.has(id)) {
      errors.push({
        path: `layers.byId.${id}`,
        message: "Layer exists in byId but not in order",
      })
    }
  }

  for (const id of order) {
    const layer = byId[id]
    if (!layer) continue
    if (layer.id !== id) {
      errors.push({
        path: `layers.byId.${id}.id`,
        message: "Layer.id must match its key",
      })
    }
    if (typeof layer.name !== "string" || layer.name.length === 0) {
      errors.push({
        path: `layers.byId.${id}.name`,
        message: "Layer.name must be a non-empty string",
      })
    }
    if (
      !Number.isFinite(layer.opacity) ||
      layer.opacity < 0 ||
      layer.opacity > 100
    ) {
      errors.push({
        path: `layers.byId.${id}.opacity`,
        message: "Opacity must be in [0,100]",
      })
    }

    // Type-specific validation
    if (layer.type === "image") {
      if (layer.isEmpty && layer.image) {
        errors.push({
          path: `layers.byId.${id}.isEmpty`,
          message: "Empty image layer must not have an image",
        })
      }
    } else if (layer.type === "adjustment") {
      // Validate adjustment layer parameters
      if (!layer.parameters || Object.keys(layer.parameters).length === 0) {
        errors.push({
          path: `layers.byId.${id}.parameters`,
          message: "Adjustment layer must have parameters",
        })
      }
    } else if (layer.type === "group") {
      // Validate group layer children
      if (!Array.isArray(layer.children)) {
        errors.push({
          path: `layers.byId.${id}.children`,
          message: "Group layer must have children array",
        })
      }
    } else if (layer.type === "solid") {
      // Validate solid color layer
      if (!Array.isArray(layer.color) || layer.color.length !== 4) {
        errors.push({
          path: `layers.byId.${id}.color`,
          message: "Solid layer must have RGBA color array",
        })
      }
    }
  }

  // Selection subset of layers
  for (const selId of state.selection.layerIds) {
    if (!idSet.has(selId)) {
      errors.push({
        path: "selection.layerIds",
        message: `Selection id not in layers: ${selId}`,
      })
    }
  }

  // Viewport ranges
  if (
    !Number.isFinite(state.viewport.zoom) ||
    state.viewport.zoom < VIEWPORT.MIN_ZOOM ||
    state.viewport.zoom > VIEWPORT.MAX_ZOOM
  ) {
    errors.push({
      path: "viewport.zoom",
      message: `Zoom must be within [${VIEWPORT.MIN_ZOOM}, ${VIEWPORT.MAX_ZOOM}]`,
    })
  }
  if (!Number.isFinite(state.viewport.panX)) {
    errors.push({
      path: "viewport.panX",
      message: "panX must be a finite number",
    })
  }
  if (!Number.isFinite(state.viewport.panY)) {
    errors.push({
      path: "viewport.panY",
      message: "panY must be a finite number",
    })
  }
  if (
    !Number.isFinite((state.viewport as any).rotation) ||
    (state.viewport as any).rotation < 0 ||
    (state.viewport as any).rotation >= 360
  ) {
    errors.push({
      path: "viewport.rotation",
      message: "rotation must be a finite number in [0, 360)",
    })
  }

  return { ok: errors.length === 0, errors }
}

export function assertInvariants(state: CanonicalEditorState): void {
  const result = validateEditorState(state)
  if (!result.ok) {
    const details = result.errors
      .map((e) => `${e.path}: ${e.message}`)
      .join("\n")
    throw new Error(`EditorState invariant violation:\n${details}`)
  }
}

/**
 * Mutation helpers (pure, return new state) that preserve invariants.
 */

export function addLayer(
  state: CanonicalEditorState,
  layer: EditorLayer,
  position: "top" | "bottom" | number = "top"
): CanonicalEditorState {
  const next: CanonicalEditorState = {
    ...state,
    layers: {
      order: [...state.layers.order],
      byId: { ...state.layers.byId, [layer.id]: layer },
    },
  }

  if (typeof position === "number") {
    const clamped = Math.max(0, Math.min(next.layers.order.length, position))
    next.layers.order.splice(clamped, 0, layer.id)
  } else if (position === "top") {
    next.layers.order.unshift(layer.id)
  } else {
    next.layers.order.push(layer.id)
  }

  assertInvariants(next)
  return next
}

export function removeLayer(
  state: CanonicalEditorState,
  layerId: LayerId
): CanonicalEditorState {
  if (!state.layers.byId[layerId]) return state
  const { [layerId]: _removed, ...rest } = state.layers.byId
  const next: CanonicalEditorState = {
    ...state,
    layers: {
      order: state.layers.order.filter((id) => id !== layerId),
      byId: rest,
    },
    selection: {
      layerIds: state.selection.layerIds.filter((id) => id !== layerId),
    },
  }
  assertInvariants(next)
  return next
}

export function reorderLayer(
  state: CanonicalEditorState,
  fromIndex: number,
  toIndex: number
): CanonicalEditorState {
  const order = [...state.layers.order]
  if (fromIndex < 0 || fromIndex >= order.length) return state
  const [id] = order.splice(fromIndex, 1)
  const clamped = Math.max(0, Math.min(order.length, toIndex))
  order.splice(clamped, 0, id)
  const next: CanonicalEditorState = {
    ...state,
    layers: { ...state.layers, order },
  }
  assertInvariants(next)
  return next
}

export function setSelection(
  state: CanonicalEditorState,
  layerIds: LayerId[]
): CanonicalEditorState {
  const unique = Array.from(new Set(layerIds))
  const next: CanonicalEditorState = {
    ...state,
    selection: { layerIds: unique },
  }
  assertInvariants(next)
  return next
}

export function updateLayer(
  state: CanonicalEditorState,
  layerId: LayerId,
  update: Partial<Omit<EditorLayer, "id">>
): CanonicalEditorState {
  const current = state.layers.byId[layerId]

  if (!current) return state

  // Type-safe update - only allow updates that match the current layer type
  const nextLayer: EditorLayer = {
    ...current,
    ...update,
    id: current.id,
  } as EditorLayer

  const next: CanonicalEditorState = {
    ...state,
    layers: {
      ...state.layers,
      byId: { ...state.layers.byId, [layerId]: nextLayer },
    },
  }
  assertInvariants(next)
  return next
}

export function setViewport(
  state: CanonicalEditorState,
  viewport: Partial<ViewportModel>
): CanonicalEditorState {
  const nextViewport: ViewportModel = { ...state.viewport, ...viewport }
  const next: CanonicalEditorState = { ...state, viewport: nextViewport }
  assertInvariants(next)
  return next
}

/**
 * Global document layer management functions
 */

export function addGlobalLayer(
  state: CanonicalEditorState,
  layer: AdjustmentLayer | SolidLayer | MaskLayer,
  position: "top" | "bottom" | number = "top"
): CanonicalEditorState {
  const currentGlobalLayers = [...state.document.globalLayers]

  if (typeof position === "number") {
    const clamped = Math.max(0, Math.min(currentGlobalLayers.length, position))
    currentGlobalLayers.splice(clamped, 0, layer)
  } else if (position === "top") {
    currentGlobalLayers.unshift(layer)
  } else {
    currentGlobalLayers.push(layer)
  }

  const next: CanonicalEditorState = {
    ...state,
    document: {
      ...state.document,
      globalLayers: currentGlobalLayers,
    },
  }
  assertInvariants(next)
  return next
}

export function removeGlobalLayer(
  state: CanonicalEditorState,
  layerId: LayerId
): CanonicalEditorState {
  const next: CanonicalEditorState = {
    ...state,
    document: {
      ...state.document,
      globalLayers: state.document.globalLayers.filter(
        (layer) => layer.id !== layerId
      ),
    },
  }
  assertInvariants(next)
  return next
}

export function updateGlobalLayer(
  state: CanonicalEditorState,
  layerId: LayerId,
  update: Partial<Omit<AdjustmentLayer | SolidLayer | MaskLayer, "id">>
): CanonicalEditorState {
  const currentGlobalLayers = [...state.document.globalLayers]
  const layerIndex = currentGlobalLayers.findIndex(
    (layer) => layer.id === layerId
  )

  if (layerIndex === -1) return state

  const currentLayer = currentGlobalLayers[layerIndex]
  const nextLayer = {
    ...currentLayer,
    ...update,
    id: currentLayer.id,
  } as AdjustmentLayer | SolidLayer | MaskLayer

  currentGlobalLayers[layerIndex] = nextLayer

  const next: CanonicalEditorState = {
    ...state,
    document: {
      ...state.document,
      globalLayers: currentGlobalLayers,
    },
  }
  assertInvariants(next)
  return next
}

export function reorderGlobalLayer(
  state: CanonicalEditorState,
  fromIndex: number,
  toIndex: number
): CanonicalEditorState {
  const globalLayers = [...state.document.globalLayers]
  if (fromIndex < 0 || fromIndex >= globalLayers.length) return state

  const [layer] = globalLayers.splice(fromIndex, 1)
  const clamped = Math.max(0, Math.min(globalLayers.length, toIndex))
  globalLayers.splice(clamped, 0, layer)

  const next: CanonicalEditorState = {
    ...state,
    document: {
      ...state.document,
      globalLayers,
    },
  }
  assertInvariants(next)
  return next
}

/**
 * Global document parameters management functions
 */

export function setGlobalParameters(
  state: CanonicalEditorState,
  parameters: Record<string, number | { value: number; color: string }>
): CanonicalEditorState {
  const next: CanonicalEditorState = {
    ...state,
    document: {
      ...state.document,
      globalParameters: { ...state.document.globalParameters, ...parameters },
    },
  }
  assertInvariants(next)
  return next
}

export function updateGlobalParameter(
  state: CanonicalEditorState,
  key: string,
  value: number | { value: number; color: string }
): CanonicalEditorState {
  const next: CanonicalEditorState = {
    ...state,
    document: {
      ...state.document,
      globalParameters: {
        ...state.document.globalParameters,
        [key]: value,
      },
    },
  }
  assertInvariants(next)
  return next
}

export function removeGlobalParameter(
  state: CanonicalEditorState,
  key: string
): CanonicalEditorState {
  const { [key]: _removed, ...rest } = state.document.globalParameters
  const next: CanonicalEditorState = {
    ...state,
    document: {
      ...state.document,
      globalParameters: rest,
    },
  }
  assertInvariants(next)
  return next
}

/**
 * Utility to convert a flat array of layers (e.g., from existing components)
 * to the normalized LayersModel structure.
 */
export function normalizeLayers(layers: EditorLayer[]): LayersModel {
  const order: LayerId[] = []
  const byId: Record<LayerId, EditorLayer> = {}
  for (const layer of layers) {
    order.push(layer.id)
    byId[layer.id] = layer
  }
  return { order, byId }
}
