import { NextResponse } from "next/server"
import sharp from "sharp"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const options = JSON.parse(formData.get("options") as string)

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let image = sharp(buffer)

    // Get the base filename without extension

    if (options.format) {
      image = image.toFormat(options.format)
    }

    // Process the image
    const processedBuffer = await image.toBuffer()

    const baseFilename = file.name.replace(/\.[^/.]+$/, "")
    // Set the correct extension based on the output format
    const outputExtension = options.format || "jpeg"
    const outputFilename = `${baseFilename}.${outputExtension}`

    const processedBlob = new Blob([processedBuffer], {
      type: `image/${options.format || "jpeg"}`,
    })

    return new NextResponse(processedBlob, {
      headers: {
        "Content-Type": `image/${options.format || "jpeg"}`,
        "Content-Disposition": `attachment; filename="${outputFilename}"`,
      },
    })
  } catch (error) {
    console.error("Error processing image:", error)
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    )
  }
}
