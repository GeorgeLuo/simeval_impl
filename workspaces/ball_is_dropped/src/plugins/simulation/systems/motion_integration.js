const position = require("../components/position");
const velocity = require("../components/velocity");
const { entitiesWith } = require("../world");

class MotionIntegrationSystem {
  update(world, dt) {
    const targets = entitiesWith(world, [position.TYPE, velocity.TYPE]);
    for (const entity of targets) {
      const pos = entity.components[position.TYPE];
      const vel = entity.components[velocity.TYPE];
      pos.y += vel.y * dt;
    }
  }
}

module.exports = MotionIntegrationSystem;
module.exports.default = MotionIntegrationSystem;
