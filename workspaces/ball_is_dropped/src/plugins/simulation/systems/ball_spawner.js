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

class BallSpawnerSystem {
  constructor(options = {}) {
    this.options = options;
    this.spawned = false;
  }

  init(world) {
    if (this.spawned) return;
    spawnBall(world, this.options);
    this.spawned = true;
  }

  update(world) {
    if (!this.spawned) {
      this.init(world);
    }
  }
}

module.exports = {
  spawnBall,
  BallSpawnerSystem,
};
module.exports.default = BallSpawnerSystem;
