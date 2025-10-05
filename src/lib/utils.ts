import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { useEditorContext } from "@/lib/editor/context"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function onToolControlValueChange({
  selectedTool,
  onChange,
}: {
  selectedTool: string
  onChange: (value: number) => void
}) {
  const { toolValues } = useEditorContext()
  return (value: number) => {
    const nextValue =
      value < (toolValues[selectedTool] as any).min
        ? (toolValues[selectedTool] as any).min
        : value
    onChange(nextValue)
  }
}

export const sizes = {
  image: 25 * 1024 * 1024, // 25MB
  gif: 15 * 1024 * 1024, // 15MB
  icon: 25 * 1024 * 1024, // 25MB
}

export const mimeDb = [
  {
    type: "image",
    id: "image/jp2",
    value: "JPEG (.jp2, .jpg2, .j2k, .jpf, .jpm, .j2c, .jpc, .jpx)",
    extensions: [
      ".jp2",
      ".jpg2",
      ".j2k",
      ".jpf",
      ".jpm",
      ".j2c",
      ".jpc",
      ".jpx",
    ],
    size: sizes.image,
    signature: ["0000000C6A502020", "FF4FFF51"], // JPEG 2000 signatures
  },

  {
    type: "image",
    id: "image/raw",
    value:
      "RAW (.arw, .srw, .nef, .cr2, .cr3, .crw, .rwl, .rw2, .raw, .raf, .pef, .orf, .mrw, .dng, .sr2, .srf, .kdc, .k25, .dcr, .x3f, .erf, .3fr)",
    extensions: [
      ".arw",
      ".srw",
      ".nef",
      ".cr2",
      ".cr3",
      ".crw",
      ".rwl",
      ".rw2",
      ".raw",
      ".raf",
      ".pef",
      ".orf",
      ".mrw",
      ".dng",
      ".sr2",
      ".srf",
      ".kdc",
      ".k25",
      ".dcr",
      ".x3f",
      ".erf",
      ".3fr",
    ],
    size: sizes.image,
    signature: [
      "49492A00", // TIFF header (used by many RAW formats)
      "4D4D002A", // TIFF header (big endian)
      "43522", // Canon RAW
      "4E494B4E", // Nikon RAW
    ],
  },
  {
    type: "image",
    id: "image/jpeg",
    value: "image/jpeg (.jpg, .jpeg, .jpe)",
    extensions: [".jpg", ".jpeg", ".jpe"],
    size: sizes.image,
    signature: ["FFD8FF", "FFD8FFE0", "FFD8FFE1", "FFD8FFE8"], // JPEG signatures
  },
  {
    type: "image",
    id: "image/png",
    value: "PNG (.png)",
    extensions: [".png"],
    size: sizes.image,
    signature: ["89504E470D0A1A0A"], // PNG signature
  },
  {
    type: "image",
    id: "image/bmp",
    value: "BMP (.bmp)",
    extensions: [".bmp"],
    size: sizes.image,
    signature: ["424D"], // BMP signature
  },
  {
    type: "image",
    id: "image/heic",
    value: "HEIC/HEIF (.heic, .heif)",
    extensions: [".heic", ".heif"],
    size: sizes.image,
    signature: ["000000206674797068656963", "66747970686569"], // HEIC signatures
  },
  {
    type: "image",
    id: "image/tiff",
    value: "TIFF (.tiff, .tif)",
    extensions: [".tiff", ".tif"],
    size: sizes.image,
    signature: ["49492A00", "4D4D002A"], // TIFF signatures (little endian and big endian)
  },
  {
    type: "image",
    id: "image/webp",
    value: "WEBP (.webp)",
    extensions: [".webp"],
    size: sizes.image,
    signature: ["52494646", "57454250"], // WEBP signature
  },
  {
    type: "image",
    id: "image/avif",
    value: "AVIF (.avif)",
    extensions: [".avif"],
    size: sizes.image,
    signature: ["00000020667479706176696666"], // AVIF signature
  },
  {
    type: "image",
    id: "image/gif",
    value: "GIF (.gif)",
    extensions: [".gif"],
    size: sizes.gif, // Note: GIFs have 15MB limit, different from other images
    signature: ["474946383761", "474946383961"], // GIF87a and GIF89a signatures
  },
  {
    type: "icon",
    id: "application/x-icon",
    value: "Icon (.ico)",
    extensions: [".ico"],
    size: sizes.icon,
    signature: ["00000100"], // ICO signature
  },
]
