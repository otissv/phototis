export function config() {
  return {
    isDebug: process.env.NEXT_PUBLIC_IMAGE_EDITOR_DEBUG === "true",
  }
}
