const velocity = require("../components/velocity");
const gravity = require("../components/gravity");
const { entitiesWith } = require("../world");

class GravitySystem {
  update(worldOrContext, dt = 0.1) {
    // SimEval context path
    if (worldOrContext && worldOrContext.componentManager) {
      const cm = worldOrContext.componentManager;
      const entities = cm.getEntitiesWithComponent(velocity.Component);
      for (const entity of entities) {
        const velInst = cm.getComponent(entity, velocity.Component);
        const gravInst = cm.getComponent(entity, gravity.Component);
        if (!velInst || !gravInst) continue;
        velInst.payload.y += gravInst.payload.y * dt;
      }
      return;
    }

    // Local runner path
    const targets = entitiesWith(worldOrContext, [velocity.TYPE, gravity.TYPE]);
    for (const entity of targets) {
      const vel = entity.components[velocity.TYPE];
      const g = entity.components[gravity.TYPE];
      vel.y += g.y * dt;
    }
  }
}

module.exports = GravitySystem;
module.exports.default = GravitySystem;
