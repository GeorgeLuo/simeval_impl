const {
  COMPONENTS,
  NAMESPACE,
  DEFAULT_GRAVITY,
  namespaced,
} = require("../constants");

const TYPE = COMPONENTS.gravity;
const ID = namespaced(TYPE, NAMESPACE);

function typeName(namespace = NAMESPACE) {
  return namespaced(TYPE, namespace);
}

function create({ y = DEFAULT_GRAVITY } = {}) {
  return { y };
}

const Component = {
  id: ID,
  description: "Downward gravitational acceleration (y-axis)",
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
