// Facade for timeline serialization to keep imports stable and enable versioned evolutions.
// Re-exports the canonical serializer/deserializer and schema version.

export {
  ANIMATION_SCHEMA_VERSION as TIMELINE_SCHEMA_VERSION,
  type SerializableTimeline,
  type Timeline,
  serializeTimeline,
  deserializeTimeline,
} from "@/lib/animation/model"
