/**
 * Per-kind converter tests — verify each Valibot schema kind maps to the
 * expected Convex validator. Uses ad-hoc Valibot schemas only; tests that
 * round-trip our actual workout-domain schemas live in
 * apps/integration-tests so this package stays domain-agnostic.
 *
 * Approach: introspect the resulting Convex validator's `.kind` and
 * `.isOptional` rather than running it. That's what `convex-helpers`'
 * own tests do — full execution would need a Convex deployment.
 */

import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import {
  valibotOutputToConvex,
  valibotToConvex,
  valibotToConvexFields,
  vid,
  withSystemFields,
} from "./index";

// ── Per-kind dispatch ───────────────────────────────────────────────────────

describe("valibotToConvex — primitive kinds", () => {
  test("v.string() → kind: string", () => {
    const c = valibotToConvex(v.string());
    expect(c.kind).toBe("string");
    expect(c.isOptional).toBe("required");
  });
  test("v.number() → kind: float64", () => {
    expect(valibotToConvex(v.number()).kind).toBe("float64");
  });
  test("v.boolean() → kind: boolean", () => {
    expect(valibotToConvex(v.boolean()).kind).toBe("boolean");
  });
  test("v.null_() → kind: null", () => {
    expect(valibotToConvex(v.null_()).kind).toBe("null");
  });
  test("v.bigint() → kind: int64", () => {
    expect(valibotToConvex(v.bigint()).kind).toBe("int64");
  });
  test("v.any() → kind: any", () => {
    expect(valibotToConvex(v.any()).kind).toBe("any");
  });
  test("v.unknown() → kind: any", () => {
    expect(valibotToConvex(v.unknown()).kind).toBe("any");
  });
});

describe("valibotToConvex — literals and picklists", () => {
  test("v.literal('foo') → kind: literal", () => {
    expect(valibotToConvex(v.literal("foo")).kind).toBe("literal");
  });
  test("v.picklist(['a']) (single) → kind: literal", () => {
    expect(valibotToConvex(v.picklist(["a"])).kind).toBe("literal");
  });
  test("v.picklist(['a', 'b']) → kind: union of literals", () => {
    expect(valibotToConvex(v.picklist(["a", "b"])).kind).toBe("union");
  });
});

describe("valibotToConvex — containers", () => {
  test("v.array(v.string()) → kind: array, element kind: string", () => {
    const c = valibotToConvex(v.array(v.string()));
    expect(c.kind).toBe("array");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((c as any).element.kind).toBe("string");
  });

  test("v.object({a: v.string()}) → kind: object with field a", () => {
    const c = valibotToConvex(v.object({ a: v.string() }));
    expect(c.kind).toBe("object");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((c as any).fields.a.kind).toBe("string");
  });

  test("v.tuple([v.string(), v.number()]) → kind: array of union", () => {
    expect(valibotToConvex(v.tuple([v.string(), v.number()])).kind).toBe("array");
  });

  test("v.record(v.string(), v.number()) → kind: record", () => {
    expect(valibotToConvex(v.record(v.string(), v.number())).kind).toBe("record");
  });
});

describe("valibotToConvex — optional / nullable / nullish", () => {
  test("v.optional(v.string()) marks kind: string + isOptional: optional", () => {
    const c = valibotToConvex(v.optional(v.string()));
    expect(c.kind).toBe("string");
    expect(c.isOptional).toBe("optional");
  });

  test("v.exactOptional(v.string()) maps to the same Convex shape as v.optional", () => {
    // exactOptional differs from optional only at the Valibot type-inference
    // layer; Convex models presence/absence the same way for both.
    const c = valibotToConvex(v.exactOptional(v.string()));
    expect(c.kind).toBe("string");
    expect(c.isOptional).toBe("optional");
  });

  test("v.nullable(v.string()) → kind: union (string | null)", () => {
    expect(valibotToConvex(v.nullable(v.string())).kind).toBe("union");
  });

  test("v.nullish(v.string()) → optional union", () => {
    const c = valibotToConvex(v.nullish(v.string()));
    expect(c.isOptional).toBe("optional");
    expect(c.kind).toBe("union");
  });

  test("a shared optional schema instance reused across sibling fields keeps its optionality on every occurrence", () => {
    // Regression: `visited` is a cycle-breaker for true recursion, but it must
    // be PATH-scoped. A single optional schema object reused across sibling
    // branches (a DAG, not a cycle) previously collapsed to `cv.any()`
    // (required) on its 2nd+ occurrence, silently dropping optionality.
    const shared = v.optional(v.nullable(v.string()));
    const c = valibotToConvex(
      v.variant("type", [
        v.object({ type: v.literal("a"), elementId: shared }),
        v.object({ type: v.literal("b"), elementId: shared }),
        v.object({ type: v.literal("c"), elementId: shared }),
      ]),
    );
    expect(c.kind).toBe("union");
    const arms = (c as unknown as { members: Array<{ fields: Record<string, { isOptional: string }> }> }).members;
    for (const arm of arms) {
      expect(arm.fields.elementId.isOptional).toBe("optional");
    }
  });
});

