"use client"

import React from "react"

import type {
  EditorRuntimeState,
  CanonicalEditorState,
  EditorLayer,
  ImageLayer,
  LayerId,
  ActiveToolModel,
  EphemeralEditorState,
  DocumentLayer,
  CanvasPosition,
  AdjustmentLayer,
  MaskLayer,
  SolidLayer,
} from "@/lib/editor/state"
import {
  normalizeLayers,
  createEditorRuntimeState,
  assertInvariants,
} from "@/lib/editor/state"
import { HistoryManager, type Command } from "@/lib/editor/history"
import {
  AddLayerCommand,
  RemoveLayerCommand,
  ReorderLayerCommand,
  ReorderLayersCommand,
  UpdateLayerCommand,
  SetSelectionCommand,
  SetViewportCommand,
  SetActiveToolCommand,
  AddAdjustmentLayerCommand,
  UpdateAdjustmentParametersCommand,
  DocumentRotateCommand,
  DocumentFlipCommand,
  DocumentDimensionsCommand,
  CreateGroupLayerCommand,
  UngroupLayerCommand,
  AddGlobalLayerCommand,
  RemoveGlobalLayerCommand,
  RemoveGlobalParameterCommand,
  ReorderGlobalLayerCommand,
  SetGlobalParametersCommand,
  UpdateGlobalLayerCommand,
  UpdateGlobalParameterCommand,
} from "@/lib/editor/commands"
import { initializeDefaultKeyframePlugins } from "@/lib/animation/plugins"
import type { AdjustmentPlugin } from "../adjustments/registry"
import { defaultToolValues, type ToolValueTypes } from "@/lib/tools/tools"
import {
  createInitialToolsState,
  type ImageEditorToolsState,
} from "@/lib/tools/tools-state"

export type EditorContextValue = {
  state: EditorRuntimeState
  activeTool: ActiveToolModel["tool"]
  documentLayerDimensions: {
    width: number
    height: number
    size: number
    name: string
  }
  initialToolsState: ImageEditorToolsState
  toolValues: Record<string, ToolValueTypes>
  renderType: "default" | "worker" | "hybrid"
  history: {
    begin: (name: string) => void
    push: (command: Command) => void
    end: (commit?: boolean) => void
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean
    inspect: () => {
      past: Array<{
        label: string
        thumbnail?: string | null
        scope?: string
        timestamp?: number
      }>
      future: Array<{
        label: string
        thumbnail?: string | null
        scope?: string
        timestamp?: number
      }>
      checkpoints: any[]
      counts: { past: number; future: number }
      usedBytes: number
    }
  }
  addAdjustmentLayer: (
    adjustmentType: string,
    parameters: Record<string, number>,
    position: "top" | "bottom" | number
  ) => void
  addCheckpoint?: (name: string) => void
  addEmptyLayer: () => void
  addImageLayer: (files: File | File[]) => void
  clearHistory?: () => void
  clearRedo?: () => void
  deleteStepsAfterIndex?: (idx: number) => void
  deleteStepsBeforeIndex?: (idx: number) => void
  dimensionsDocument?: (props: {
    width: number
    height: number
    canvasPosition: CanvasPosition
    layers: Record<LayerId, EditorLayer>
  }) => void
  duplicateLayer: (layerId: LayerId) => void
  exportDocumentAtIndex?: (idx: number) => any
  flipDocument: (opts: { horizontal?: boolean; vertical?: boolean }) => void
  getLayerById: (layerId: LayerId) => EditorLayer | null
  getOrderedLayers: () => EditorLayer[]
  getSelectedLayer: () => EditorLayer | null
  getSelectedLayerId: () => LayerId | null
  isTransactionActive?: () => boolean
  jumpToCheckpoint?: (id: string) => void
  pushLayerUpdate: (
    layerId: LayerId,
    update: Partial<Omit<EditorLayer, "id">>
  ) => void
  updateLayerNonUndoable: (
    layerId: LayerId,
    update: Partial<Omit<EditorLayer, "id">>
  ) => void
  removeLayer: (layerId: LayerId) => void
  reorderLayer: (
    layerId: LayerId,
    to: { parentId?: LayerId | null; index: number }
  ) => void
  reorderLayers: (fromIndex: number, toIndex: number) => void
  rotateDocument: (rotation: number) => void
  selectLayer: (layerId: LayerId | null) => void
  selectLayerNonUndoable: (layerId: LayerId | null) => void
  setActiveTool: (active: ActiveToolModel) => void
  setBlendMode: (layerId: LayerId, blendMode: EditorLayer["blendMode"]) => void
  setCanonical: (
    updater: (s: CanonicalEditorState) => CanonicalEditorState
  ) => void

  setEphemeral: (
    updater: (s: EphemeralEditorState) => EphemeralEditorState
  ) => void
  setLayerName: (layerId: LayerId, name: string) => void
  setMaxBytes?: (bytes: number) => void
  setOpacity: (layerId: LayerId, opacity: number) => void
  setRenderType: (renderType: "default" | "worker" | "hybrid") => void
  setThumbnailProvider?: (
    provider: (() => Promise<string | null> | string | null) | null
  ) => void
  setZoomPercent: (zoom: number) => void
  toggleLock: (layerId: LayerId) => void
  toggleVisibility: (layerId: LayerId) => void
  updateAdjustmentParameters: (
    layerId: LayerId,
    parameters: Record<string, number>
  ) => void
  updateLayer: (
    layerId: LayerId,
    update: Partial<Omit<EditorLayer, "id">>
  ) => void
  createGroupLayer: (layerIds: LayerId[], groupName?: string) => void
  ungroupLayer: (groupLayerId: LayerId) => void
  toggleGroupCollapse: (groupLayerId: LayerId) => void
  addGlobalLayer: (
    layer: AdjustmentLayer | SolidLayer | MaskLayer,
    position?: "top" | "bottom" | number
  ) => void
  getGlobalLayers: () => (AdjustmentLayer | SolidLayer | MaskLayer)[]
  removeGlobalLayer: (layerId: LayerId) => void
  updateGlobalLayer: (
    layerId: LayerId,
    update: Partial<Omit<AdjustmentLayer | SolidLayer | MaskLayer, "id">>
  ) => void
  reorderGlobalLayer: (fromIndex: number, toIndex: number) => void
  setGlobalParameters: (
    parameters: Record<string, number | { value: number; color: string }>
  ) => void
  updateGlobalParameter: (
    key: string,
    value: number | { value: number; color: string }
  ) => void
  removeGlobalParameter: (key: string) => void
  // Time/transport API
  getPlayheadTime: () => number
  setPlayheadTime: (t: number) => void
  play: () => void
  pause: () => void
  stop: () => void
  setLoop: (loop: boolean, loopIn?: number, loopOut?: number) => void
  stepToPrevKeyframe: () => void
  stepToNextKeyframe: () => void
  setScrubbing: (isScrubbing: boolean) => void
  // Keyframe CRUD for tools on a given layer and parameter key
  addKeyframe: (
    layerId: LayerId,
    paramKey: string,
    t: number,
    value: any
  ) => void
  updateKeyframeTime: (
    layerId: LayerId,
    paramKey: string,
    fromT: number,
    toT: number
  ) => void
  deleteKeyframe: (layerId: LayerId, paramKey: string, t: number) => void
  captureChangedTracksAtPlayhead: (layerId: LayerId) => void
}

