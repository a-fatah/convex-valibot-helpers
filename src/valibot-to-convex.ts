// Valibot → Convex validator conversion.
// Standalone, domain-agnostic Valibot → Convex validator conversion.
//
// Counterpart of convex-helpers/server/zod4.ts:
//   - valibotToConvex(schema)        → Convex `Validator` (input shape)
//   - valibotOutputToConvex(schema)  → same, using post-transform output shape
//
// The converter walks Valibot's runtime `type` discriminator (every schema has
// `type: 'string' | 'object' | 'variant' | ...`) and emits the matching Convex
// `v.*(...)`. Pipes are transparent: `v.pipe(v.string(), v.email())` carries
// `type: 'string'` plus a `pipe` field whose actions we ignore for shape
// conversion (Convex doesn't model refinements anyway).
//
// Limitations:
//   - `valibotOutputToConvex` cannot infer the output type of a custom
//     transform at runtime; for transforms we treat output == input shape.
//     ID-branding transforms (string → branded string) are correct because
//     they don't change runtime shape; a structural transform would not be.
//   - Recursive schemas (`v.lazy(() => ...)`) collapse to `cv.any()` at the
//     cycle point — Convex validators have no recursion.

import * as v from "valibot";
import { v as cv, type Validator, type VObject, type PropertyValidators } from "convex/values";

// ── Public surface ──────────────────────────────────────────────────────────

export type AnyValibotSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;

/** Aliased so callers don't have to reach into convex/values for the generic
 *  form. `convex-helpers` uses this same shape internally as `GenericValidator`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyConvexValidator = Validator<any, any, any>;

/**
 * Convert a Valibot schema to a Convex validator using *input* shape — i.e.
 * what the data looks like *before* any Valibot transforms run. Use this for
 * function ARG validators: Convex shape-checks first, then your handler runs
 * the Valibot pipeline (with refinements) for full validation.
 */
export function valibotToConvex<S extends AnyValibotSchema>(
  schema: S,
): Validator<v.InferInput<S>, "required", string> {
  return convert(schema, /* useOutput */ false, new WeakSet()) as Validator<
    v.InferInput<S>,
    "required",
    string
  >;
}

/**
 * Convert a Valibot schema to a Convex validator using *output* shape — i.e.
 * what the data looks like *after* Valibot transforms run. Use this for
 * RETURN-value validators and for table storage validators.
 */
/** Detect Valibot optional/nullish wrappers — these map to Convex `"optional"`
 *  validator slots, everything else is `"required"`. Mirrors `OptionalityOf` in
 *  `fields.ts` so the two helpers agree on per-field optionality. */
type ConvexOptionality<S extends AnyValibotSchema> =
  S extends v.OptionalSchema<AnyValibotSchema, unknown>
    ? "optional"
    : S extends v.NullishSchema<AnyValibotSchema, unknown>
      ? "optional"
      : S extends v.ExactOptionalSchema<AnyValibotSchema, unknown>
        ? "optional"
        : "required";

/** Conditional return type: when `S` is an object schema, the result is the
 *  precise `VObject<T, F, "required">` — exposes `.fields` to consumers like
 *  `defineTable(xxx.fields)` AND preserves per-field optionality so Convex
 *  infers the right `?:` markers in `Doc<"table">`. Non-object schemas get
 *  the generic `Validator<T, ...>` return. */
export type ValibotOutputToConvex<S extends AnyValibotSchema> =
  S extends v.ObjectSchema<infer F, infer _M>
    ? VObject<
        v.InferOutput<S>,
        { [K in keyof F]: F[K] extends AnyValibotSchema
            ? Validator<v.InferOutput<F[K]>, ConvexOptionality<F[K]>, string>
            : never },
        "required"
      >
    : Validator<v.InferOutput<S>, "required", string>;

export function valibotOutputToConvex<S extends AnyValibotSchema>(
  schema: S,
): ValibotOutputToConvex<S> {
  return convert(schema, /* useOutput */ true, new WeakSet()) as ValibotOutputToConvex<S>;
}

// ── Core dispatch ───────────────────────────────────────────────────────────

