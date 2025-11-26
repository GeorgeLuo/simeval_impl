const VerticalTrace = require("../components/trace");

function normalizeFrames(rawFrames) {
  if (!rawFrames) return [];
  if (Array.isArray(rawFrames)) return rawFrames;
  if (typeof rawFrames === "string") {
    const frames = [];
    for (const line of rawFrames.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        frames.push(JSON.parse(trimmed));
      } catch (err) {
        continue;
      }
    }
    return frames;
  }
  if (Array.isArray(rawFrames.frames)) {
    return rawFrames.frames;
  }
  return [];
}

function extractEntities(frame) {
  const result = [];
  if (Array.isArray(frame.entities)) {
    for (const ent of frame.entities) {
      result.push({
        id: ent.id || ent.entityId || ent.name,
        name: ent.name || ent.label || ent.id,
        components: ent.components || {},
      });
    }
    return result;
  }
  if (frame.entities && typeof frame.entities === "object") {
    for (const [id, comps] of Object.entries(frame.entities)) {
      result.push({ id, name: id, components: comps });
    }
  }
  return result;
}

const POSITION_HINTS = [
  "position",
  "transform",
  "translation",
  "location",
  "pose",
  "spatial",
  "coords",
  "coordinate",
];

function extractAxesFromValue(val) {
  if (!val || typeof val !== "object") return {};
  const axes = {};
  if (Array.isArray(val)) {
    if (val.length > 0 && typeof val[0] === "number") axes.x = val[0];
    if (val.length > 1 && typeof val[1] === "number") axes.y = val[1];
    if (val.length > 2 && typeof val[2] === "number") axes.z = val[2];
    return axes;
  }
  for (const [key, maybeVal] of Object.entries(val)) {
    const lower = key.toLowerCase();
    if (["x", "y", "z", "height"].includes(lower) && typeof maybeVal === "number") {
      axes[lower] = maybeVal;
    }
  }
  return axes;
}

function extractPositionAxes(components) {
  const candidates = [];
  for (const [ctype, cval] of Object.entries(components || {})) {
    const lowered = ctype.toLowerCase();
    const axes = extractAxesFromValue(cval);
    if (!Object.keys(axes).length) continue;
    const hasHint = POSITION_HINTS.some((hint) => lowered.includes(hint));
    const weight = hasHint ? 2 : lowered.includes("velocity") ? 1 : 0;
    candidates.push({ axes, weight });
  }
  if (!candidates.length) return {};
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0].axes;
}

function selectBallEntity(entities) {
  if (!entities.length) return null;
  const scored = entities.map((ent) => {
    const name = (ent.name || ent.id || "").toLowerCase();
    const hasBall = name.includes("ball");
    return { ent, score: hasBall ? 1 : 0 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].ent;
}

function extractBallTrace(rawFrames) {
  const frames = normalizeFrames(rawFrames);
  if (!frames.length) return null;

  let chosenId = null;
  let chosenName = null;
  const samples = [];
  let axisPicked = null;

  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    const entities = extractEntities(frame);
    const ball = selectedBall(chosenId, entities);
    if (!ball) continue;
    chosenId = ball.id;
    chosenName = ball.name;
    const axes = extractPositionAxes(ball.components);
    const axis = pickAxis(axisPicked, axes);
    if (!axis) continue;
    axisPicked = axis;
    const time = typeof frame.time === "number" ? frame.time : i;
    samples.push({ time, value: axes[axis] });
  }

  if (!axisPicked || samples.length < 2) {
    return null;
  }

  return new VerticalTrace({
    axis: axisPicked,
    entityId: chosenId,
    name: chosenName,
    samples,
  });
}

function selectedBall(existingId, entities) {
  if (existingId) {
    const found = entities.find((ent) => ent.id === existingId);
    if (found) return found;
  }
  return selectBallEntity(entities);
}

function pickAxis(currentAxis, axes) {
  if (currentAxis && currentAxis in axes) return currentAxis;
  const priority = ["y", "height", "z"];
  for (const key of priority) {
    if (key in axes) return key;
  }
  return null;
}

function computeVelocities(samples) {
  const velocities = [];
  for (let i = 1; i < samples.length; i += 1) {
    const dt = samples[i].time - samples[i - 1].time || 1;
    velocities.push((samples[i].value - samples[i - 1].value) / dt);
  }
  return velocities;
}

function tolerance(values, base = 0.02, floor = 1e-6) {
  if (!values.length) return floor;
  const span = Math.max(...values) - Math.min(...values);
  return Math.max(floor, Math.abs(span) * base);
}

function evaluateTrace(trace) {
  if (!trace || trace.samples.length < 3) {
    return { ok: false, reason: "insufficient samples" };
  }
  const velocities = computeVelocities(trace.samples);
  const posTol = tolerance(
    trace.samples.map((s) => s.value),
    0.01,
  );
  const velTol = tolerance(velocities, 0.05);

  let releaseIndex = null;
  for (let i = 0; i < velocities.length; i += 1) {
    if (velocities[i] < -velTol) {
      releaseIndex = i;
      break;
    }
  }

  const descent = { down: 0, up: 0, flat: 0 };
  for (let i = (releaseIndex || 0) + 1; i < trace.samples.length; i += 1) {
    const delta = trace.samples[i].value - trace.samples[i - 1].value;
    if (delta < -posTol) descent.down += 1;
    else if (delta > posTol) descent.up += 1;
    else descent.flat += 1;
  }

  const accel = { negative: 0, positive: 0 };
  for (let i = (releaseIndex || 0) + 1; i < velocities.length; i += 1) {
    const delta = velocities[i] - velocities[i - 1];
    if (delta < -velTol) accel.negative += 1;
    else if (delta > velTol) accel.positive += 1;
  }

  const descentOk = descent.down > 0 && descent.up <= Math.max(1, descent.down / 5);
  const accelOk = accel.negative > 0 && accel.positive <= Math.max(1, accel.negative / 4);
  const releaseOk = releaseIndex !== null;

  return {
    ok: releaseOk && descentOk && accelOk,
    releaseIndex,
    descent,
    accel,
    velocities,
    posTol,
    velTol,
  };
}

module.exports = {
  extractBallTrace,
  evaluateTrace,
};
