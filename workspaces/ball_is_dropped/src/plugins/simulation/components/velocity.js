const { COMPONENTS, NAMESPACE, namespaced } = require("../constants");

const TYPE = COMPONENTS.velocity;
const ID = namespaced(TYPE, NAMESPACE);

function typeName(namespace = NAMESPACE) {
  return namespaced(TYPE, namespace);
}

function create({ y = 0 } = {}) {
  return { y };
}

const Component = {
  id: ID,
  description: "Vertical velocity (y-axis)",
  validate(payload) {
    return payload && typeof payload.y === "number" && Number.isFinite(payload.y);
  },
};

module.exports = {
  TYPE,
  typeName,
  create,
  Component,
  default: Component,
};
module.exports.id = Component.id;
module.exports.validate = Component.validate;