describe("valibotToConvex — unions and variants", () => {
  test("v.union([a, b]) → kind: union", () => {
    const c = valibotToConvex(v.union([v.string(), v.number()]));
    expect(c.kind).toBe("union");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((c as any).members).toHaveLength(2);
  });

  test("v.union with one option collapses to the inner validator", () => {
    expect(valibotToConvex(v.union([v.string()])).kind).toBe("string");
  });

  test("v.variant('kind', [...]) → kind: union of objects", () => {
    const schema = v.variant("kind", [
      v.object({ kind: v.literal("a"), x: v.string() }),
      v.object({ kind: v.literal("b"), y: v.number() }),
    ]);
    expect(valibotToConvex(schema).kind).toBe("union");
  });
});

describe("valibotToConvex — intersect", () => {
  test("intersect of two objects merges fields", () => {
    const schema = v.intersect([
      v.object({ a: v.string() }),
      v.object({ b: v.number() }),
    ]);
    const c = valibotToConvex(schema);
    expect(c.kind).toBe("object");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(Object.keys((c as any).fields).sort()).toEqual(["a", "b"]);
  });

  test("intersect of a non-object throws", () => {
    expect(() => valibotToConvex(v.intersect([v.string(), v.number()]))).toThrow();
  });
});

describe("valibotToConvex — pipes pass through to base schema", () => {
  test("v.pipe(v.string(), v.email()) → kind: string", () => {
    expect(valibotToConvex(v.pipe(v.string(), v.email())).kind).toBe("string");
  });

  test("transform output type is ignored (input-shape semantics)", () => {
    expect(
      valibotToConvex(v.pipe(v.string(), v.transform((s) => s.length))).kind,
    ).toBe("string");
  });
});

describe("valibotOutputToConvex", () => {
  test("for a shape-preserving transform (e.g. ID branding), input == output kind", () => {
    const branded = v.pipe(v.string(), v.transform((s) => s as string & { _brand: "X" }));
    expect(valibotOutputToConvex(branded).kind).toBe("string");
    expect(valibotToConvex(branded).kind).toBe("string");
  });
});

// ── vid("table") ────────────────────────────────────────────────────────────

describe("vid()", () => {
  test("returns a Valibot schema that parses non-empty strings", () => {
    const Schema = vid("users");
    expect(v.parse(Schema, "j57x9")).toBe("j57x9");
    expect(v.safeParse(Schema, "").success).toBe(false);
    expect(v.safeParse(Schema, 42).success).toBe(false);
  });

  test("converter emits cv.id(tableName) for a vid schema", () => {
    const c = valibotToConvex(vid("users"));
    expect(c.kind).toBe("id");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((c as any).tableName).toBe("users");
  });
});

// ── withSystemFields ─────────────────────────────────────────────────────────

describe("withSystemFields", () => {
  test("adds _id (vid) and _creationTime (number) to a field map", () => {
    const fields = withSystemFields("users", { name: v.string() });
    const cv = valibotToConvexFields(fields);
    expect(cv._id?.kind).toBe("id");
    expect(cv._creationTime?.kind).toBe("float64");
    expect(cv.name?.kind).toBe("string");
  });
});