function convert(
  schema: AnyValibotSchema,
  useOutput: boolean,
  visited: WeakSet<AnyValibotSchema>,
): AnyConvexValidator {
  // Cycle break — Convex validators can't express recursion, so fall back to
  // `v.any()` if we re-enter the same schema instance *on the current path*.
  //
  // `visited` is PATH-scoped, not run-scoped: we add the schema on entry and
  // remove it once its subtree finishes (`finally`). Without the removal, a
  // schema instance that is merely REUSED across sibling branches (a DAG —
  // e.g. a single shared `ElementIdFieldSchema` object spread into many block
  // schemas of a union) would be mistaken for a cycle on its 2nd+ occurrence
  // and collapse to `cv.any()`, silently dropping per-field optionality. True
  // recursion still re-enters while the instance is on the active path.
  if (visited.has(schema)) return cv.any() as AnyConvexValidator;
  visited.add(schema);
  try {
    return convertNode(schema, useOutput, visited);
  } finally {
    visited.delete(schema);
  }
}

function convertNode(
  schema: AnyValibotSchema,
  useOutput: boolean,
  visited: WeakSet<AnyValibotSchema>,
): AnyConvexValidator {
  // `vid()` marker — a custom Valibot schema that carries a tableName we
  // bridge to `cv.id(tableName)`.
  const tableName = readVidMarker(schema);
  if (tableName !== null) return cv.id(tableName) as AnyConvexValidator;

  // Schemas attached to pipes still report the *base* type, so the switch
  // below works for pipe-wrapped schemas too.
  const t = (schema as { type: string }).type;

  switch (t) {
    case "string":
      return cv.string() as AnyConvexValidator;
    case "number":
      return cv.number() as AnyConvexValidator;
    case "boolean":
      return cv.boolean() as AnyConvexValidator;
    case "null":
      return cv.null() as AnyConvexValidator;
    case "bigint":
      return cv.int64() as AnyConvexValidator;
    case "any":
    case "unknown":
      return cv.any() as AnyConvexValidator;
    case "never":
      throw new Error("valibotToConvex: `never` schemas have no Convex equivalent");

    case "literal": {
      const lit = (schema as v.LiteralSchema<v.Literal, undefined>).literal;
      return cv.literal(lit as string | number | boolean | bigint) as AnyConvexValidator;
    }

    case "picklist": {
      const opts = (schema as unknown as { readonly options: readonly v.Literal[] }).options;
      if (opts.length === 0) {
        throw new Error("valibotToConvex: empty picklist has no Convex equivalent");
      }
      if (opts.length === 1) {
        return cv.literal(opts[0] as string | number | boolean | bigint) as AnyConvexValidator;
      }
      const lits = opts.map((o) => cv.literal(o as string | number | boolean | bigint));
      return cv.union(...(lits as [typeof lits[0], typeof lits[0], ...typeof lits])) as AnyConvexValidator;
    }

    case "enum": {
      const opts = (schema as v.EnumSchema<v.Enum, undefined>).options;
      if (opts.length === 0) {
        throw new Error("valibotToConvex: empty enum has no Convex equivalent");
      }
      const lits = opts.map((o) => cv.literal(o as string | number | boolean | bigint));
      if (lits.length === 1) return lits[0] as AnyConvexValidator;
      return cv.union(...(lits as [typeof lits[0], typeof lits[0], ...typeof lits])) as AnyConvexValidator;
    }

    case "array": {
      const item = (schema as v.ArraySchema<AnyValibotSchema, undefined>).item;
      return cv.array(convert(item, useOutput, visited)) as AnyConvexValidator;
    }

    case "object":
    case "strict_object":
    case "loose_object": {
      const entries = (schema as v.ObjectSchema<v.ObjectEntries, undefined>).entries;
      const out: Record<string, AnyConvexValidator> = {};
      for (const [k, child] of Object.entries(entries)) {
        out[k] = convert(child as AnyValibotSchema, useOutput, visited);
      }
      return cv.object(out as Record<string, Validator<unknown, "required" | "optional", string>>) as AnyConvexValidator;
    }

    case "optional":
    case "exact_optional": {
      const inner = (schema as v.OptionalSchema<AnyValibotSchema, undefined>).wrapped;
      return cv.optional(convert(inner, useOutput, visited)) as AnyConvexValidator;
    }

    case "nullable": {
      const inner = (schema as v.NullableSchema<AnyValibotSchema, undefined>).wrapped;
      const converted = convert(inner, useOutput, visited);
      return cv.union(converted, cv.null()) as AnyConvexValidator;
    }

    case "nullish": {
      const inner = (schema as v.NullishSchema<AnyValibotSchema, undefined>).wrapped;
      const converted = convert(inner, useOutput, visited);
      return cv.optional(cv.union(converted, cv.null())) as AnyConvexValidator;
    }

    case "union": {
      const opts = (schema as v.UnionSchema<readonly AnyValibotSchema[], undefined>).options;
      if (opts.length === 0) {
        throw new Error("valibotToConvex: empty union has no Convex equivalent");
      }
      if (opts.length === 1) return convert(opts[0]!, useOutput, visited);
      const converted = opts.map((o) => convert(o, useOutput, visited));
      return cv.union(...(converted as [AnyConvexValidator, AnyConvexValidator, ...AnyConvexValidator[]])) as AnyConvexValidator;
    }

    case "variant": {
      const opts = (
        schema as unknown as { readonly options: readonly AnyValibotSchema[] }
      ).options;
      if (opts.length === 0) {
        throw new Error("valibotToConvex: empty variant has no Convex equivalent");
      }
      if (opts.length === 1) return convert(opts[0]!, useOutput, visited);
      const converted = opts.map((o) => convert(o, useOutput, visited));
      return cv.union(...(converted as [AnyConvexValidator, AnyConvexValidator, ...AnyConvexValidator[]])) as AnyConvexValidator;
    }

    case "tuple": {
      const items = (schema as v.TupleSchema<readonly AnyValibotSchema[], undefined>).items;
      if (items.length === 0) return cv.array(cv.any()) as AnyConvexValidator;
      const converted = items.map((i) => convert(i, useOutput, visited));
      const inner = converted.length === 1
        ? converted[0]!
        : cv.union(...(converted as [AnyConvexValidator, AnyConvexValidator, ...AnyConvexValidator[]]));
      return cv.array(inner) as AnyConvexValidator;
    }

    case "record": {
      const rec = schema as unknown as {
        readonly key: AnyValibotSchema;
        readonly value: AnyValibotSchema;
      };
      return cv.record(
        convert(rec.key, useOutput, visited) as Validator<string, "required", string>,
        convert(rec.value, useOutput, visited),
      ) as AnyConvexValidator;
    }

    case "intersect": {
      const opts = (schema as v.IntersectSchema<readonly AnyValibotSchema[], undefined>).options;
      const merged: Record<string, AnyConvexValidator> = {};
      for (const arm of opts) {
        if ((arm as { type: string }).type !== "object") {
          throw new Error(
            "valibotToConvex: intersect of non-object schemas has no Convex equivalent",
          );
        }
        const entries = (arm as v.ObjectSchema<v.ObjectEntries, undefined>).entries;
        for (const [k, child] of Object.entries(entries)) {
          merged[k] = convert(child as AnyValibotSchema, useOutput, visited);
        }
      }
      return cv.object(merged as Record<string, Validator<unknown, "required" | "optional", string>>) as AnyConvexValidator;
    }

    case "lazy": {
      const inner = (schema as v.LazySchema<AnyValibotSchema>).getter(undefined);
      return convert(inner, useOutput, visited);
    }

    default:
      throw new Error(
        `valibotToConvex: unsupported Valibot schema type "${t}". `
        + "Add a branch in valibot-to-convex.ts if Convex has an equivalent.",
      );
  }
}

// ── `vid("tableName")` marker support ───────────────────────────────────────

/** Hidden symbol attached to a Valibot schema produced by `vid(tableName)`.
 *  The converter recognizes it before the regular type dispatch and emits
 *  `cv.id(tableName)` instead of `cv.string()`. */
export const VID_TABLE: unique symbol = Symbol.for("convex-valibot-helpers/vid-table");

function readVidMarker(schema: AnyValibotSchema): string | null {
  const tableName = (schema as unknown as { [VID_TABLE]?: string })[VID_TABLE];
  return typeof tableName === "string" ? tableName : null;
}
