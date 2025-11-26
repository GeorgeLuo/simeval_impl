class VerticalTrace {
  constructor({ axis, entityId, name = null, samples = [] } = {}) {
    this.axis = axis;
    this.entityId = entityId;
    this.name = name || entityId;
    this.samples = samples;
  }
}

module.exports = VerticalTrace;
