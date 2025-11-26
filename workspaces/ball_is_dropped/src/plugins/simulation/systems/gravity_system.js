const velocity = require("../components/velocity");
const gravity = require("../components/gravity");
const { entitiesWith } = require("../world");

class GravitySystem {
  update(world, dt) {
    const targets = entitiesWith(world, [velocity.TYPE, gravity.TYPE]);
    for (const entity of targets) {
      const vel = entity.components[velocity.TYPE];
      const g = entity.components[gravity.TYPE];
      vel.y += g.y * dt;
    }
  }
}

module.exports = GravitySystem;
module.exports.default = GravitySystem;
