# ADR 001: Isolate YouTube assumptions

Status: Accepted

Selectors, runtime config discovery, InnerTube guards, thumbnail builders, and player accessors live under `src/platform/`. Feature code consumes typed contracts. This keeps response-shape drift localized and testable.
