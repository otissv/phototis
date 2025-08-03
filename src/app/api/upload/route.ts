import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file") as File

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  console.log("file", file)

  return NextResponse.json({ message: "File uploaded" })
}
