declare global {
  interface Window {
    $state?: import("../lib/editor/state").CanonicalEditorState | null
  }
}

export {}
