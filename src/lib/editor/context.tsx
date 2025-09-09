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
  DocumentLayer,
  CanvasPosition,
} from "@/lib/editor/state"
import {
  normalizeLayers,
  createEditorRuntimeState,
  assertInvariants,
} from "@/lib/editor/state"
import { initialToolsState as defaultFilters } from "@/lib/tools/tools-state"
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
} from "@/lib/editor/commands"
import { loadDocument } from "@/lib/editor/persistence"

export type EditorContextValue = {
  state: EditorRuntimeState
  documentLayerDimensions: {
    width: number
    height: number
    size: number
    name: string
  }
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
  removeLayer: (layerId: LayerId) => void
  reorderLayer: (
    layerId: LayerId,
    to: { parentId?: LayerId | null; index: number }
  ) => void
  reorderLayers: (fromIndex: number, toIndex: number) => void
  rotateDocument: (rotation: number) => void
  selectLayer: (layerId: LayerId | null) => void
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
}: {
  children: React.ReactNode
  images: File[]
  dimensions: {
    width: number
    height: number
    size: number
    name: string
  }[]
}): React.JSX.Element {

  const documentLayerDimensions = imageDimensions.sort((a, b) => b.size- a.size )[0] || { width: 800, height: 600, size: 800 * 600, name: "Document" }
 
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
        filters: {
          ...defaultFilters,
          dimensions: {
            width: dimensions?.width || 1,
            height: dimensions?.height || 1,
            x: 0,
            y: 0,
          },
          crop: {
            ...defaultFilters.crop,
            width: dimensions?.width || 1,
            height: dimensions?.height || 1,
          },
        },
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
      filters: { ...defaultFilters },
      opacity: 100,
      blendMode: "normal",
    }

    const layers = normalizeLayers([...initialLayers, documentLayer])
    const canonical: CanonicalEditorState = { 
      ...base.canonical, 
      layers,
      document: {
        ...base.canonical.document,
        width: documentWidth,
        height: documentHeight,
      }
    }
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
    (files: File | File[]) => {
      const fileArray = Array.isArray(files) ? files : [files]
      const imageFiles = fileArray.filter(file => file.type.startsWith("image/"))
      
      if (imageFiles.length === 0) {
        console.warn("No valid image files provided")
        return
      }

      const transactionName = imageFiles.length === 1 
        ? "Add Image Layer" 
        : `Add ${imageFiles.length} Image Layers`

      historyRef.current?.beginTransaction(transactionName)
      
      const newLayers: ImageLayer[] = imageFiles.map((file, index) => ({
        id: `layer-${Date.now()}-${index}`,
        name: file.name || `Layer ${runtime.canonical.layers.order.length + index + 1}`,
        visible: true,
        locked: false,
        type: "image",
        filters: { ...defaultFilters },
        opacity: 100,
        isEmpty: false,
        image: file,
        blendMode: "normal",
      }))

      // Add all layers
      newLayers.forEach(layer => {
        historyRef.current?.push(new AddLayerCommand(layer, "top"))
      })

      // Select the first new layer
      if (newLayers.length > 0) {
        historyRef.current?.push(new SetSelectionCommand([newLayers[0].id]))
      }

      historyRef.current?.endTransaction(true)
    },
    [runtime.canonical.layers.order.length]
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

  const addAdjustmentLayer = React.useCallback(
    (
      adjustmentType: string,
      parameters: Record<string, number | { value: number; color: string }>,
      position: "top" | "bottom" | number = "top"
    ) => {
      const h = historyRef.current
      if (!h) return
      h.beginTransaction("Add Adjustment Layer")
      const id = `adjustment-${Date.now()}`
      const cmd = new AddAdjustmentLayerCommand(
        adjustmentType,
        parameters,
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

    // Compute next viewport rotation (normalize to [0, 360))
    const prevViewportRotation = (canonicalRef.current.viewport as any)
      .rotation as number | undefined
    const safePrev = Number.isFinite(prevViewportRotation)
      ? (prevViewportRotation as number)
      : 0
    const nextViewportRotation = ((safePrev + rotation + 360) % 360) as number

    // Group both operations as one user action for undo/redo
    const h = historyRef.current
    if (!h) return
    h.beginTransaction(`Rotate Document ${rotation > 0 ? "+" : ""}${rotation}°`)
    h.push(new DocumentRotateCommand(rotation, previousRotations))
    h.push(new SetViewportCommand({ rotation: nextViewportRotation }))
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
      documentLayerDimensions,
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
      addAdjustmentLayer,
      addEmptyLayer,
      addImageLayer,
      duplicateLayer,
      flipDocument,
      dimensionsDocument,
      getLayerById,
      getOrderedLayers,
      getSelectedLayer,
      getSelectedLayerId,
      pushLayerUpdate,
      removeLayer,
      reorderLayer,
      reorderLayers,
      rotateDocument,
      save: () => historyRef.current?.save().catch(() => {}),
      selectLayer,
      setActiveTool,
      setBlendMode,
      setCanonical,
      setEphemeral,
      setLayerName,
      setOpacity,
      setZoomPercent,
      toggleLock,
      toggleVisibility,
      updateAdjustmentParameters,
      updateLayer,
      createGroupLayer,
      ungroupLayer,
      toggleGroupCollapse,
    }),
    [
      runtime,
      documentLayerDimensions,
      addAdjustmentLayer,
      addEmptyLayer,
      addImageLayer,
      duplicateLayer,
      flipDocument,
      dimensionsDocument,
      getLayerById,
      getOrderedLayers,
      getSelectedLayer,
      getSelectedLayerId,
      pushLayerUpdate,
      removeLayer,
      reorderLayer,
      reorderLayers,
      rotateDocument,
      selectLayer,
      setActiveTool,
      setBlendMode,
      setCanonical,

      setEphemeral,
      setLayerName,
      setOpacity,
      setZoomPercent,
      toggleLock,
      toggleVisibility,
      updateAdjustmentParameters,
      updateLayer,
      createGroupLayer,
      ungroupLayer,
      toggleGroupCollapse,
    ]
  )

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}
