Fully implement step 2 without falling backs, legacy demo broken code, or any other issues.

Step 2: Basic Timeline UI
Goal: Add a minimal timeline panel with playhead and transport.
Scope:
src/components/timeline/timeline-panel.tsx - Main timeline component
src/components/timeline/playhead-control.tsx - Draggable playhead
src/components/timeline/transport-controls.tsx - Play/pause/stop/loop
src/components/timeline/time-display.tsx - Current time and duration
src/components/panels.tsx - Add timeline to main UI
src/lib/editor/context.tsx - Timeline state management
Implementation:
Acceptance Criteria:
Timeline panel visible in the UI
Playhead scrubbing updates canvas in real time
Transport controls work (play/pause/stop)
Time display shows current time
Scrubbing is smooth and responsive
No performance issues during scrubbing
