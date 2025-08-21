"use client"

import React from "react"

import type {
  EditorRuntimeState,
  CanonicalEditorState,
  EditorLayer,
  ImageLayer,
  LayerId,
  ViewportModel,
  ActiveToolModel,
  EphemeralEditorState,
} from "@/lib/editor/state"
import {
  normalizeLayers,
  createEditorRuntimeState,
  addLayer as addLayerCanonical,
  removeLayer as removeLayerCanonical,
  reorderLayer as reorderLayerCanonical,
  setSelection as setSelectionCanonical,
  updateLayer as updateLayerCanonical,
  setViewport as setViewportCanonical,
  assertInvariants,
} from "@/lib/editor/state"
import { initialState as defaultFilters } from "@/lib/state.image-editor"
import { HistoryManager, type Command } from "@/lib/editor/history"
import {
  AddLayerCommand,
  RemoveLayerCommand,
  ReorderLayersCommand,
  UpdateLayerCommand,
  SetSelectionCommand,
  SetViewportCommand,
  SetActiveToolCommand,
  AddAdjustmentLayerCommand,
  UpdateAdjustmentParametersCommand,
} from "@/lib/editor/commands"
import { loadDocument } from "@/lib/editor/persistence"

type EditorContextValue = {
  state: EditorRuntimeState
  setCanonical: (
    updater: (s: CanonicalEditorState) => CanonicalEditorState
  ) => void
  setEphemeral: (
    updater: (s: EphemeralEditorState) => EphemeralEditorState
  ) => void
  getOrderedLayers: () => EditorLayer[]
  getSelectedLayerId: () => LayerId | null
  getSelectedLayer: () => EditorLayer | null
  selectLayer: (layerId: LayerId | null) => void
  addEmptyLayer: () => void
  addImageLayer: (file: File) => void
  removeLayer: (layerId: LayerId) => void
  duplicateLayer: (layerId: LayerId) => void
  reorderLayers: (fromIndex: number, toIndex: number) => void
  updateLayer: (
    layerId: LayerId,
    update: Partial<Omit<EditorLayer, "id">>
  ) => void
  pushLayerUpdate: (
    layerId: LayerId,
    update: Partial<Omit<EditorLayer, "id">>
  ) => void
  addAdjustmentLayer: (
    adjustmentType: string,
    parameters: Record<string, number>,
    position: "top" | "bottom" | number
  ) => void
  updateAdjustmentParameters: (
    layerId: LayerId,
    parameters: Record<string, number>
  ) => void
  setBlendMode: (layerId: LayerId, blendMode: EditorLayer["blendMode"]) => void
  setOpacity: (layerId: LayerId, opacity: number) => void
  setLayerName: (layerId: LayerId, name: string) => void
  toggleVisibility: (layerId: LayerId) => void
  toggleLock: (layerId: LayerId) => void
  setActiveTool: (active: ActiveToolModel) => void
  setZoomPercent: (zoom: number) => void
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
    addCheckpoint?: (name: string) => void
    jumpToCheckpoint?: (id: string) => void
    clearHistory?: () => void
    clearRedo?: () => void
    setMaxBytes?: (bytes: number) => void
    setThumbnailProvider?: (
      provider: (() => Promise<string | null> | string | null) | null
    ) => void
    isTransactionActive?: () => boolean
    deleteStepsBeforeIndex?: (idx: number) => void
    deleteStepsAfterIndex?: (idx: number) => void
    exportDocumentAtIndex?: (idx: number) => any
  }
}

const EditorContext = React.createContext<EditorContextValue | null>(null)

export function useEditorContext(): EditorContextValue {
  const ctx = React.useContext(EditorContext)
  if (!ctx) throw new Error("EditorContext not available")
  return ctx
}

