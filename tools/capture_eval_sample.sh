#!/usr/bin/env bash
set -euo pipefail

# Capture a small evaluation stream sample after uploading/registering/injecting
# the bundled ball drop simulation/evaluation plugins.
#
# Usage:
#   EVENT_COUNT=120 BASE_URL=http://localhost:3000 ./tools/capture_eval_sample.sh
# The script will probe /status and /api/status to find the correct API base.

EVENT_COUNT="${EVENT_COUNT:-120}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
OUT_FILE="$REPO_ROOT/workspaces/ball_is_dropped/verification/eval_stream_sample.jsonl"
API_BASE=""

discover_api_base() {
  local base="${BASE_URL%/}"
  for prefix in "/api" ""; do
    local candidate="${base}${prefix}"
    if curl -fsS -o /dev/null "${candidate}/status"; then
      API_BASE="${candidate}"
      return 0
    fi
  done
  echo "Unable to reach ${BASE_URL} (tried /status and /api/status)" >&2
  return 1
}

post_json() {
  local path="$1" payload="$2"
  curl -fsS -X POST -H 'Content-Type: application/json' --data "$payload" "${API_BASE}${path}"
}

upload_file() {
  local src="$1" dest="$2"
  local content
  content="$(cat "$src")"
  post_json "/codebase/plugin" "{\"path\":\"${dest}\",\"content\":$(python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' <<<"$content"),\"overwrite\":true}" >/dev/null
  echo "uploaded ${dest}"
}

clear_systems() {
  local path="$1"
  for i in $(seq 1 150); do
    curl -fsS -X DELETE "${API_BASE}${path}/system-${i}" >/dev/null 2>&1 || true
  done
}

capture_stream() {
  local url="$1" out_path="$2" limit="$3"
  python3 - "$url" "$out_path" "$limit" <<'PY'
import json, sys, urllib.request

url = sys.argv[1]
out_path = sys.argv[2]
limit = int(sys.argv[3])

with urllib.request.urlopen(url) as resp, open(out_path, "w", encoding="utf-8") as out:
    count = 0
    for raw in resp:
        if not raw.strip():
            continue
        line = raw.decode("utf-8", "replace")
        if line.startswith("data: "):
            payload = line[6:].strip()
            out.write(json.dumps(json.loads(payload)) + "\n")
            count += 1
            if count >= limit:
                break
PY
}

main() {
  discover_api_base
  mkdir -p "$(dirname "$OUT_FILE")"

  # Best-effort clear existing systems.
  clear_systems "/simulation/system"
  clear_systems "/evaluation/system"

  # Upload plugins.
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/simulation/constants.js" "plugins/simulation/constants.js"
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/simulation/world.js" "plugins/simulation/world.js"
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/simulation/components/position.js" "plugins/simulation/components/position.js"
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/simulation/components/velocity.js" "plugins/simulation/components/velocity.js"
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/simulation/components/gravity.js" "plugins/simulation/components/gravity.js"
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/simulation/systems/server_ball_spawner.js" "plugins/simulation/systems/server_ball_spawner.js"
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/simulation/systems/server_gravity_system.js" "plugins/simulation/systems/server_gravity_system.js"
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/simulation/systems/server_motion_integration.js" "plugins/simulation/systems/server_motion_integration.js"

  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/evaluation/components/ball_drop_trace_component.js" "plugins/evaluation/components/ball_drop_trace_component.js"
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/evaluation/components/ball_drop_verdict_component.js" "plugins/evaluation/components/ball_drop_verdict_component.js"
  upload_file "$REPO_ROOT/workspaces/ball_is_dropped/src/plugins/evaluation/systems/ball_drop_verifier_v3.js" "plugins/evaluation/systems/ball_drop_verifier_v3.js"

  # Register components and inject systems.
  post_json "/simulation/component" '{"component":{"modulePath":"plugins/simulation/components/position.js"}}' >/dev/null
  post_json "/simulation/component" '{"component":{"modulePath":"plugins/simulation/components/velocity.js"}}' >/dev/null
  post_json "/simulation/component" '{"component":{"modulePath":"plugins/simulation/components/gravity.js"}}' >/dev/null
  post_json "/evaluation/component" '{"component":{"modulePath":"plugins/evaluation/components/ball_drop_trace_component.js"}}' >/dev/null
  post_json "/evaluation/component" '{"component":{"modulePath":"plugins/evaluation/components/ball_drop_verdict_component.js"}}' >/dev/null

  post_json "/simulation/system" '{"system":{"modulePath":"plugins/simulation/systems/server_ball_spawner.js"}}' >/dev/null
  post_json "/simulation/system" '{"system":{"modulePath":"plugins/simulation/systems/server_gravity_system.js"}}' >/dev/null
  post_json "/simulation/system" '{"system":{"modulePath":"plugins/simulation/systems/server_motion_integration.js"}}' >/dev/null
  post_json "/evaluation/system" '{"system":{"modulePath":"plugins/evaluation/systems/ball_drop_verifier_v3.js"}}' >/dev/null

  # Start simulation.
  post_json "/simulation/start" '{}' >/dev/null

  # Capture eval stream events.
  capture_stream "${API_BASE}/evaluation/stream" "$OUT_FILE" "$EVENT_COUNT"

  # Stop simulation.
  post_json "/simulation/stop" '{}' >/dev/null

  # Quick summary of captured evaluation outputs.
  python3 - "$OUT_FILE" <<'PY'
import json, sys

path = sys.argv[1]
verdict_events = 0
logs = []

with open(path, "r", encoding="utf-8") as fh:
    for line in fh:
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        entities = payload.get("entities", {}) or {}
        for comps in entities.values():
            if "ball_drop.verdict" in comps:
                verdict_events += 1
            if "ball_drop.log" in comps:
                logs.append(comps["ball_drop.log"])

print(f"Captured {verdict_events} events with ball_drop.verdict")
if logs:
    last = logs[-1]
    print(
        "Last log: framesInEvent="
        f"{last.get('frameCount')}, entitiesInLastFrame={last.get('entitiesInLastFrame')}, "
        f"componentIds={last.get('componentIdsLastFrame')}"
    )
else:
    print("No ball_drop.log components found; check stream or server state.")
PY

  echo "Eval stream sample written to $OUT_FILE"
}

main "$@"
