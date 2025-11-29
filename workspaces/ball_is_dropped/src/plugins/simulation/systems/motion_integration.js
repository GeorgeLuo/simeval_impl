const position = require("../components/position");
const velocity = require("../components/velocity");
const { entitiesWith } = require("../world");

class MotionIntegrationSystem {
  update(worldOrContext, dt = 0.1) {
    // SimEval context path
    if (worldOrContext && worldOrContext.componentManager) {
      const cm = worldOrContext.componentManager;
      const entities = cm.getEntitiesWithComponent(position.Component);
      for (const entity of entities) {
        const posInst = cm.getComponent(entity, position.Component);
        const velInst = cm.getComponent(entity, velocity.Component);
        if (!posInst || !velInst) continue;
        posInst.payload.y += velInst.payload.y * dt;
      }
      return;
    }

    // Local runner path
    const targets = entitiesWith(worldOrContext, [position.TYPE, velocity.TYPE]);
    for (const entity of targets) {
      const pos = entity.components[position.TYPE];
      const vel = entity.components[velocity.TYPE];
      pos.y += vel.y * dt;
    }
  }
}

module.exports = MotionIntegrationSystem;
module.exports.default = MotionIntegrationSystem;
