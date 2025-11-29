const position = require("../components/position");
const velocity = require("../components/velocity");
const gravity = require("../components/gravity");
const { ensureEntity, setComponent } = require("../world");
const { DEFAULT_HEIGHT, DEFAULT_GRAVITY } = require("../constants");

function spawnBall(
  world,
  {
    id = "ball",
    name = "ball",
    initialHeight = DEFAULT_HEIGHT,
    initialVelocity = 0,
    gravityY = DEFAULT_GRAVITY,
    includeGravity = true,
  } = {},
) {
  const entity = ensureEntity(world, id, name);
  setComponent(world, entity.id, position.TYPE, position.create({ y: initialHeight }));
  setComponent(world, entity.id, velocity.TYPE, velocity.create({ y: initialVelocity }));
  if (includeGravity) {
    setComponent(world, entity.id, gravity.TYPE, gravity.create({ y: gravityY }));
  }
  return entity.id;
}

function spawnBallSimEval(context, options = {}) {
  const {
    initialHeight = DEFAULT_HEIGHT,
    initialVelocity = 0,
    gravityY = DEFAULT_GRAVITY,
    includeGravity = true,
  } = options;
  const entity = context.entityManager.create();
  context.componentManager.addComponent(entity, position.Component, { y: initialHeight });
  context.componentManager.addComponent(entity, velocity.Component, { y: initialVelocity });
  if (includeGravity) {
    context.componentManager.addComponent(entity, gravity.Component, { y: gravityY });
  }
  return entity;
}

class BallSpawnerSystem {
  constructor(options = {}) {
    this.options = options;
    this.spawned = false;
  }

  init(worldOrContext) {
    if (this.spawned) return;
    if (worldOrContext && worldOrContext.componentManager) {
      spawnBallSimEval(worldOrContext, this.options);
    } else {
      spawnBall(worldOrContext, this.options);
    }
    this.spawned = true;
  }

  update(worldOrContext) {
    if (!this.spawned) {
      this.init(worldOrContext);
    }
  }
}

module.exports = {
  spawnBall,
  BallSpawnerSystem,
};
module.exports.default = BallSpawnerSystem;
