const { DEFAULT_DT, DEFAULT_HEIGHT, DEFAULT_GRAVITY } = require("./constants");
const { createWorld, snapshot } = require("./world");
const { spawnBall, GravitySystem, MotionIntegrationSystem } = require("./systems");

function runBallDrop({
  steps = 100,
  dt = DEFAULT_DT,
  initialHeight = DEFAULT_HEIGHT,
  initialVelocity = 0,
  gravityY = DEFAULT_GRAVITY,
  holdSteps = 0,
  namespaceComponents = false,
  includeGravity = true,
} = {}) {
  const world = createWorld();
  spawnBall(world, { initialHeight, initialVelocity, gravityY, includeGravity });

  const gravitySystem = new GravitySystem();
  const integrationSystem = new MotionIntegrationSystem();

  const frames = [];
  let time = 0;

  frames.push(snapshot(world, { time, namespaceComponents }));

  for (let step = 0; step < steps; step += 1) {
    if (step >= holdSteps) {
      gravitySystem.update(world, dt);
    }
    integrationSystem.update(world, dt);
    time += dt;
    frames.push(snapshot(world, { time, namespaceComponents }));
  }

  return frames;
}

function framesToNDJSON(frames) {
  return frames.map((frame) => JSON.stringify(frame)).join("\n");
}

module.exports = {
  runBallDrop,
  framesToNDJSON,
};
