# Ball Is Dropped — Workspace Notes

- World: a single ball is released from rest and falls under gravity.
- Phenomena tracked: release event, descent, gravitational acceleration (see `memory/phenomena/phenomena.md`).

## Layout
- `world_desc/` — world statements.
- `memory/phenomena/` — enumerated phenomena.
- `verification/` — verifier script and sample capture.
- `src/plugins/simulation/` — ECS-style components and systems for the drop.
- `src/plugins/evaluation/` — trajectory checker utilities for evaluation side.

## Quick verification loop
1. Generate a capture (sample provided at `verification/capture_sample.jsonl`; produced by a simple physics stepper).
2. Run the verifier: `./verification/verifier.sh verification/capture_sample.jsonl`.
3. Integrate with sim-eval by uploading the simulation systems/components; the stream should match the shapes seen in the sample capture (entity `ball` with `position.y`, `velocity.y`, `gravity.y`).
