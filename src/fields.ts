// Field-level conveniences over `valibotToConvex` / `valibotOutputToConvex`.
//
// `defineSchema({ users: defineTable(...) })` expects a `{ key: Validator }`
// map for each table; `args:` on a query/mutation/action expects the same.
// These helpers turn a `{ key: ValibotSchema }` map into that shape with one
// call. Counterpart to `zodToConvexFields` / `zodOutputToConvexFields`.
//
// Generic over the field map's shape AND per-field optionality so callers see
// `?:` markers in inferred args for fields wrapped in `v.optional(...)`. Without
// this, every arg would be required-with-undefined — broken for any optional
// filter / form input.

import * as v from "valibot";
import type { Validator } from "convex/values";
import {
  type AnyValibotSchema,
  valibotOutputToConvex,
  valibotToConvex,
} from "./valibot-to-convex.js";

export type ValibotFields = Record<string, AnyValibotSchema>;

/** True if `S` is `v.OptionalSchema<...>` or `v.NullishSchema<...>` —
 *  the Valibot wrappers that map to a Convex `Validator<_, "optional", _>`. */
type IsValibotOptional<S extends AnyValibotSchema> =
  S extends v.OptionalSchema<AnyValibotSchema, unknown>
    ? true
    : S extends v.NullishSchema<AnyValibotSchema, unknown>
      ? true
      : S extends v.ExactOptionalSchema<AnyValibotSchema, unknown>
        ? true
        : false;

type OptionalityOf<S extends AnyValibotSchema> =
  IsValibotOptional<S> extends true ? "optional" : "required";

/** Input-shape conversion — for function arg validators. Preserves per-field
 *  types AND optionality so `args:` on a query/mutation gets precise inference. */
export function valibotToConvexFields<F extends ValibotFields>(
  fields: F,
): { [K in keyof F]: Validator<v.InferInput<F[K]>, OptionalityOf<F[K]>, string> } {
  const out: Record<string, Validator<unknown, "required" | "optional", string>> = {};
  for (const [k, schema] of Object.entries(fields)) {
    out[k] = valibotToConvex(schema) as Validator<unknown, "required" | "optional", string>;
  }
  return out as { [K in keyof F]: Validator<v.InferInput<F[K]>, OptionalityOf<F[K]>, string> };
}

/** Output-shape conversion — for return-value validators and table storage.
 *  Preserves per-field types and optionality. */
export function valibotOutputToConvexFields<F extends ValibotFields>(
  fields: F,
): { [K in keyof F]: Validator<v.InferOutput<F[K]>, OptionalityOf<F[K]>, string> } {
  const out: Record<string, Validator<unknown, "required" | "optional", string>> = {};
  for (const [k, schema] of Object.entries(fields)) {
    out[k] = valibotOutputToConvex(schema) as Validator<unknown, "required" | "optional", string>;
  }
  return out as { [K in keyof F]: Validator<v.InferOutput<F[K]>, OptionalityOf<F[K]>, string> };
}
