// Relative to the sim-eval server root when uploaded to plugins/evaluation/systems.
const { System } = require("../../../dist/core/systems/System");

// Component type placeholders (ComponentManager keys on .id).
const TRACE_ID = "evaluation2.ball_trace";
const VERDICT_ID = "evaluation2.ball_verdict";

const FrameComponent = {
  id: "evaluation.frame",
  validate: () => true,
};

const TraceComponent = {
  id: TRACE_ID,
  description: "Extracted vertical trace for the ball entity.",
  validate: () => true,
};

const VerdictComponent = {
  id: VERDICT_ID,
  description: "Pass/fail summary for release, descent, acceleration checks.",
  validate: () => true,
};

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
    const lowered = String(ctype).toLowerCase();
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

function selectBall(knownId, entities) {
  if (knownId) {
    const found = entities.find((ent) => ent.id === knownId);
    if (found) return found;
  }
  const scored = entities.map((ent) => {
    const name = `${ent.name || ent.id || ""}`.toLowerCase();
    const hint = name.includes("ball") ? 1 : 0;
    return { ent, score: hint };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.length ? scored[0].ent : null;
}

function tolerance(values, base = 0.02, floor = 1e-6) {
  if (!values || !values.length) return floor;
  const span = Math.max(...values) - Math.min(...values);
  return Math.max(floor, Math.abs(span) * base);
}

function buildTrace(frames) {
  let ballId = null;
  let axis = null;
  const samples = [];

  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    const entities = [];
    for (const [id, comps] of Object.entries(frame.entities || {})) {
      entities.push({ id, name: id, components: comps });
    }
    const ball = selectBall(ballId, entities);
    if (!ball) continue;
    ballId = ball.id;
    const axes = extractPositionAxes(ball.components);
    const pickedAxis = axis && axis in axes ? axis : ["y", "height", "z"].find((a) => a in axes);
    if (!pickedAxis) continue;
    axis = pickedAxis;
    samples.push({
      time: typeof frame.tick === "number" ? frame.tick : i,
      value: axes[axis],
    });
  }

  if (!axis || samples.length < 2) return null;
  return { axis, entityId: ballId, samples };
}

function computeVelocities(samples) {
  const velocities = [];
  for (let i = 1; i < samples.length; i += 1) {
    const dt = samples[i].time - samples[i - 1].time || 1;
    velocities.push((samples[i].value - samples[i - 1].value) / dt);
  }
  return velocities;
}

function evaluateTrace(trace) {
  if (!trace) {
    return {
      ok: false,
      releaseOk: false,
      descentOk: false,
      accelOk: false,
      message: "No usable trace",
    };
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

  const releaseOk = releaseIndex !== null;
  const descentOk = descent.down > 0 && descent.up <= Math.max(1, descent.down / 5);
  const accelOk = accel.negative > 0 && accel.positive <= Math.max(1, accel.negative / 4);

  return {
    ok: releaseOk && descentOk && accelOk,
    releaseOk,
    descentOk,
    accelOk,
    releaseIndex,
    descent,
    accel,
    tolerances: { posTol, velTol },
  };
}

class BallDropVerifierSystem extends System {
  constructor(options = {}) {
    super();
    this.resultEntity = null;
    this.frameLimit = typeof options.frameLimit === "number" && options.frameLimit > 0 ? options.frameLimit : 200;
  }

  initialize(context) {
    this.ensureResultEntity(context);
  }

  ensureResultEntity(context) {
    if (this.resultEntity === null) {
      this.resultEntity = context.entityManager.create();
    }
    return this.resultEntity;
  }

  collectFrames(componentManager) {
    const frames = [];
    const entities = componentManager.getEntitiesWithComponent(FrameComponent);
    const recent = this.frameLimit ? entities.slice(-this.frameLimit) : entities;
    for (const entity of recent) {
      const inst = componentManager.getComponent(entity, FrameComponent);
      if (inst && inst.payload) {
        frames.push(inst.payload);
      }
    }
    // Keep only the latest contiguous segment (tick reset indicates new run).
    const segmented = [];
    let prevTick = null;
    for (const frame of frames) {
      const tick = typeof frame.tick === "number" ? frame.tick : 0;
      if (prevTick !== null && tick < prevTick) {
        segmented.length = 0;
      }
      segmented.push(frame);
      prevTick = tick;
    }
    return segmented;
  }

  update(context) {
    const cm = context.componentManager;
    const frames = this.collectFrames(cm);
    const trace = buildTrace(frames);
    const verdict = evaluateTrace(trace);

    const resultEntity = this.ensureResultEntity(context);
    cm.removeComponent(resultEntity, TraceComponent);
    cm.removeComponent(resultEntity, VerdictComponent);
    cm.addComponent(resultEntity, TraceComponent, trace || { axis: null, samples: [] });
    cm.addComponent(resultEntity, VerdictComponent, verdict);
  }
}

module.exports = BallDropVerifierSystem;
module.exports.default = BallDropVerifierSystem;
