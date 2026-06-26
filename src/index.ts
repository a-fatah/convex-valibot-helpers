// Public API for convex-valibot-helpers.
// Valibot ↔ Convex bridge: vCustomQuery/Mutation/Action, vid, withSystemFields,
// valibotToConvex/valibotOutputToConvex. Provides the same ergonomics as the
// Zod helpers in `convex-helpers`, but built on Valibot.
//
// Name parity (Zod → Valibot):
//   zid                    → vid
//   zodToConvex            → valibotToConvex
//   zodOutputToConvex      → valibotOutputToConvex
//   zodToConvexFields      → valibotToConvexFields
//   zodOutputToConvexFields → valibotOutputToConvexFields
//   zCustomQuery           → vCustomQuery
//   zCustomMutation        → vCustomMutation
//   zCustomAction          → vCustomAction
//   ZCustomCtx             → VCustomCtx
//
// `withSystemFields`, `customCtx`, `NoOp`, `Customization`, `Registration`,
// and `CustomBuilder` keep their names — they are not Valibot-specific.

export { vid, type Vid } from "./vid";
export { withSystemFields } from "./system-fields";
export {
  valibotToConvex,
  valibotOutputToConvex,
  type AnyConvexValidator,
  type AnyValibotSchema,
} from "./valibot-to-convex";
export {
  valibotToConvexFields,
  valibotOutputToConvexFields,
  type ValibotFields,
} from "./fields";
export {
  vCustomQuery,
  vCustomMutation,
  vCustomAction,
  type CustomBuilder,
  type VCustomCtx,
} from "./custom-functions";
export { customCtx, NoOp, type Customization, type Registration } from "./customization";