const EditorContext = React.createContext<EditorContextValue | null>(null)

export function useEditorContext(): EditorContextValue {
  const ctx = React.useContext(EditorContext)
  if (!ctx) throw new Error("EditorContext not available")
  return ctx
}

export function EditorProvider({
  children,
  images,
  dimensions: imageDimensions = [],
  adjustmentPlugins = [],
}: {
  children: React.ReactNode
  images: File[]
  dimensions: {
    width: number
    height: number
    size: number
    name: string
  }[]
  adjustmentPlugins: AdjustmentPlugin[]
}): React.JSX.Element {
  const adjustmentPluginsMemoized = React.useMemo(() => {
    return adjustmentPlugins
  }, [])

  const toolValues = React.useMemo(() => {
    let params: Record<string, ToolValueTypes> = defaultToolValues

    for (const plugin of adjustmentPluginsMemoized) {
      params = { ...params, ...plugin.params }
    }

    return params
  }, [adjustmentPluginsMemoized])

  const initialToolsState = React.useMemo(
    () => createInitialToolsState(toolValues),
    [toolValues]
  )

  // Initialize keyframe plugin registry once
  React.useMemo(() => {
    try {
      initializeDefaultKeyframePlugins()
    } catch {}
    return null
  }, [])

  const documentLayerDimensions = imageDimensions.sort(
    (a, b) => b.size - a.size
  )[0] || { width: 800, height: 600, size: 800 * 600, name: "Document" }

  const [runtime, setRuntime] = React.useState<EditorRuntimeState>(() => {
    const base = createEditorRuntimeState({
      activeTool: { sidebar: "rotate", tool: "rotate" } as ActiveToolModel,
    })

    const initialLayers: ImageLayer[] = images.map((image, index) => {
      const dimensions = imageDimensions.find((dim) => dim.name === image.name)

      return {
        id: `layer-${Date.now()}-${index}`,
        name: image.name,
        visible: true,
        locked: false,
        type: "image",
        filters: (() => {
          try {
            const canon = require("@/lib/animation/crud") as any
            const dims = {
              width: dimensions?.width || 1,
              height: dimensions?.height || 1,
              x: 0,
              y: 0,
            }
            const crop = {
              x: 0,
              y: 0,
              width: dimensions?.width || 1,
              height: dimensions?.height || 1,
              overlay: "thirdGrid",
            }
            return {
              ...initialToolsState,
              dimensions: canon.createCanonicalTrack("dimensions", dims),
              crop: canon.createCanonicalTrack("crop", crop),
            }
          } catch {
            return {
              ...initialToolsState,
              dimensions: {
                width: dimensions?.width || 1,
                height: dimensions?.height || 1,
                x: 0,
                y: 0,
              },
              crop: {
                ...(initialToolsState as any).crop,
                width: dimensions?.width || 1,
                height: dimensions?.height || 1,
              },
            } as any
          }
        })(),
        opacity: 100,
        isEmpty: !image,
        blendMode: "normal",
        image: image ?? undefined,
      }
    })

    // Set document dimensions to first image if available
    const documentWidth = documentLayerDimensions?.width || 800
    const documentHeight = documentLayerDimensions?.height || 600

    const documentLayer: DocumentLayer = {
      id: "document",
      name: "Document",
      type: "document",
      visible: true,
      locked: false,
      filters: { ...initialToolsState },
      opacity: 100,
      blendMode: "normal",
    }

    const layers = normalizeLayers([...initialLayers, documentLayer])
    // Safely override the document layer dimensions
    const existingDocument = layers.byId["document"] as DocumentLayer
    const updatedDocument: DocumentLayer = {
      ...existingDocument,
      filters: (() => {
        try {
          const canon = require("@/lib/animation/crud") as any
          const prevDims = (existingDocument as any).filters?.dimensions
          const prevCrop = (existingDocument as any).filters?.crop
          const dimsVal = {
            x: Number((prevDims as any)?.x ?? 0) || 0,
            y: Number((prevDims as any)?.y ?? 0) || 0,
            width: documentWidth,
            height: documentHeight,
          }
          const cropVal = {
            x: Number((prevCrop as any)?.x ?? 0) || 0,
            y: Number((prevCrop as any)?.y ?? 0) || 0,
            width: documentWidth,
            height: documentHeight,
            overlay: (prevCrop as any)?.overlay ?? "thirdGrid",
          }
          const dimsTrack = canon.isCanonicalTrack(prevDims)
            ? canon.addOrUpdateKeyframeCanonical(prevDims, 0, dimsVal)
            : canon.createCanonicalTrack("dimensions", dimsVal)
          const cropTrack = canon.isCanonicalTrack(prevCrop)
            ? canon.addOrUpdateKeyframeCanonical(prevCrop, 0, cropVal)
            : canon.createCanonicalTrack("crop", cropVal)
          return {
            ...(existingDocument as any).filters,
            dimensions: dimsTrack,
            crop: cropTrack,
          }
        } catch {
          return {
            ...(existingDocument as any).filters,
            dimensions: {
              ...(existingDocument as any).filters?.dimensions,
              width: documentWidth,
              height: documentHeight,
            },
            crop: {
              ...(existingDocument as any).filters?.crop,
              width: documentWidth,
              height: documentHeight,
            },
          }
        }
      })(),
    }
    const canonical: CanonicalEditorState = {
      ...base.canonical,
      layers: {
        ...layers,
        byId: { ...layers.byId, document: updatedDocument as any },
      },
      document: {
        ...base.canonical.document,
        width: documentWidth,
        height: documentHeight,
      },
    }
    const result = { canonical, ephemeral: base.ephemeral }
    assertInvariants(canonical)
    return result
  })
  const [renderType, setRenderType] = React.useState<
    "default" | "worker" | "hybrid"
  >(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("phototis:renderType")
        if (
          stored === "worker" ||
          stored === "hybrid" ||
          stored === "default"
        ) {
          return stored
        }
      }
    } catch {}
    return "default"
  })

  // Keep a live ref of the latest canonical state to avoid stale closures in HistoryManager
  const canonicalRef = React.useRef(runtime.canonical)
  React.useEffect(() => {
    canonicalRef.current = runtime.canonical
  }, [runtime.canonical])

  // History manager instance (stable across renders)
  const historyRef = React.useRef<HistoryManager | null>(null)
  if (!historyRef.current) {
    historyRef.current = new HistoryManager(
      () => canonicalRef.current,
      (updater) =>
        setRuntime((prev) => {
          const nextCanonical = updater(prev.canonical)

          return { ...prev, canonical: nextCanonical }
        }),
      {
        maxBytes: 32 * 1024 * 1024,
        coalesceWindowMs: 120,
        autosaveOnTransactionEnd: true,
        storageKey: "phototis:editor",
      }
    )
  }

  // Expose HistoryManager for debugging in development only
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    try {
      ;(window as any).$state = canonicalRef.current
    } catch {}
  }

  // Load persisted document (if available) once
  React.useEffect(() => {
    // TODO: Implement this
    // ;(async () => {
    //   try {
    //     const saved = await loadDocument("phototis:editor")
    //     if (saved) {
    //       // Replace canonical state with persisted and rehydrate history
    //       setRuntime((prev) => ({ ...prev, canonical: saved.state }))
    //       historyRef.current?.rehydrate(saved.history)
    //     }
    //   } catch (e) {
    //     console.warn("Failed to load persisted document", e)
    //   }
    // })()
  }, [])

  // Interval autosave and beforeunload safeguard
  React.useEffect(() => {
    const h = historyRef.current
    if (!h) return
    const interval = setInterval(() => {
      void h.save("phototis:editor")
    }, 30000)
    const onBeforeUnload = () => {
      // best-effort sync save; localStorage is sync
      void h.save("phototis:editor")
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      clearInterval(interval)
      window.removeEventListener("beforeunload", onBeforeUnload)
    }
  }, [])

  const setCanonical = React.useCallback(
    (updater: (s: CanonicalEditorState) => CanonicalEditorState) => {
      setRuntime((prev) => {
        const nextCanonical = updater(prev.canonical)
        assertInvariants(nextCanonical)
        return { ...prev, canonical: nextCanonical }
      })
    },
    []
  )

  const setEphemeral = React.useCallback(
    (updater: (s: EphemeralEditorState) => EphemeralEditorState) => {
      setRuntime((prev) => ({ ...prev, ephemeral: updater(prev.ephemeral) }))
    },
    []
  )

  // ===== Time / Transport =====
  const rafIdRef = React.useRef<number | null>(null)
  const lastTickMsRef = React.useRef<number | null>(null)

  const getPlayheadTime = React.useCallback(() => {
    return runtime.canonical.playheadTime
  }, [runtime.canonical.playheadTime])

  const setPlayheadTime = React.useCallback(
    (t: number) => {
      setCanonical((s) => {
        const nextT = Math.max(0, Number.isFinite(t) ? t : 0)
        return { ...s, playheadTime: nextT }
      })
    },
    [setCanonical]
  )

  const play = React.useCallback(() => {
    setCanonical((s) => ({
      ...s,
      transport: { ...s.transport, playing: true },
    }))
  }, [setCanonical])

  const pause = React.useCallback(() => {
    setCanonical((s) => ({
      ...s,
      transport: { ...s.transport, playing: false },
    }))
  }, [setCanonical])

  const stop = React.useCallback(() => {
    setCanonical((s) => ({
      ...s,
      playheadTime: 0,
      transport: { ...s.transport, playing: false },
    }))
  }, [setCanonical])

  const setLoop = React.useCallback(
    (loop: boolean, loopIn?: number, loopOut?: number) => {
      setCanonical((s) => ({
        ...s,
        transport: {
          ...s.transport,
          loop,
          loopIn:
            typeof loopIn === "number"
              ? Math.max(0, loopIn)
              : s.transport.loopIn,
          loopOut:
            typeof loopOut === "number" && loopOut > 0
              ? Math.max(loopIn ?? 0, loopOut)
              : s.transport.loopOut,
        },
      }))
    },
    [setCanonical]
  )

  const setScrubbing = React.useCallback(
    (isScrubbing: boolean) => {
      setEphemeral((e) => ({
        ...e,
        interaction: { ...e.interaction, isScrubbing },
      }))
    },
    [setEphemeral]
  )

  // Step to prev/next keyframe: placeholder traversal (will resolve after tracks migration)
  const collectAllKeyframeTimes = React.useCallback((): number[] => {
    const times: number[] = []
    const { layers } = canonicalRef.current
    for (const id of layers.order) {
      const layer = layers.byId[id] as any
      const filters = layer?.filters
      if (!filters) continue
      for (const [key, value] of Object.entries(filters)) {
        if (key === "history" || key === "historyPosition" || key === "solid")
          continue
        const track = value as any
        if (
          track &&
          typeof track === "object" &&
          Array.isArray((track as any).keyframes)
        ) {
          for (const kf of (track as any).keyframes as Array<{
            timeSec: number
          }>) {
            if (Number.isFinite(kf.timeSec)) times.push(kf.timeSec)
          }
        }
      }
    }
    // unique & sorted
    return Array.from(new Set(times)).sort((a, b) => a - b)
  }, [])

  const stepToPrevKeyframe = React.useCallback(() => {
    const t = runtime.canonical.playheadTime
    const times = collectAllKeyframeTimes().filter((k) => k < t)
    if (times.length === 0) return
    const prev = times.reduce((a, b) => (b > a ? b : a), 0)
    setPlayheadTime(prev)
  }, [runtime.canonical.playheadTime, collectAllKeyframeTimes, setPlayheadTime])

  const stepToNextKeyframe = React.useCallback(() => {
    const t = runtime.canonical.playheadTime
    const times = collectAllKeyframeTimes().filter((k) => k > t)
    if (times.length === 0) return
    const next = times.reduce((a, b) => (a < b ? a : b), times[0])
    setPlayheadTime(next)
  }, [runtime.canonical.playheadTime, collectAllKeyframeTimes, setPlayheadTime])

  // ===== Keyframe CRUD integrated with history =====
  const addKeyframe = React.useCallback(
    (layerId: LayerId, paramKey: string, t: number, value: any) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction(`Add keyframe: ${paramKey}@${t.toFixed(3)}s`)
      const layer = canonicalRef.current.layers.byId[layerId]
      if (!layer || layer.type === "document") {
        h.cancelTransaction()
        return
      }
      const filters = (layer as any).filters || {}
      try {
        const canon = require("@/lib/animation/crud") as any
        const current = filters[paramKey]
        const nextTrack = canon.isCanonicalTrack(current)
          ? canon.addOrUpdateKeyframeCanonical(current, t, value)
          : canon.addOrUpdateKeyframeCanonical(
              canon.createCanonicalTrack(paramKey, value),
              t,
              value
            )
        const patch: any = { filters: { ...filters, [paramKey]: nextTrack } }
        h.push(new UpdateLayerCommand(layerId, patch))
        try {
          const { invalidateForTrack } =
            require("@/lib/animation/sampler") as any
          invalidateForTrack(layerId, "filters", paramKey)
        } catch {}
        h.endTransaction(true)
      } catch {
        h.cancelTransaction()
      }
    },
    []
  )

  const updateKeyframeTime = React.useCallback(
    (layerId: LayerId, paramKey: string, fromT: number, toT: number) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction(
        `Move keyframe: ${paramKey} ${fromT.toFixed(3)}→${toT.toFixed(3)}`
      )
      const layer = canonicalRef.current.layers.byId[layerId]
      if (!layer || layer.type === "document") {
        h.cancelTransaction()
        return
      }
      const filters = (layer as any).filters || {}
      try {
        const canon = require("@/lib/animation/crud") as any
        const current = filters[paramKey]
        if (!canon.isCanonicalTrack(current)) {
          h.cancelTransaction()
          return
        }
        const nextTrack = canon.moveKeyframeCanonical(current, fromT, toT)
        const patch: any = { filters: { ...filters, [paramKey]: nextTrack } }
        h.push(new UpdateLayerCommand(layerId, patch))
        try {
          const { invalidateForTrack } =
            require("@/lib/animation/sampler") as any
          invalidateForTrack(layerId, "filters", paramKey)
        } catch {}
        h.endTransaction(true)
      } catch {
        h.cancelTransaction()
      }
    },
    []
  )

  const deleteKeyframe = React.useCallback(
    (layerId: LayerId, paramKey: string, t: number) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction(`Delete keyframe: ${paramKey}@${t.toFixed(3)}s`)
      const layer = canonicalRef.current.layers.byId[layerId]
      if (!layer || layer.type === "document") {
        h.cancelTransaction()
        return
      }
      const filters = (layer as any).filters || {}
      try {
        const canon = require("@/lib/animation/crud") as any
        const current = filters[paramKey]
        if (!canon.isCanonicalTrack(current)) {
          h.cancelTransaction()
          return
        }
        const nextTrack = canon.removeKeyframeCanonical(current, t)
        const patch: any = { filters: { ...filters, [paramKey]: nextTrack } }
        h.push(new UpdateLayerCommand(layerId, patch))
        try {
          const { invalidateForTrack } =
            require("@/lib/animation/sampler") as any
          invalidateForTrack(layerId, "filters", paramKey)
        } catch {}
        h.endTransaction(true)
      } catch {
        h.cancelTransaction()
      }
    },
    []
  )

  const captureChangedTracksAtPlayhead = React.useCallback(
    (layerId: LayerId) => {
      const h = historyRef.current
      if (!h) return
      const stateNow = canonicalRef.current
      const layer = stateNow.layers.byId[layerId] as any
      if (!layer || layer.type === "document") return
      const t = stateNow.playheadTime
      const filters = (layer.filters || {}) as Record<string, any>
      try {
        const { sampleToolsAtTime } = require("@/lib/tools/tools-state") as any
        const { collectModifiedKeysFromSample } =
          require("@/lib/tools/tools") as any
        const canon = require("@/lib/animation/crud") as any
        const sampled = sampleToolsAtTime(filters, t)
        const modifiedKeys = collectModifiedKeysFromSample(sampled, toolValues)
        if (modifiedKeys.length === 0) return
        h.beginTransaction(
          `Capture ${modifiedKeys.length} tracks @ ${t.toFixed(3)}s`
        )
        const patchFilters = { ...filters }
        for (const key of modifiedKeys) {
          const current = filters[key]
          const value = (sampled as any)[key]
          const nextTrack = canon.isCanonicalTrack(current)
            ? canon.addOrUpdateKeyframeCanonical(current, t, value)
            : canon.addOrUpdateKeyframeCanonical(
                canon.createCanonicalTrack(key, value),
                t,
                value
              )
          patchFilters[key] = nextTrack
          try {
            const { invalidateForTrack } =
              require("@/lib/animation/sampler") as any
            invalidateForTrack(layer.id as any, "filters", key)
          } catch {}
        }
        h.push(
          new UpdateLayerCommand(layerId, { filters: patchFilters } as any)
        )
        h.endTransaction(true)
      } catch {
        // ignore errors, no partial updates
      }
    },
    []
  )

  // Render-tick scheduler: advances playhead while playing and triggers redraws
  React.useEffect(() => {
    const tick = (now: number) => {
      const last = lastTickMsRef.current
      lastTickMsRef.current = now
      const { playing, loop, loopIn, loopOut } = canonicalRef.current.transport
      if (playing) {
        const dt = last ? (now - last) / 1000 : 0
        let nextT = canonicalRef.current.playheadTime + dt
        if (loop && typeof loopIn === "number" && typeof loopOut === "number") {
          if (nextT > loopOut) nextT = loopIn
        }
        setCanonical((s) => ({ ...s, playheadTime: nextT }))
      }
      rafIdRef.current = window.requestAnimationFrame(tick)
    }
    rafIdRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (rafIdRef.current) {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      lastTickMsRef.current = null
    }
  }, [setCanonical])

  const getLayerById = React.useCallback(
    (layerId: LayerId): EditorLayer | null => {
      return runtime.canonical.layers.byId[layerId] ?? null
    },
    [runtime.canonical.layers.byId]
  )

  const getOrderedLayers = React.useCallback((): EditorLayer[] => {
    const {
      layers: { order, byId },
    } = runtime.canonical
    return order.map((id) => byId[id]).filter(Boolean)
  }, [runtime.canonical])

  const getSelectedLayerId = React.useCallback((): LayerId | null => {
    const ids = runtime.canonical.selection.layerIds
    return ids.length > 0 ? ids[0] : null
  }, [runtime.canonical.selection.layerIds])

  const getSelectedLayer = React.useCallback((): EditorLayer | null => {
    const id = getSelectedLayerId()
    if (!id) return null
    return runtime.canonical.layers.byId[id] ?? null
  }, [getSelectedLayerId, runtime.canonical.layers.byId])

  const selectLayer = React.useCallback((layerId: LayerId | null) => {
    historyRef.current?.execute(
      new SetSelectionCommand(layerId ? [layerId] : [])
    )
  }, [])

  const selectLayerNonUndoable = React.useCallback(
    (layerId: LayerId | null) => {
      const cmd = new SetSelectionCommand(layerId ? [layerId] : [], {
        nonUndoable: true,
        label: "Auto-select layer",
      })
      historyRef.current?.execute(cmd)
    },
    []
  )

  const addEmptyLayer = React.useCallback(() => {
    const newLayer: ImageLayer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${runtime.canonical.layers.order.length + 1}`,
      visible: true,
      locked: false,
      type: "image",
      filters: { ...initialToolsState },
      opacity: 100,
      isEmpty: true,
      blendMode: "normal",
    }
    historyRef.current?.beginTransaction("Add Layer")
    historyRef.current?.push(new AddLayerCommand(newLayer, "top"))
    historyRef.current?.push(new SetSelectionCommand([newLayer.id]))
    historyRef.current?.endTransaction(true)
  }, [initialToolsState, runtime.canonical.layers.order.length])

  const addImageLayer = React.useCallback(
    (files: File | File[]) => {
      const fileArray = Array.isArray(files) ? files : [files]
      const imageFiles = fileArray.filter((file) =>
        file.type.startsWith("image/")
      )

      if (imageFiles.length === 0) {
        console.warn("No valid image files provided")
        return
      }

      const transactionName =
        imageFiles.length === 1
          ? "Add Image Layer"
          : `Add ${imageFiles.length} Image Layers`

      historyRef.current?.beginTransaction(transactionName)

      const newLayers: ImageLayer[] = imageFiles.map((file, index) => ({
        id: `layer-${Date.now()}-${index}`,
        name:
          file.name ||
          `Layer ${runtime.canonical.layers.order.length + index + 1}`,
        visible: true,
        locked: false,
        type: "image",
        filters: initialToolsState,
        opacity: 100,
        isEmpty: false,
        image: file,
        blendMode: "normal",
      }))

      // Add all layers
      newLayers.forEach((layer) => {
        historyRef.current?.push(new AddLayerCommand(layer, "top"))
      })

      // Select the first new layer
      if (newLayers.length > 0) {
        historyRef.current?.push(new SetSelectionCommand([newLayers[0].id]))
      }

      historyRef.current?.endTransaction(true)
    },
    [initialToolsState, runtime.canonical.layers.order.length]
  )

  const removeLayer = React.useCallback((layerId: LayerId) => {
    historyRef.current?.execute(new RemoveLayerCommand(layerId))
  }, [])

  const reorderLayer = React.useCallback(
    (layerId: LayerId, to: { parentId?: LayerId | null; index: number }) => {
      historyRef.current?.beginTransaction("Move layer to top level")
      historyRef.current?.push(
        new ReorderLayerCommand(layerId, {
          parentId: to.parentId,
          index: to.index,
        })
      )
      historyRef.current?.endTransaction(true)
    },
    []
  )

  const duplicateLayer = React.useCallback(
    (layerId: LayerId) => {
      const layer = runtime.canonical.layers.byId[layerId]
      if (!layer) return
      const dup: EditorLayer = {
        ...layer,
        id: `layer-${Date.now()}`,
        name: `${layer.name} (Copy)`,
      }
      historyRef.current?.beginTransaction("Duplicate Layer")
      historyRef.current?.push(new AddLayerCommand(dup, "top"))
      historyRef.current?.push(new SetSelectionCommand([dup.id]))
      historyRef.current?.endTransaction(true)
    },
    [runtime.canonical.layers.byId]
  )

  const reorderLayers = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      const cmd = new ReorderLayersCommand(fromIndex, toIndex)
      historyRef.current?.push(cmd)
    },
    []
  )

  const updateLayer = React.useCallback(
    (layerId: LayerId, update: Partial<Omit<EditorLayer, "id">>) => {
      historyRef.current?.execute(new UpdateLayerCommand(layerId, update))
    },
    []
  )

  const pushLayerUpdate = React.useCallback(
    (layerId: LayerId, update: Partial<Omit<EditorLayer, "id">>) => {
      historyRef.current?.push(new UpdateLayerCommand(layerId, update))
    },
    []
  )

  const updateLayerNonUndoable = React.useCallback(
    (layerId: LayerId, update: Partial<Omit<EditorLayer, "id">>) => {
      const cmd = new UpdateLayerCommand(layerId, update, {
        nonUndoable: true,
        label: "Auto-update layer dimensions",
      })
      historyRef.current?.execute(cmd)
    },
    []
  )

  const createGroupLayer = React.useCallback(
    (layerIds: LayerId[], groupName?: string) => {
      if (layerIds.length < 2) return

      historyRef.current?.beginTransaction(`Group ${layerIds.length} layers`)
      historyRef.current?.push(new CreateGroupLayerCommand(layerIds, groupName))
      historyRef.current?.endTransaction(true)
    },
    []
  )

  const ungroupLayer = React.useCallback(
    (groupLayerId: LayerId) => {
      const groupLayer = runtime.canonical.layers.byId[groupLayerId]
      if (!groupLayer || groupLayer.type !== "group") return

      historyRef.current?.beginTransaction("Ungroup layers")
      historyRef.current?.push(new UngroupLayerCommand(groupLayerId))
      historyRef.current?.endTransaction(true)
    },
    [runtime.canonical.layers.byId]
  )

  const toggleGroupCollapse = React.useCallback(
    (groupLayerId: LayerId) => {
      const groupLayer = runtime.canonical.layers.byId[groupLayerId]
      if (!groupLayer || groupLayer.type !== "group") return

      const groupLayerTyped = groupLayer as any
      updateLayer(groupLayerId, {
        collapsed: !groupLayerTyped.collapsed,
      } as any)
    },
    [runtime.canonical.layers.byId, updateLayer]
  )

  // Global layer management functions
  const addGlobalLayer = React.useCallback(
    (
      layer: AdjustmentLayer | SolidLayer | MaskLayer,
      position: "top" | "bottom" | number = "top"
    ) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction("Add Global Layer")
      const cmd = new AddGlobalLayerCommand(layer, position)
      h.push(cmd)
      h.endTransaction(true)
    },
    []
  )

  const getGlobalLayers = React.useCallback(
    () => runtime.canonical.document.globalLayers,
    [runtime.canonical.document.globalLayers]
  )

  const removeGlobalLayer = React.useCallback((layerId: LayerId) => {
    const h = historyRef.current
    if (!h) return
    h.beginTransaction("Remove Global Layer")
    const cmd = new RemoveGlobalLayerCommand(layerId)
    h.push(cmd)
    h.endTransaction(true)
  }, [])

  const updateGlobalLayer = React.useCallback(
    (
      layerId: LayerId,
      update: Partial<Omit<AdjustmentLayer | SolidLayer | MaskLayer, "id">>
    ) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction("Update Global Layer")
      const cmd = new UpdateGlobalLayerCommand(layerId, update)
      h.push(cmd)
      h.endTransaction(true)
    },
    []
  )

  const reorderGlobalLayer = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction("Reorder Global Layer")
      const cmd = new ReorderGlobalLayerCommand(fromIndex, toIndex)
      h.push(cmd)
      h.endTransaction(true)
    },
    []
  )

  // Global parameters management functions
  const setGlobalParameters = React.useCallback(
    (parameters: Record<string, number | { value: number; color: string }>) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction("Set Global Parameters")
      const cmd = new SetGlobalParametersCommand(parameters)
      h.push(cmd)
      h.endTransaction(true)
    },
    []
  )

  const updateGlobalParameter = React.useCallback(
    (key: string, value: number | { value: number; color: string }) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction("Update Global Parameter")
      const cmd = new UpdateGlobalParameterCommand(key, value)
      h.push(cmd)
      h.endTransaction(true)
    },
    []
  )

  const removeGlobalParameter = React.useCallback((key: string) => {
    const h = historyRef.current
    if (!h) return
    h.beginTransaction("Remove Global Parameter")
    const cmd = new RemoveGlobalParameterCommand(key)
    h.push(cmd)
    h.endTransaction(true)
  }, [])

  const addAdjustmentLayer = React.useCallback(
    (
      adjustmentType: string,
      parameters:
        | Record<string, number | { value: number; color: string }>
        | undefined,
      position: "top" | "bottom" | number = "top"
    ) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction("Add Adjustment Layer")
      const id = `adjustment-${Date.now()}`
      let params = parameters
      try {
        // Fill defaults from plugin if parameters not provided
        const { getDefaultParameters } = require("@/lib/adjustments/registry")
        if (!params) {
          params = getDefaultParameters(adjustmentType as any) as any
        }
      } catch {}
      const cmd = new AddAdjustmentLayerCommand(
        adjustmentType,
        (params ?? {}) as any,
        position,
        id
      )
      h.push(cmd)
      h.push(new SetSelectionCommand([id]))
      h.endTransaction(true)
    },
    []
  )

  const updateAdjustmentParameters = React.useCallback(
    (
      layerId: LayerId,
      parameters: Record<string, number | { value: number; color: string }>
    ) => {
      historyRef.current?.execute(
        new UpdateAdjustmentParametersCommand(layerId, parameters)
      )
    },
    []
  )

  const setBlendMode = React.useCallback(
    (layerId: LayerId, blendMode: EditorLayer["blendMode"]) =>
      updateLayer(layerId, { blendMode }),
    [updateLayer]
  )

  const setOpacity = React.useCallback(
    (layerId: LayerId, opacity: number) => updateLayer(layerId, { opacity }),
    [updateLayer]
  )

  const setLayerName = React.useCallback(
    (layerId: LayerId, name: string) => updateLayer(layerId, { name }),
    [updateLayer]
  )

  const toggleVisibility = React.useCallback(
    (layerId: LayerId) => {
      const layer = runtime.canonical.layers.byId[layerId]
      if (!layer) return
      updateLayer(layerId, { visible: !layer.visible })
    },
    [runtime.canonical.layers.byId, updateLayer]
  )

  const toggleLock = React.useCallback(
    (layerId: LayerId) => {
      const layer = runtime.canonical.layers.byId[layerId]
      if (!layer) return
      updateLayer(layerId, { locked: !layer.locked })
    },
    [runtime.canonical.layers.byId, updateLayer]
  )

  const setActiveTool = React.useCallback((active: ActiveToolModel) => {
    historyRef.current?.execute(new SetActiveToolCommand(active))
  }, [])

  const setZoomPercent = React.useCallback((zoom: number) => {
    historyRef.current?.execute(new SetViewportCommand({ zoom }))
  }, [])

  const rotateDocument = React.useCallback((rotation: number) => {
    // Prepare image-layer rotations for document rotate
    const currentLayers = canonicalRef.current.layers
    const previousRotations: Record<string, number> = {}
    for (const layerId of currentLayers.order) {
      const layer = currentLayers.byId[layerId]
      if (layer.type === "image") {
        const imageLayer = layer as any
        previousRotations[layerId] = imageLayer.filters?.rotate || 0
      }
    }

    // Group both operations as one user action for undo/redo
    const h = historyRef.current
    if (!h) return
    h.beginTransaction(`Rotate Document ${rotation > 0 ? "+" : ""}${rotation}°`)
    h.push(new DocumentRotateCommand(rotation, previousRotations))
    h.endTransaction(true)
  }, [])

  const flipDocument = React.useCallback(
    (opts: { horizontal?: boolean; vertical?: boolean }) => {
      const currentLayers = canonicalRef.current.layers
      const previousFlips: Record<
        string,
        { flipHorizontal: boolean; flipVertical: boolean }
      > = {}
      for (const layerId of currentLayers.order) {
        const layer = currentLayers.byId[layerId]
        if (layer.type === "image") {
          const imageLayer = layer as any
          previousFlips[layerId] = {
            flipHorizontal: Boolean(imageLayer.filters?.flipHorizontal),
            flipVertical: Boolean(imageLayer.filters?.flipVertical),
          }
        }
      }

      const h = historyRef.current
      if (!h) return
      h.beginTransaction(
        `Flip Document${opts.horizontal ? " H" : ""}${opts.vertical ? " V" : ""}`
      )
      h.push(
        new DocumentFlipCommand(
          { flipHorizontal: opts.horizontal, flipVertical: opts.vertical },
          previousFlips
        )
      )
      h.endTransaction(true)
    },
    []
  )

  const dimensionsDocument = React.useCallback(
    (props: {
      width: number
      height: number
      canvasPosition: CanvasPosition
      layers: Record<LayerId, EditorLayer>
    }) => {
      try {
        const h = historyRef.current
        if (!h) return
        h.beginTransaction(
          `Dimensions Document ${props.width}×${props.height} (${props.canvasPosition})`
        )
        h.push(
          new DocumentDimensionsCommand({
            width: props.width,
            height: props.height,
            canvasPosition: props.canvasPosition,
            layers: props.layers,
          })
        )
        h.endTransaction(true)
      } catch (error) {
        // Log the error for debugging
        console.error("Failed to update document dimensions:", error)

        // You could add a toast notification here if you have a notification system
        // For now, we'll just log it and let the UI handle the error state

        // Revert the local state change by notifying the component
        // This will be handled by the validation in the UI component
      }
    },
    []
  )

  const value: EditorContextValue = React.useMemo(
    () => ({
      state: runtime,
      activeTool: runtime.canonical.activeTool.tool,
      adjustmentPlugins: adjustmentPluginsMemoized,
      documentLayerDimensions,
      initialToolsState,
      toolValues,
      renderType,
      history: {
        begin: (name: string) => historyRef.current?.beginTransaction(name),
        push: (cmd: Command) => historyRef.current?.push(cmd),
        end: (commit?: boolean) =>
          historyRef.current?.endTransaction(commit ?? true),
        undo: () => historyRef.current?.undo(),
        redo: () => historyRef.current?.redo(),
        canUndo: () => Boolean(historyRef.current?.canUndo),
        canRedo: () => Boolean(historyRef.current?.canRedo),
        inspect: () =>
          historyRef.current?.inspect() ?? {
            past: [],
            future: [],
            checkpoints: [],
            counts: { past: 0, future: 0 },
            usedBytes: 0,
            commands: [],
          },
        addCheckpoint: (name: string) =>
          historyRef.current?.addCheckpoint(name),
        jumpToCheckpoint: (id: string) =>
          historyRef.current?.jumpToCheckpoint(id),
        clearHistory: () => historyRef.current?.clearHistory(),
        clearRedo: () => historyRef.current?.clearRedo(),
        setMaxBytes: (bytes: number) => historyRef.current?.setMaxBytes(bytes),
        setThumbnailProvider: (
          provider: (() => Promise<string | null> | string | null) | null
        ) => historyRef.current?.setThumbnailProvider(provider),
        isTransactionActive: () =>
          Boolean(historyRef.current?.isTransactionActive),
        deleteStepsBeforeIndex: (idx: number) =>
          historyRef.current?.deleteStepsBeforeIndex(idx),
        deleteStepsAfterIndex: (idx: number) =>
          historyRef.current?.deleteStepsAfterIndex(idx),
        exportDocumentAtIndex: (idx: number) =>
          historyRef.current?.exportDocumentAtIndex(idx),
      },
      addAdjustmentLayer,
      addEmptyLayer,
      addImageLayer,
      createGroupLayer,
      dimensionsDocument,
      duplicateLayer,
      flipDocument,
      getLayerById,
      getOrderedLayers,
      getSelectedLayer,
      getSelectedLayerId,
      pushLayerUpdate,
      updateLayerNonUndoable,
      removeLayer,
      reorderLayer,
      reorderLayers,
      rotateDocument,
      save: () => historyRef.current?.save().catch(() => {}),
      selectLayer,
      selectLayerNonUndoable,
      setActiveTool,
      setBlendMode,
      setCanonical,
      setEphemeral,
      setLayerName,
      setOpacity,
      setRenderType,
      setZoomPercent,
      toggleGroupCollapse,
      toggleLock,
      toggleVisibility,
      ungroupLayer,
      updateAdjustmentParameters,
      updateLayer,
      // Global layer management
      addGlobalLayer,
      getGlobalLayers,
      removeGlobalLayer,
      updateGlobalLayer,
      reorderGlobalLayer,
      // Global parameters management
      setGlobalParameters,
      updateGlobalParameter,
      removeGlobalParameter,
      // Time/transport
      getPlayheadTime,
      setPlayheadTime,
      play,
      pause,
      stop,
      setLoop,
      stepToPrevKeyframe,
      stepToNextKeyframe,
      setScrubbing,
      addKeyframe,
      updateKeyframeTime,
      deleteKeyframe,
      captureChangedTracksAtPlayhead,
    }),
    [
      adjustmentPluginsMemoized,
      documentLayerDimensions,
      toolValues,
      initialToolsState,
      renderType,
      runtime,
      addAdjustmentLayer,
      addEmptyLayer,
      addImageLayer,
      createGroupLayer,
      dimensionsDocument,
      duplicateLayer,
      flipDocument,
      getLayerById,
      getOrderedLayers,
      getSelectedLayer,
      getSelectedLayerId,
      pushLayerUpdate,
      updateLayerNonUndoable,
      removeLayer,
      reorderLayer,
      reorderLayers,
      rotateDocument,
      selectLayer,
      selectLayerNonUndoable,
      setActiveTool,
      setBlendMode,
      setCanonical,
      setEphemeral,
      setLayerName,
      setOpacity,
      setZoomPercent,
      toggleGroupCollapse,
      toggleLock,
      toggleVisibility,
      ungroupLayer,
      updateAdjustmentParameters,
      updateLayer,
      // Global layer management
      getGlobalLayers,
      addGlobalLayer,
      removeGlobalLayer,
      updateGlobalLayer,
      reorderGlobalLayer,
      // Global parameters management
      setGlobalParameters,
      updateGlobalParameter,
      removeGlobalParameter,
      getPlayheadTime,
      setPlayheadTime,
      play,
      pause,
      stop,
      setLoop,
      stepToPrevKeyframe,
      stepToNextKeyframe,
      setScrubbing,
      addKeyframe,
      updateKeyframeTime,
      deleteKeyframe,
      captureChangedTracksAtPlayhead,
    ]
  )

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}
