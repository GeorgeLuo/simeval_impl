#!/usr/bin/env bash
set -euo pipefail

# Ball drop verifier: checks release, descent, and gravitational acceleration for the captured stream.
# Usage: ./verification/verifier.sh <capture-file>  # defaults to capture.jsonl next to script

INPUT_PATH="${1:-$(dirname "$0")/capture.jsonl}"

python3 - "$INPUT_PATH" <<'PY'
import json
import math
import sys
from pathlib import Path
from statistics import median

input_path = Path(sys.argv[1])
if not input_path.exists():
    print(f"[error] capture file not found: {input_path}", file=sys.stderr)
    sys.exit(2)


def load_frames(text: str):
    # Try JSON array first.
    try:
        obj = json.loads(text)
    except Exception:
        obj = None
    if isinstance(obj, list):
        return obj
    if isinstance(obj, dict):
        if isinstance(obj.get("frames"), list):
            return obj["frames"]
    # Fall back to NDJSON.
    frames = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            frames.append(json.loads(line))
        except Exception:
            continue
    return frames


def coerce_time(frame, default_idx: int):
    for key in ("time", "timestamp", "tick", "frame", "t"):
        val = frame.get(key)
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            try:
                return float(val)
            except Exception:
                continue
    return float(default_idx)


def extract_entities(frame):
    raw_entities = []
    entities_field = frame.get("entities")

    # Common case: array of entity objects.
    if isinstance(entities_field, list):
        raw_entities = entities_field
    # SimEval stream shape: map of entityId -> components.
    elif isinstance(entities_field, dict):
        for ent_id, comps in entities_field.items():
            raw_entities.append({"id": ent_id, "components": comps})
    # Nested under "state" for some emitters.
    elif isinstance(frame.get("state"), dict) and isinstance(frame["state"].get("entities"), list):
        raw_entities = frame["state"]["entities"]

    entities = []
    for ent in raw_entities:
        comps = {}
        raw_comps = ent.get("components", {})
        if isinstance(raw_comps, dict):
            comps = raw_comps
        elif isinstance(raw_comps, list):
            for item in raw_comps:
                if not isinstance(item, dict):
                    continue
                ctype = item.get("type") or item.get("name")
                cval = item.get("value")
                if cval is None:
                    cval = {k: v for k, v in item.items() if k not in ("type", "name")}
                if ctype:
                    comps[ctype] = cval
        entities.append(
            {
                "id": ent.get("id") or ent.get("entityId") or ent.get("name") or ent.get("label"),
                "name": ent.get("name") or ent.get("label"),
                "components": comps,
            }
        )
    return entities


def to_float(val):
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str):
        try:
            return float(val)
        except Exception:
            return None
    return None


def extract_axes_from_value(val):
    if isinstance(val, dict):
        lowered = {k.lower(): k for k in val}
        axes = {}
        for axis in ("x", "y", "z"):
            if axis in lowered:
                axes[axis] = val[lowered[axis]]
        for axis in ("height", "h"):
            if axis in lowered:
                axes["height"] = val[lowered[axis]]
        if axes:
            return axes
        for nested_key in ("position", "pos", "translation", "origin", "value", "vector", "coords", "coordinate"):
            if nested_key in lowered:
                nested = val[lowered[nested_key]]
                nested_axes = extract_axes_from_value(nested)
                if nested_axes:
                    return nested_axes
        return {}
    if isinstance(val, (list, tuple)):
        axes = {}
        if len(val) > 0:
            axes["x"] = val[0]
        if len(val) > 1:
            axes["y"] = val[1]
        if len(val) > 2:
            axes["z"] = val[2]
        return axes
    return {}


POSITION_COMPONENT_HINTS = (
    "position",
    "transform",
    "translation",
    "location",
    "pose",
    "spatial",
    "coords",
    "coordinate",
)


def extract_position_axes(components: dict):
    axes = {}
    for ctype, cval in components.items():
        if not isinstance(ctype, str):
            continue
        lowered = ctype.lower()
        if any(hint in lowered for hint in POSITION_COMPONENT_HINTS):
            extracted = extract_axes_from_value(cval)
            axes.update(extracted)
    # Fallback: pick the first vector-like component if no position-specific component was found.
    if not axes:
        for cval in components.values():
            extracted = extract_axes_from_value(cval)
            if extracted:
                axes.update(extracted)
                break
    # Convert to floats where possible.
    return {k: to_float(v) for k, v in axes.items() if to_float(v) is not None}


def has_ball_hint(ent):
    for candidate in (ent.get("name"), ent.get("id")):
        if isinstance(candidate, str) and "ball" in candidate.lower():
            return True
    for ctype in ent.get("components", {}):
        if isinstance(ctype, str) and "ball" in ctype.lower():
            return True
    return False


raw_text = input_path.read_text()
frames = load_frames(raw_text)
if not frames:
    print("[error] no frames parsed from capture", file=sys.stderr)
    sys.exit(2)

frame_records = []
for idx, frame in enumerate(frames):
    if not isinstance(frame, dict):
        continue
    t = coerce_time(frame, idx)
    entities = extract_entities(frame)
    frame_records.append({"time": t, "entities": entities})

if not frame_records:
    print("[error] frames lacked readable entities", file=sys.stderr)
    sys.exit(2)

# Collect per-entity vertical traces.
entity_traces = {}
for frame in frame_records:
    t = frame["time"]
    for ent in frame["entities"]:
        components = ent.get("components") or {}
        axes = extract_position_axes(components)
        if not axes:
            continue
        eid = ent.get("id") or ent.get("name")
        if not eid:
            continue
        rec = entity_traces.setdefault(
            eid,
            {
                "name": ent.get("name"),
                "ball_hint": has_ball_hint(ent),
                "positions": {"y": [], "z": [], "height": []},
            },
        )
        for axis in ("y", "z", "height"):
            if axis in axes and axes[axis] is not None:
                rec["positions"][axis].append((t, float(axes[axis])))

