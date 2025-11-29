// Evaluation-side verifier for ball drop: accumulates evaluation.frame components and emits
// evaluation2.ball_trace + evaluation2.ball_verdict components each tick.
const { System } = require("../../../dist/core/systems/System");

const TRACE_ID = "ball_drop.trace";
const VERDICT_ID = "ball_drop.verdict";

const FrameComponent = { id: "evaluation.frame", validate: () => true };
const TraceComponent = { id: TRACE_ID, validate: () => true };
const VerdictComponent = { id: VERDICT_ID, validate: () => true };
const DebugComponent = { id: "ball_drop.debug", validate: () => true };
const LogComponent = { id: "ball_drop.log", validate: () => true };

function pickBall(frame) {
  // frame.entities is a map: entityId -> components
  const entries = Object.entries(frame.entities || {});
  if (!entries.length) return null;
  // Prefer an id/name containing "ball".
  for (const [id, comps] of entries) {
    const idLower = String(id).toLowerCase();
    if (idLower.includes("ball")) {
      return { id, comps };
    }
    // components keys may contain "position" etc.
  }
  // Fallback to first entry.
  const [id, comps] = entries[0];
  return { id, comps };
}

function extractY(components) {
  if (!components || typeof components !== "object") return null;
  for (const [ctype, cval] of Object.entries(components)) {
    const lc = String(ctype).toLowerCase();
    if (lc.includes("position")) {
      if (cval && typeof cval.y === "number") return cval.y;
      if (cval && typeof cval.height === "number") return cval.height;
    }
  }
  // Fallback: first component with numeric y.
  for (const cval of Object.values(components)) {
    if (cval && typeof cval === "object" && typeof cval.y === "number") return cval.y;
  }
  return null;
}

function computeVerdict(samples) {
  if (!samples || samples.length < 3) {
    return { ok: false, releaseOk: false, descentOk: false, accelOk: false, message: "Insufficient samples" };
  }
  const values = samples.map((s) => s.value);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const spanY = maxY - minY;
  const velocities = [];
  for (let i = 1; i < samples.length; i += 1) {
    const dt = samples[i].time - samples[i - 1].time || 1;
    velocities.push((samples[i].value - samples[i - 1].value) / dt);
  }
  const posTol = Math.max(1e-6, (Math.max(...samples.map((s) => s.value)) - Math.min(...samples.map((s) => s.value))) * 0.02);
  const velTol = Math.max(1e-6, (Math.max(...velocities) - Math.min(...velocities)) * 0.05);

  let releaseIndex = null;
  for (let i = 0; i < velocities.length; i += 1) {
    if (velocities[i] < -velTol) {
      releaseIndex = i;
      break;
    }
  }

  const descent = { down: 0, up: 0, flat: 0 };
  for (let i = (releaseIndex || 0) + 1; i < samples.length; i += 1) {
    const delta = samples[i].value - samples[i - 1].value;
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
    sampleCount: samples.length,
    minY,
    maxY,
    spanY,
  };
}

class BallDropVerifierSystem extends System {
  constructor(options = {}) {
    super();
    this.frameLimit = typeof options.frameLimit === "number" && options.frameLimit > 0 ? options.frameLimit : 200;
    this.samples = [];
    this.lastTick = -Infinity;
    this.resultEntity = null;
  }

  initialize(context) {
    if (this.resultEntity === null) {
      this.resultEntity = context.entityManager.create();
    }
  }

  update(context) {
    const cm = context.componentManager;
    const frameEntities = cm.getEntitiesWithComponent(FrameComponent);
    const frames = [];
    for (const entity of frameEntities) {
      const inst = cm.getComponent(entity, FrameComponent);
      if (inst && inst.payload) {
        frames.push(inst.payload);
      }
      // Remove the frame component to avoid re-processing.
      cm.removeComponent(entity, FrameComponent);
    }
    if (!frames.length) {
      return;
    }
    frames.sort((a, b) => (a.tick ?? 0) - (b.tick ?? 0));

    for (const frame of frames) {
      const tick = typeof frame.tick === "number" ? frame.tick : this.samples.length;
      if (tick < this.lastTick) {
        // New run detected; reset samples.
        this.samples = [];
      }
      this.lastTick = tick;
      const ball = pickBall(frame);
      if (!ball) continue;
      const y = extractY(ball.comps);
      if (y === null) continue;
      this.samples.push({ time: tick, value: y, entityId: ball.id });
      if (this.frameLimit && this.samples.length > this.frameLimit) {
        this.samples = this.samples.slice(-this.frameLimit);
      }
    }

    const verdict = computeVerdict(this.samples);
    const tracePayload = this.samples.length
      ? { axis: "y", entityId: this.samples[this.samples.length - 1].entityId, samples: this.samples }
      : { axis: null, entityId: null, samples: [] };

    const targetEntity = this.resultEntity;
    cm.removeComponent(targetEntity, TraceComponent);
    cm.removeComponent(targetEntity, VerdictComponent);
    cm.removeComponent(targetEntity, DebugComponent);
    cm.removeComponent(targetEntity, LogComponent);
    cm.addComponent(targetEntity, TraceComponent, tracePayload);
    cm.addComponent(targetEntity, VerdictComponent, verdict);
    cm.addComponent(targetEntity, DebugComponent, {
      frameEntity: targetEntity,
      framesProcessed: frames.length,
      samples: this.samples.length,
      lastTick: this.lastTick,
      lastFrameEntityCount: frames.length ? Object.keys(frames[frames.length - 1].entities || {}).length : 0,
    });
    // Emit a minimal log for troubleshooting (counts only).
    const lastFrame = frames.length ? frames[frames.length - 1] : null;
    cm.addComponent(targetEntity, LogComponent, {
      frameCount: frames.length,
      entitiesInLastFrame: lastFrame ? Object.keys(lastFrame.entities || {}).length : 0,
      componentIdsLastFrame: lastFrame ? Object.keys(Object.values(lastFrame.entities || {})[0] || {}) : [],
    });
  }
}

module.exports = BallDropVerifierSystem;
module.exports.default = BallDropVerifierSystem;