export function EditorProvider({
  children,
  initialImage,
}: {
  children: React.ReactNode
  initialImage: File | null
}): React.JSX.Element {
  const [runtime, setRuntime] = React.useState<EditorRuntimeState>(() => {
    const base = createEditorRuntimeState({
      activeTool: { sidebar: "rotate", tool: "rotate" } as ActiveToolModel,
    })

    const baseLayer: ImageLayer = {
      id: "layer-1",
      name: "Layer 1",
      visible: true,
      locked: false,
      type: "image",
      filters: { ...defaultFilters },
      opacity: 100,
      isEmpty: !initialImage,
      blendMode: "normal",
      image: initialImage ?? undefined,
    }

    const layers = normalizeLayers([baseLayer])
    const canonical: CanonicalEditorState = { ...base.canonical, layers }
    const result = { canonical, ephemeral: base.ephemeral }
    assertInvariants(canonical)
    return result
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

  // Load persisted document (if available) once
  React.useEffect(() => {
    ;(async () => {
      try {
        const saved = await loadDocument("phototis:editor")
        if (saved) {
          // Replace canonical state with persisted and rehydrate history
          setRuntime((prev) => ({ ...prev, canonical: saved.state }))
          historyRef.current?.rehydrate(saved.history)
        }
      } catch (e) {
        console.warn("Failed to load persisted document", e)
      }
    })()
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

  const addEmptyLayer = React.useCallback(() => {
    const newLayer: ImageLayer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${runtime.canonical.layers.order.length + 1}`,
      visible: true,
      locked: false,
      type: "image",
      filters: { ...defaultFilters },
      opacity: 100,
      isEmpty: true,
      blendMode: "normal",
    }
    historyRef.current?.beginTransaction("Add Layer")
    historyRef.current?.push(new AddLayerCommand(newLayer, "top"))
    historyRef.current?.push(new SetSelectionCommand([newLayer.id]))
    historyRef.current?.endTransaction(true)
  }, [runtime.canonical.layers.order.length])

  const addImageLayer = React.useCallback(
    (file: File) => {
      const newLayer: ImageLayer = {
        id: `layer-${Date.now()}`,
        name: file.name || `Layer ${runtime.canonical.layers.order.length + 1}`,
        visible: true,
        locked: false,
        type: "image",
        filters: { ...defaultFilters },
        opacity: 100,
        isEmpty: false,
        image: file,
        blendMode: "normal",
      }
      historyRef.current?.beginTransaction("Add Image Layer")
      historyRef.current?.push(new AddLayerCommand(newLayer, "top"))
      historyRef.current?.push(new SetSelectionCommand([newLayer.id]))
      historyRef.current?.endTransaction(true)
    },
    [runtime.canonical.layers.order.length]
  )

  const removeLayer = React.useCallback((layerId: LayerId) => {
    historyRef.current?.execute(new RemoveLayerCommand(layerId))
  }, [])

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

  const addAdjustmentLayer = React.useCallback(
    (
      adjustmentType: string,
      parameters: Record<string, number | { value: number; color: string }>,
      position: "top" | "bottom" | number = "top"
    ) => {
      historyRef.current?.beginTransaction("Add Adjustment Layer")
      historyRef.current?.push(
        new AddAdjustmentLayerCommand(adjustmentType, parameters, position)
      )
      historyRef.current?.endTransaction(true)
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

  const value: EditorContextValue = React.useMemo(
    () => ({
      state: runtime,
      setCanonical,
      setEphemeral,
      getOrderedLayers,
      getSelectedLayerId,
      getSelectedLayer,
      selectLayer,
      addEmptyLayer,
      addImageLayer,
      removeLayer,
      duplicateLayer,
      reorderLayers,
      updateLayer,
      pushLayerUpdate,
      addAdjustmentLayer,
      updateAdjustmentParameters,
      setBlendMode,
      setOpacity,
      setLayerName,
      toggleVisibility,
      toggleLock,
      setActiveTool,
      setZoomPercent,
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
      save: () => historyRef.current?.save().catch(() => {}),
    }),
    [
      runtime,
      setCanonical,
      setEphemeral,
      getOrderedLayers,
      getSelectedLayerId,
      getSelectedLayer,
      selectLayer,
      addEmptyLayer,
      addImageLayer,
      removeLayer,
      duplicateLayer,
      reorderLayers,
      updateLayer,
      pushLayerUpdate,
      addAdjustmentLayer,
      updateAdjustmentParameters,
      setBlendMode,
      setOpacity,
      setLayerName,
      toggleVisibility,
      toggleLock,
      setActiveTool,
      setZoomPercent,
    ]
  )

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}
