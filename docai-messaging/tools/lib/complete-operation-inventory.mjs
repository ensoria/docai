const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// This candidate projects every operation declared by these three authorities.
// Behavior/contexts attached to an owner do not create additional operations.
export function collectCompleteOperationInventory(contexts, representations, asyncapi) {
  const declarations = [
    ["complete-contexts", record(contexts?.operations) ? Object.keys(contexts.operations) : null],
    ["complete-representations", Array.isArray(representations?.representations)
      ? representations.representations.map((entry) => record(entry) ? entry.operation : null) : null],
    ["storefront-asyncapi-3.1.0", record(asyncapi?.operations) ? Object.keys(asyncapi.operations) : null]
  ];
  const issues = [];
  const owners = new Map();
  for (const [sourceId, names] of declarations) {
    if (names === null || names.some((name) => typeof name !== "string" || name.length === 0)) {
      issues.push(`${sourceId}: malformed source operation inventory`);
      continue;
    }
    for (const name of names) {
      if (owners.has(name)) issues.push(`${name}: duplicate operation owner in source operation inventory`);
      else owners.set(name, sourceId);
    }
  }
  return { operations: [...owners.keys()].sort(), issues };
}
