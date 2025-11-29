const { System } = require("../../../dist/core/systems/System");
const Position = require("../components/position");
const Velocity = require("../components/velocity");
const Gravity = require("../components/gravity");
const { DEFAULT_HEIGHT, DEFAULT_GRAVITY } = require("../constants");

class BallSpawnerSystem extends System {
  constructor(options = {}) {
    super();
    this.initialHeight = typeof options.initialHeight === "number" ? options.initialHeight : DEFAULT_HEIGHT;
    this.initialVelocity = typeof options.initialVelocity === "number" ? options.initialVelocity : 0;
    this.gravityY = typeof options.gravityY === "number" ? options.gravityY : DEFAULT_GRAVITY;
    this.includeGravity = options.includeGravity !== false;
    this.spawned = false;
  }

  initialize(context) {
    this.spawn(context);
  }

  update(context) {
    if (!this.spawned) {
      this.spawn(context);
    }
  }

  spawn(context) {
    if (this.spawned) return;
    const entity = context.entityManager.create();
    context.componentManager.addComponent(entity, Position.default || Position.Component, { y: this.initialHeight });
    context.componentManager.addComponent(entity, Velocity.default || Velocity.Component, { y: this.initialVelocity });
    if (this.includeGravity) {
      context.componentManager.addComponent(entity, Gravity.default || Gravity.Component, { y: this.gravityY });
    }
    this.spawned = true;
  }
}

module.exports = BallSpawnerSystem;
module.exports.default = BallSpawnerSystem;
