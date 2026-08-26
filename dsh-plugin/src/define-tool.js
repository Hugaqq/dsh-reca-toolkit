function normalizeSchema(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;

  const { required, properties, items, ...rest } = schema;
  const normalized = { ...rest };

  if (schema.type === "object" || properties) {
    normalized.type = schema.type || "object";
    normalized.additionalProperties = schema.additionalProperties ?? false;
    normalized.properties = {};
    const requiredNames = Array.isArray(required) ? [...required] : [];
    for (const [name, property] of Object.entries(properties || {})) {
      const { required: propertyRequired, ...propertySchema } = property;
      normalized.properties[name] = normalizeSchema(propertySchema);
      if (propertyRequired === true) requiredNames.push(name);
    }
    if (requiredNames.length > 0) normalized.required = [...new Set(requiredNames)];
  } else if (required !== undefined) {
    normalized.required = required;
  }

  if (items !== undefined) normalized.items = normalizeSchema(items);
  return normalized;
}

// Keep the plugin independent of DSH's singleton runtime packages. Loading a
// second copy of @deepseek-ai/dsh-tools would create a different scheduler
// Symbol and make every model tool call fail before dispatch.
export function defineTool(spec) {
  return {
    ...spec,
    parameters: normalizeSchema({
      type: "object",
      additionalProperties: false,
      properties: spec.parameters || {},
    }),
  };
}
