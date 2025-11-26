const {
  COMPONENTS,
  NAMESPACE,
  DEFAULT_GRAVITY,
  namespaced,
} = require("../constants");

const TYPE = COMPONENTS.gravity;

function typeName(namespace = NAMESPACE) {
  return namespaced(TYPE, namespace);
}

function create({ y = DEFAULT_GRAVITY } = {}) {
  return { y };
}

module.exports = {
  TYPE,
  typeName,
  create,
};
