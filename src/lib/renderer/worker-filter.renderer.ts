// Filter Worker: applies heavy filters using OffscreenCanvas 2D (with context.filter) or simple kernels
// Receives ImageBitmap + parameters, returns processed ImageBitmap (transferable)

interface WorkerMessage {
  type: string
  id: string
  data?: any
}

interface SuccessMessage {
  type: "success"
  id: string
  data?: any
}

interface ErrorMessage {
  type: "error"
  id: string
  error: string
}

interface ProgressMessage {
  type: "progress"
  id: string
  progress: number
}

// Build CSS filter string from parameters in the editor's tool schema
function buildCssFilter(params: any): string {
  const parts: string[] = []
  // Brightness: editor uses 0-100, CSS expects % where 100% is normal
  if (typeof params.brightness === "number") {
    parts.push(`brightness(${Math.max(0, params.brightness)}%)`)
  }
  if (typeof params.contrast === "number") {
    parts.push(`contrast(${Math.max(0, params.contrast)}%)`)
  }
  if (typeof params.saturation === "number") {
    parts.push(`saturate(${Math.max(0, params.saturation)}%)`)
  }
  if (typeof params.hue === "number") {
    parts.push(`hue-rotate(${params.hue}deg)`)
  }
  if (typeof params.grayscale === "number" && params.grayscale > 0) {
    parts.push(`grayscale(${Math.min(100, Math.max(0, params.grayscale))}%)`)
  }
  if (typeof params.sepia === "number" && params.sepia > 0) {
    parts.push(`sepia(${Math.min(100, Math.max(0, params.sepia))}%)`)
  }
  if (typeof params.invert === "number" && params.invert > 0) {
    parts.push(`invert(${Math.min(100, Math.max(0, params.invert))}%)`)
  }
  if (typeof params.blur === "number" && params.blur > 0) {
    // blur is 0-100; use up to 12px for preview
    const radiusPx = Math.min(12, Math.max(0, params.blur * 0.12))
    parts.push(`blur(${radiusPx}px)`)
  }
  return parts.join(" ")
}

async function applyFilterToBitmap(
  bitmap: ImageBitmap,
  params: any
): Promise<ImageBitmap> {
  const off = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = off.getContext("2d")
  if (!ctx) {
    return bitmap
  }
  // Use CSS-like filters where possible
  ;(ctx as any).filter = buildCssFilter(params)
  ctx.drawImage(bitmap, 0, 0)
  // Create ImageBitmap to transfer back without readback
  const out = off.transferToImageBitmap()
  try {
    if (typeof (bitmap as any).close === "function") (bitmap as any).close()
  } catch {}
  return out
}

self.onmessage = async (event: MessageEvent) => {
  const message: WorkerMessage = event.data
  try {
    switch (message.type) {
      case "initialize": {
        // No-op for now; 2D canvas created per task
        const ok: SuccessMessage = { type: "success", id: message.id }
        postMessage(ok)
        break
      }
      case "applyFilter": {
        const { imageData, parameters } = message.data || {}
        if (!imageData || !(imageData instanceof ImageBitmap)) {
          const err: ErrorMessage = {
            type: "error",
            id: message.id,
            error: "Missing or invalid ImageBitmap",
          }
          postMessage(err)
          return
        }
        // Progress start
        postMessage({
          type: "progress",
          id: message.id,
          progress: 10,
        } as ProgressMessage)
        const result = await applyFilterToBitmap(
          imageData as ImageBitmap,
          parameters
        )
        // Post success with transferable bitmap
        const msg: SuccessMessage = {
          type: "success",
          id: message.id,
          data: { imageData: result },
        }
        // ImageBitmap is transferable implicitly; still pass in transfer list for clarity
        // @ts-ignore TS doesn't know ImageBitmap in transfer list here
        postMessage(msg, [result])
        break
      }
      default: {
        const err: ErrorMessage = {
          type: "error",
          id: message.id,
          error: `Unknown message type: ${message.type}`,
        }
        postMessage(err)
      }
    }
  } catch (e) {
    const err: ErrorMessage = {
      type: "error",
      id: message.id,
      error: e instanceof Error ? e.message : "Unknown error",
    }
    postMessage(err)
  }
}
