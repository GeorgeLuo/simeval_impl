# Eval Verifier Playbook (spec-aligned, general)

- Resolve the API base: probe `/api/status` first, fall back to `/status` only if needed. Use that base for code uploads, component/system injects, and streams.
- Start clean: best-effort DELETE of `/api/simulation/system/system-{1..N}` and `/api/evaluation/system/system-{1..N}` (N≈150) before injecting to avoid stale systems.
- Upload/register/inject in order:
  1) `POST /api/codebase/plugin` with plugin content (modulePath relative to server root).
  2) Register components: `POST /api/simulation/component` and `POST /api/evaluation/component` with exports that include `{ id, validate }`.
  3) Inject systems: `POST /api/simulation/system` and `POST /api/evaluation/system` in the desired execution order.
- Run/stop loop: `POST /api/simulation/start` to begin; `POST /api/simulation/stop` afterward to reset ticks and clear stored frames when capturing samples.
- Frame visibility (per spec): eval systems receive full `evaluation.frame`, but the outbound eval SSE filters out `evaluation.frame`. Empty entities on the eval stream are expected unless your eval system adds components. Attach your outputs to a frame entity (or any entity) so they survive the filter.
- Emit minimal diagnostics from the verifier: a log component with `frameCount`, `entitiesInLastFrame`, and `componentIdsLastFrame`. Seeing source components (e.g., `simulation.*`) confirms frames are arriving. If counts stay zero, frames aren’t reaching eval—recheck base URL and that the sim is started.
- Streams: `/api/evaluation/stream` is filtered (eval outputs only); `/api/simulation/stream` is unfiltered. Control endpoints are POSTs for start/stop and component/system injection.
- Common pitfalls: using root endpoints instead of `/api`; expecting `evaluation.frame` to appear on the stream (it’s filtered); neglecting system clearout (stale or duplicated systems lead to confusing or empty outputs).
