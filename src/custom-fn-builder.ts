// Private function-builder runtime shared by vCustomQuery/Mutation/Action.
// Ported from convex-zod/src/custom-fn-builder.ts — same structure, Zod
// replaced with Valibot.
//
// Valibot is tree-shakable by construction (no `zod/mini` workaround needed),
// so the runtime stays a single import of `valibot`.
//
// The onSuccess hook is preserved even though we don't currently use it.

import { ConvexError } from "convex/values";
import type { Value } from "convex/values";
import * as v from "valibot";

import { addFieldsToValidator } from "./v-required";
import { pick } from "./utils";
import { valibotToConvexFields, type ValibotFields } from "./fields";
import { valibotOutputToConvex, type AnyValibotSchema } from "./valibot-to-convex";
import type { Customization } from "./customization";
import { NoOp } from "./customization";

/** Heuristic for "is this a Valibot schema instance?" Mirrors the
 *  `instanceof zCore.$ZodType` check on the Zod side. Valibot doesn't
 *  expose a base class, but every schema carries `kind: "schema"` plus
 *  `type: string` at runtime. */
function isValibotSchema(x: unknown): x is AnyValibotSchema {
  return (
    typeof x === "object"
    && x !== null
    && (x as { kind?: unknown }).kind === "schema"
    && typeof (x as { type?: unknown }).type === "string"
  );
}

/** Heuristic for "is this a Valibot OBJECT schema instance?" */
function isValibotObjectSchema(
  x: AnyValibotSchema,
): x is v.ObjectSchema<v.ObjectEntries, undefined> {
  return (x as { type: string }).type === "object";
}

export function customFnBuilder(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  builder: (args: any) => any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customization: Customization<any, any, any, any, any>,
) {
  const customInput: Customization<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any, any, any, any, any
  >["input"] = customization.input ?? NoOp.input;
  const inputArgs = customization.args ?? NoOp.args;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function customBuilder(fn: any): any {
    const {
      args,
      handler = fn,
      skipConvexValidation = false,
      returns: maybeReturns,
      ...extra
    } = fn;

    // `returns` may be either a Valibot schema OR a field map. Normalize to
    // a single Valibot object schema for the post-handler `v.parse` step.
    const returns: AnyValibotSchema | undefined =
      maybeReturns === undefined
        ? undefined
        : isValibotSchema(maybeReturns)
          ? maybeReturns
          : v.object(maybeReturns as ValibotFields);

    const returnValidator =
      returns && !skipConvexValidation
        ? { returns: valibotOutputToConvex(returns) }
        : null;

    if (args) {
      // `args` may be either a Valibot object schema OR a `{key: schema}`
      // field map. Normalize to a field map for downstream conversion + parse.
      let argsFields: ValibotFields;
      if (isValibotSchema(args)) {
        if (isValibotObjectSchema(args)) {
          argsFields = args.entries as ValibotFields;
        } else {
          throw new Error(
            "Unsupported valibot type as args validator: " + (args as { type: string }).type,
          );
        }
      } else {
        argsFields = args as ValibotFields;
      }

      const convexValidator = valibotToConvexFields(argsFields);
      return builder({
        args: skipConvexValidation
          ? undefined
          : addFieldsToValidator(convexValidator, inputArgs),
        ...returnValidator,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: async (ctx: any, allArgs: any) => {
          const added = await customInput(
            ctx,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pick(allArgs, Object.keys(inputArgs)) as any,
            extra,
          );
          const rawArgs = pick(allArgs, Object.keys(argsFields));
          // Delegate to the object parser rather than a per-field loop so
          // `v.optional` / `v.exactOptional` semantics for absent keys
          // match what users expect from a Valibot object schema.
          const parsed = v.safeParse(v.object(argsFields), rawArgs);
          if (!parsed.success) {
            throw new ConvexError({
              ValibotError: JSON.parse(
                JSON.stringify(parsed.issues, null, 2),
              ) as Value[],
            });
          }
          const parsedArgs = parsed.output as Record<string, unknown>;
          const finalCtx = { ...ctx, ...added.ctx };
          const finalArgs = { ...parsedArgs, ...added.args };
          const ret = await handler(finalCtx, finalArgs);
          // Valibot has no `parseAsync` — a normal `v.parse` is fine
          // because we don't allow async transforms in this package.
          const result = returns ? v.parse(returns, ret === undefined ? null : ret) : ret;
          if (added.onSuccess) {
            await added.onSuccess({ ctx, args: parsedArgs, result });
          }
          return result;
        },
      });
    }

    if (skipConvexValidation && Object.keys(inputArgs).length > 0) {
      throw new Error(
        "If you're using a custom function with arguments for the input "
          + "customization, you cannot skip convex validation.",
      );
    }

    return builder({
      ...returnValidator,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: async (ctx: any, args: any) => {
        const added = await customInput(ctx, args, extra);
        const finalCtx = { ...ctx, ...added.ctx };
        const finalArgs = { ...args, ...added.args };
        const ret = await handler(finalCtx, finalArgs);
        const result = returns ? v.parse(returns, ret === undefined ? null : ret) : ret;
        if (added.onSuccess) {
          await added.onSuccess({ ctx, args, result });
        }
        return result;
      },
    });
  };
}
