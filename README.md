# convex-valibot-helpers

A **Valibot ↔ Convex** bridge. Convert [Valibot](https://valibot.dev) schemas to
[Convex](https://convex.dev) validators, and build custom queries, mutations, and
actions whose argument validation is driven by Valibot — the same ergonomics the
`convex-helpers` Zod integration gives you, but on Valibot.

```bash
bun add convex-valibot-helpers   # or: npm i convex-valibot-helpers
```

`convex` and `valibot` are peer dependencies — bring your own versions.

## Quick start

```ts
import * as v from "valibot";
import { query } from "./_generated/server";
import {
  vid,
  valibotToConvex,
  valibotToConvexFields,
  vCustomQuery,
  customCtx,
} from "convex-valibot-helpers";

// 1. Convert a Valibot schema to a Convex validator
const User = v.object({ name: v.string(), age: v.number() });
const userValidator = valibotToConvex(User); // Convex `Validator`

// 2. Branded Convex IDs
const ref = vid("users"); // round-trips with Convex `v.id("users")`

// 3. Field maps for table schemas / function args
const fields = valibotToConvexFields({ name: v.string(), owner: vid("users") });

// 4. Custom function builders with Valibot-validated args
const authedQuery = vCustomQuery(query, customCtx(async (ctx) => ({ user: /* ... */ })));
export const getProfile = authedQuery({
  args: { id: vid("users") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});
```

## API surface

The Valibot API mirrors the Zod helpers from `convex-helpers`:

| Zod (`convex-helpers`) | This package | Role |
|---|---|---|
| `zid("table")` | `vid("table")` | Branded Convex `Id<"table">` schema |
| `zodToConvex(s)` | `valibotToConvex(s)` | Schema → Convex validator (input shape) |
| `zodOutputToConvex(s)` | `valibotOutputToConvex(s)` | Schema → Convex validator (output shape) |
| `zodToConvexFields(map)` | `valibotToConvexFields(map)` | Field map → `PropertyValidators` |
| `zodOutputToConvexFields(map)` | `valibotOutputToConvexFields(map)` | Field map → `PropertyValidators` (output) |
| `zCustomQuery(query, c)` | `vCustomQuery(query, c)` | Custom query builder |
| `zCustomMutation(mut, c)` | `vCustomMutation(mut, c)` | Custom mutation builder |
| `zCustomAction(act, c)` | `vCustomAction(act, c)` | Custom action builder |
| `ZCustomCtx<B>` | `VCustomCtx<B>` | Builder ctx extractor |

Also exported (not Valibot-specific): `withSystemFields`, `customCtx`, `NoOp`,
`Customization`, `Registration`, `CustomBuilder`.

## Conversion notes

- `v.pipe(...)` is transparent for shape conversion. Branded IDs
  (`v.pipe(v.string(), v.brand("X"))`) emit `cv.string()` because the runtime
  shape is unchanged.
- `v.intersect([...])` only collapses cleanly when every operand is
  `v.object(...)`.
- `v.lazy(() => X)` resolves once at conversion; genuine cycles fall back to
  `cv.any()`.
- `v.transform()` outputs are treated as identity-shaped — structural transforms
  cannot be inferred from the schema at runtime.

## Tests

```bash
bun test
```

Per-kind converter tests cover primitives, literals/picklists, containers,
optional/nullable/nullish, unions/variants, intersect, pipes, `vid`, and
`withSystemFields`.

## License

MIT
