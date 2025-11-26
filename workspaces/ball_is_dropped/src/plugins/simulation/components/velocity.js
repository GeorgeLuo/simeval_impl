const { COMPONENTS, NAMESPACE, namespaced } = require("../constants");

const TYPE = COMPONENTS.velocity;

function typeName(namespace = NAMESPACE) {
  return namespaced(TYPE, namespace);
}

function create({ y = 0 } = {}) {
  return { y };
}

module.exports = {
  TYPE,
  typeName,
  create,
};
