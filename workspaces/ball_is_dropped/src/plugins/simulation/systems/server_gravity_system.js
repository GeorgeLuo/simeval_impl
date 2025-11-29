const { System } = require("../../../dist/core/systems/System");
const Velocity = require("../components/velocity");
const Gravity = require("../components/gravity");
const { DEFAULT_DT } = require("../constants");

class GravitySystem extends System {
  constructor(options = {}) {
    super();
    this.dt = typeof options.dt === "number" && Number.isFinite(options.dt) ? options.dt : DEFAULT_DT;
  }

  update(context) {
    const cm = context.componentManager;
    const velType = Velocity.default || Velocity.Component;
    const gravType = Gravity.default || Gravity.Component;
    const entities = cm.getEntitiesWithComponent(velType);
    for (const entity of entities) {
      const vel = cm.getComponent(entity, velType);
      const grav = cm.getComponent(entity, gravType);
      if (!vel || !grav) continue;
      vel.payload.y += grav.payload.y * this.dt;
    }
  }
}

module.exports = GravitySystem;
module.exports.default = GravitySystem;
