// Shared constants for the ball_is_dropped simulation plugins.
const NAMESPACE = "simulation";

const COMPONENTS = {
  position: "position",
  velocity: "velocity",
  gravity: "gravity",
};

const DEFAULT_HEIGHT = 10;
const DEFAULT_GRAVITY = -9.81;
const DEFAULT_DT = 0.1;

function namespaced(type, namespace = NAMESPACE) {
  return namespace ? `${namespace}.${type}` : type;
}

module.exports = {
  NAMESPACE,
  COMPONENTS,
  DEFAULT_HEIGHT,
  DEFAULT_GRAVITY,
  DEFAULT_DT,
  namespaced,
};
