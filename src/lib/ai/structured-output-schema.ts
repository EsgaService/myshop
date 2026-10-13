/**
 * Adapts a JSON Schema (from `z.toJSONSchema`) to the subset accepted by Anthropic structured
 * outputs. Constraints stripped here are still enforced afterwards by Zod (`parseAiBook`).
 *
 * - Every object gets `additionalProperties: false`.
 * - Length / size / range / pattern keywords are removed.
 * - Free-form maps (`additionalProperties` as a schema) cannot be expressed, so those properties
 *   are dropped from the schema and from `required`; Zod fills their defaults.
 */
type Schema = Record<string, unknown>;

const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "propertyNames",
  "default",
]);

const isObject = (v: unknown): v is Schema => typeof v === "object" && v !== null && !Array.isArray(v);

const isFreeFormMap = (s: unknown): boolean =>
  isObject(s) && isObject(s.additionalProperties) && !isObject(s.properties);

function transform(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(transform);
  if (!isObject(node)) return node;

  const out: Schema = {};
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    if (key === "oneOf") {
      out.anyOf = transform(value);
      continue;
    }
    if (key === "properties" && isObject(value)) {
      const props: Schema = {};
      for (const [name, prop] of Object.entries(value)) {
        if (!isFreeFormMap(prop)) props[name] = transform(prop);
      }
      out.properties = props;
    } else if (key === "$defs" && isObject(value)) {
      out.$defs = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, transform(v)]));
    } else if (key === "enum" || key === "const" || key === "required") {
      out[key] = value;
    } else {
      out[key] = transform(value);
    }
  }

  if (out.type === "object" || isObject(out.properties)) {
    out.additionalProperties = false;
    if (Array.isArray(out.required) && isObject(out.properties)) {
      out.required = (out.required as string[]).filter((name) => name in (out.properties as Schema));
    }
  }
  return out;
}

export function toStructuredOutputSchema(schema: Schema): Schema {
  return transform(schema) as Schema;
}
