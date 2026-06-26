// customCtx, NoOp, Customization, Registration.
// Ported from convex-helpers/server/customFunctions.ts (lines 78-203, 539-548).
// Pure types + tiny runtime — no Zod dependency. Porting these lets us drop
// the convex-helpers package entirely from apps/backend.

import type { ObjectType, PropertyValidators } from "convex/values";
import type {
  FunctionVisibility,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
  DefaultFunctionArgs,
} from "convex/server";

export type Customization<
  Ctx extends Record<string, any>,
  CustomArgsValidator extends PropertyValidators,
  CustomCtx extends Record<string, any>,
  CustomMadeArgs extends Record<string, any>,
  ExtraArgs extends Record<string, any> = Record<string, any>,
> = {
  args: CustomArgsValidator;
  input: (
    ctx: Ctx,
    args: ObjectType<CustomArgsValidator>,
    extra: ExtraArgs,
  ) =>
    | Promise<{
        ctx: CustomCtx;
        args: CustomMadeArgs;
        onSuccess?: (obj: {
          ctx: Ctx;
          args: Record<string, unknown>;
          result: unknown;
        }) => void | Promise<void>;
      }>
    | {
        ctx: CustomCtx;
        args: CustomMadeArgs;
        onSuccess?: (obj: {
          ctx: Ctx;
          args: Record<string, unknown>;
          result: unknown;
        }) => void | Promise<void>;
      };
};

export function customCtx<
  InCtx extends Record<string, any>,
  OutCtx extends Record<string, any>,
  ExtraArgs extends Record<string, any> = Record<string, any>,
>(
  modifyCtx: (original: InCtx, extra: ExtraArgs) => Promise<OutCtx> | OutCtx,
): Customization<
  InCtx,
  Record<string, never>,
  OutCtx,
  Record<string, never>,
  ExtraArgs
> {
  return {
    args: {},
    input: async (ctx, _, extra) => ({
      ctx: await modifyCtx(ctx, extra),
      args: {},
    }),
  };
}

export const NoOp = {
  args: {},
  input() {
    return { args: {}, ctx: {} };
  },
};

export type Registration<
  FuncType extends "query" | "mutation" | "action",
  Visibility extends FunctionVisibility,
  Args extends DefaultFunctionArgs,
  Output,
> = {
  query: RegisteredQuery<Visibility, Args, Output>;
  mutation: RegisteredMutation<Visibility, Args, Output>;
  action: RegisteredAction<Visibility, Args, Output>;
}[FuncType];
