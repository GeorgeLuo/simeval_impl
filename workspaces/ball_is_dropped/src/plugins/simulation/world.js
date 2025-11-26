const { namespaced, NAMESPACE } = require("./constants");

function createWorld({ namespace = NAMESPACE } = {}) {
  return {
    namespace,
    entities: new Map(),
    nextId: 1,
  };
}

function ensureEntity(world, id = null, name = null) {
  const entityId = id || `entity-${world.nextId++}`;
  if (!world.entities.has(entityId)) {
    world.entities.set(entityId, {
      id: entityId,
      name: name || entityId,
      components: {},
    });
  } else if (name && !world.entities.get(entityId).name) {
    world.entities.get(entityId).name = name;
  }
  return world.entities.get(entityId);
}

function setComponent(world, entityId, type, value) {
  const entity = world.entities.get(entityId);
  if (!entity) {
    throw new Error(`entity ${entityId} does not exist`);
  }
  entity.components[type] = { ...value };
}

function getComponent(world, entityId, type) {
  const entity = world.entities.get(entityId);
  if (!entity) {
    return undefined;
  }
  return entity.components[type];
}

function entitiesWith(world, requiredTypes) {
  const found = [];
  for (const entity of world.entities.values()) {
    const hasAll = requiredTypes.every((t) => t in entity.components);
    if (hasAll) {
      found.push(entity);
    }
  }
  return found;
}

function snapshot(world, { time = 0, namespaceComponents = false } = {}) {
  const entities = [];
  for (const entity of world.entities.values()) {
    const components = {};
    for (const [ctype, cval] of Object.entries(entity.components)) {
      const key = namespaceComponents ? namespaced(ctype, world.namespace) : ctype;
      components[key] = { ...cval };
    }
    entities.push({
      id: entity.id,
      name: entity.name,
      components,
    });
  }
  return { time, entities };
}

module.exports = {
  createWorld,
  ensureEntity,
  setComponent,
  getComponent,
  entitiesWith,
  snapshot,
};