def pick_axis(rec):
    best_axis = None
    best_score = (-1, -1.0)
    for axis, seq in rec["positions"].items():
        if len(seq) < 3:
            continue
        seq_sorted = sorted(seq, key=lambda x: x[0])
        vals = [v for _, v in seq_sorted]
        span = max(vals) - min(vals)
        score = (len(vals), span)
        if score > best_score:
            best_score = score
            best_axis = (axis, seq_sorted)
    return best_axis


candidates = []
for eid, rec in entity_traces.items():
    picked = pick_axis(rec)
    if not picked:
        continue
    axis, seq = picked
    vals = [v for _, v in seq]
    drop = vals[0] - vals[-1]
    span = max(vals) - min(vals)
    candidates.append(
        {
            "id": eid,
            "name": rec.get("name"),
            "axis": axis,
            "seq": seq,
            "drop": drop,
            "span": span,
            "ball_hint": rec["ball_hint"],
        }
    )

if not candidates:
    print("[error] no entity with usable position trace found", file=sys.stderr)
    sys.exit(2)

def candidate_sort_key(c):
    return (
        1 if c["ball_hint"] else 0,
        1 if c["drop"] > 0 else 0,
        c["span"],
        len(c["seq"]),
    )


ball = sorted(candidates, key=candidate_sort_key, reverse=True)[0]
times = [t for t, _ in ball["seq"]]
positions = [p for _, p in ball["seq"]]

def tolerance(values, base=0.02, floor=1e-6):
    if not values:
        return floor
    span = max(values) - min(values)
    return max(floor, abs(span) * base)


def compute_velocities(times_list, pos_list):
    velocities = []
    for i in range(1, len(pos_list)):
        dt = times_list[i] - times_list[i - 1]
        if dt == 0:
            dt = 1.0
        velocities.append((pos_list[i] - pos_list[i - 1]) / dt)
    return velocities


velocities = compute_velocities(times, positions)
pos_tol = tolerance(positions, base=0.01)
vel_tol = tolerance(velocities, base=0.05)

# Detect release: first velocity meaningfully negative after a low-velocity period.
release_index = None  # index into positions
rest_window = min(3, len(velocities)) or 1
rest_level = sum(abs(v) for v in velocities[:rest_window]) / rest_window
threshold = max(vel_tol, rest_level * 2, 1e-6)
for i, v in enumerate(velocities):
    if v < -threshold:
        release_index = i  # velocity is between positions i and i+1
        break

results = []

if release_index is None:
    results.append((False, "Release event not found (no downward velocity spike detected)"))
    release_index = 0  # fall back to start for downstream checks
else:
    results.append((True, f"Release event detected between frames {release_index} and {release_index + 1}"))

# Descent: mostly monotonic decrease after release.
down_steps = 0
non_down_steps = 0
plateaus = 0
for i in range(release_index + 1, len(positions)):
    delta = positions[i] - positions[i - 1]
    if delta < -pos_tol:
        down_steps += 1
    elif abs(delta) <= pos_tol:
        plateaus += 1
    else:
        non_down_steps += 1

total_steps = max(1, len(positions) - (release_index + 1))
down_fraction = down_steps / total_steps

if down_steps == 0:
    results.append((False, "Descent check failed: no downward steps after release"))
elif non_down_steps > max(1, total_steps // 5):
    results.append(
        (
            False,
            f"Descent check failed: {non_down_steps} upward steps vs {down_steps} downward (tol={pos_tol:.4g})",
        )
    )
else:
    results.append(
        (
            True,
            f"Descent confirmed: {down_steps} downward, {plateaus} plateau, {non_down_steps} upward steps "
            f"(down fraction {down_fraction:.2f})",
        )
    )

# Gravitational acceleration: velocities become more negative after release.
vel_post_release = velocities[release_index:]
accel_steps = []
for i in range(1, len(vel_post_release)):
    dv = vel_post_release[i] - vel_post_release[i - 1]
    accel_steps.append(dv)

if len(vel_post_release) < 2:
    results.append((False, "Acceleration check inconclusive: insufficient velocity samples after release"))
else:
    accel_tol = tolerance(accel_steps, base=0.1)
    negative_accel = sum(1 for dv in accel_steps if dv < -accel_tol)
    positive_accel = sum(1 for dv in accel_steps if dv > accel_tol)
    if negative_accel == 0:
        results.append(
            (
                False,
                "Acceleration check failed: velocities are not becoming more negative after release",
            )
        )
    elif positive_accel > max(1, len(accel_steps) // 4):
        results.append(
            (
                False,
                f"Acceleration mixed: {negative_accel} negative vs {positive_accel} positive delta-v "
                f"(tol={accel_tol:.4g})",
            )
        )
    else:
        results.append(
            (
                True,
                f"Acceleration confirmed: velocities trending downward ({negative_accel} negative delta-v,"
                f" {positive_accel} positive)",
            )
        )

all_pass = all(r[0] for r in results)

header = (
    f"[trace] using entity '{ball['name'] or ball['id']}' "
    f"(id={ball['id']}, axis={ball['axis']}, samples={len(positions)})"
)
print(header)
print(f"[stats] initial height={positions[0]:.4g}, final height={positions[-1]:.4g}, drop={ball['drop']:.4g}")
print(f"[stats] velocity min={min(velocities):.4g} max={max(velocities):.4g} tol={vel_tol:.4g}")

for ok, msg in results:
    prefix = "[PASS]" if ok else "[FAIL]"
    print(f"{prefix} {msg}")

if not all_pass:
    sys.exit(1)
PY
