#!/usr/bin/env bash
set -euo pipefail

# Upload and register the ball_is_dropped plugins to a sim-eval server.
# Usage: ./tools/upload.sh [base_url]
# Default base_url: http://localhost:3000
# The script will probe /status and /api/status to find the correct API base.

RAW_BASE="${1:-http://localhost:3000}"
BASE_URL="${RAW_BASE%/}"
API_BASE=""

repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

ROOT="$(repo_root)"

discover_api_base() {
  for prefix in "/api" ""; do
    local candidate="${BASE_URL}${prefix}"
    if curl -fsS -o /dev/null "${candidate}/status"; then
      API_BASE="${candidate}"
      return 0
    fi
  done
  echo "Unable to reach ${BASE_URL} (tried /status and /api/status)" >&2
  return 1
}

post_json() {
  local path="$1"
  local json="$2"
  curl -fsS -X POST "${API_BASE}${path}" \
    -H "Content-Type: application/json" \
    --data "${json}"
}

upload_file() {
  local src="$1"
  local dest="$2"
  local content
  content="$(cat "${src}")"
  post_json "/codebase/plugin" "{\"path\":\"${dest}\",\"content\":$(python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' <<<"${content}"),\"overwrite\":true}" >/dev/null
  echo "uploaded ${dest}"
}

register_component() {
  local endpoint="$1"
  local module_path="$2"
  post_json "${endpoint}" "{\"component\":{\"modulePath\":\"${module_path}\"}}" >/dev/null
  echo "registered component ${module_path}"
}

inject_system() {
  local endpoint="$1"
  local module_path="$2"
  post_json "${endpoint}" "{\"system\":{\"modulePath\":\"${module_path}\"}}" >/dev/null
  echo "injected system ${module_path}"
}

clear_systems() {
  local endpoint="$1"
  local label="$2"
  # brute force ejection of system-1..150 to ensure a clean slate
  for i in $(seq 1 150); do
    curl -fsS -X DELETE "${API_BASE}${endpoint}/system-${i}" >/dev/null 2>&1 || true
  done
  echo "cleared ${label} systems (best-effort)"
}

SIM_FILES=(
  "workspaces/ball_is_dropped/src/plugins/simulation/constants.js:plugins/simulation/constants.js"
  "workspaces/ball_is_dropped/src/plugins/simulation/world.js:plugins/simulation/world.js"
  "workspaces/ball_is_dropped/src/plugins/simulation/components/position.js:plugins/simulation/components/position.js"
  "workspaces/ball_is_dropped/src/plugins/simulation/components/velocity.js:plugins/simulation/components/velocity.js"
  "workspaces/ball_is_dropped/src/plugins/simulation/components/gravity.js:plugins/simulation/components/gravity.js"
  "workspaces/ball_is_dropped/src/plugins/simulation/systems/server_ball_spawner.js:plugins/simulation/systems/server_ball_spawner.js"
  "workspaces/ball_is_dropped/src/plugins/simulation/systems/server_gravity_system.js:plugins/simulation/systems/server_gravity_system.js"
  "workspaces/ball_is_dropped/src/plugins/simulation/systems/server_motion_integration.js:plugins/simulation/systems/server_motion_integration.js"
)

EVAL_FILES=(
  "workspaces/ball_is_dropped/src/plugins/evaluation/components/ball_drop_trace_component.js:plugins/evaluation/components/ball_drop_trace_component.js"
  "workspaces/ball_is_dropped/src/plugins/evaluation/components/ball_drop_verdict_component.js:plugins/evaluation/components/ball_drop_verdict_component.js"
  "workspaces/ball_is_dropped/src/plugins/evaluation/systems/ball_drop_verifier_v3.js:plugins/evaluation/systems/ball_drop_verifier_v3.js"
)

discover_api_base

# Ensure clean system lists before uploading/injecting.
clear_systems "/simulation/system" "simulation"
clear_systems "/evaluation/system" "evaluation"

echo "Uploading simulation plugins to ${API_BASE}..."
for entry in "${SIM_FILES[@]}"; do
  IFS=":" read -r src dest <<<"${entry}"
  upload_file "${ROOT}/${src}" "${dest}"
done

echo "Uploading evaluation plugins to ${API_BASE}..."
for entry in "${EVAL_FILES[@]}"; do
  IFS=":" read -r src dest <<<"${entry}"
  upload_file "${ROOT}/${src}" "${dest}"
done

echo "Registering simulation components..."
register_component "/simulation/component" "plugins/simulation/components/position.js"
register_component "/simulation/component" "plugins/simulation/components/velocity.js"
register_component "/simulation/component" "plugins/simulation/components/gravity.js"

echo "Injecting simulation systems..."
inject_system "/simulation/system" "plugins/simulation/systems/server_ball_spawner.js"
inject_system "/simulation/system" "plugins/simulation/systems/server_gravity_system.js"
inject_system "/simulation/system" "plugins/simulation/systems/server_motion_integration.js"

echo "Registering evaluation components..."
register_component "/evaluation/component" "plugins/evaluation/components/ball_drop_trace_component.js"
register_component "/evaluation/component" "plugins/evaluation/components/ball_drop_verdict_component.js"

echo "Injecting evaluation systems..."
inject_system "/evaluation/system" "plugins/evaluation/systems/ball_drop_verifier_v3.js"

echo "Upload and injection complete."
