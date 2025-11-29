const { System } = require("../../../dist/core/systems/System");
const Position = require("../components/position");
const Velocity = require("../components/velocity");
const { DEFAULT_DT } = require("../constants");

class MotionIntegrationSystem extends System {
  constructor(options = {}) {
    super();
    this.dt = typeof options.dt === "number" && Number.isFinite(options.dt) ? options.dt : DEFAULT_DT;
  }

  update(context) {
    const cm = context.componentManager;
    const posType = Position.default || Position.Component;
    const velType = Velocity.default || Velocity.Component;
    const entities = cm.getEntitiesWithComponent(posType);
    for (const entity of entities) {
      const pos = cm.getComponent(entity, posType);
      const vel = cm.getComponent(entity, velType);
      if (!pos || !vel) continue;
      pos.payload.y += vel.payload.y * this.dt;
    }
  }
}

module.exports = MotionIntegrationSystem;
module.exports.default = MotionIntegrationSystem;
