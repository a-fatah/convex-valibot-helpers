// vCustomQuery / vCustomMutation / vCustomAction.
// Ported from convex-zod/src/custom-functions.ts — same signatures, Zod
// replaced with Valibot. Preserves the convex-helpers customization pattern
// (vCustomQuery(builder, customization) -> builder that takes args + handler).

import type {
  ActionBuilder,
  FunctionVisibility,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
} from "convex/server";
import type { PropertyValidators } from "convex/values";

import { customFnBuilder } from "./custom-fn-builder.js";
import { NoOp, type Customization } from "./customization.js";
import type { Overwrite } from "./utils.js";
import type { CustomBuilder } from "./types/custom-builder.js";

export type { CustomBuilder };

export type VCustomCtx<Builder> =
  Builder extends CustomBuilder<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    infer CustomCtx,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    infer InputCtx,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >
    ? Overwrite<InputCtx, CustomCtx>
    : never;

export function vCustomQuery<
  CustomArgsValidator extends PropertyValidators,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomCtx extends Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomMadeArgs extends Record<string, any>,
  Visibility extends FunctionVisibility,
  DataModel extends GenericDataModel,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExtraArgs extends Record<string, any> = object,
>(
  query: QueryBuilder<DataModel, Visibility>,
  customization: Customization<
    GenericQueryCtx<DataModel>,
    CustomArgsValidator,
    CustomCtx,
    CustomMadeArgs,
    ExtraArgs
  > = NoOp as unknown as Customization<
    GenericQueryCtx<DataModel>,
    CustomArgsValidator,
    CustomCtx,
    CustomMadeArgs,
    ExtraArgs
  >,
) {
  return customFnBuilder(query, customization) as CustomBuilder<
    "query",
    CustomArgsValidator,
    CustomCtx,
    CustomMadeArgs,
    GenericQueryCtx<DataModel>,
    Visibility,
    ExtraArgs
  >;
}

export function vCustomMutation<
  CustomArgsValidator extends PropertyValidators,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomCtx extends Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomMadeArgs extends Record<string, any>,
  Visibility extends FunctionVisibility,
  DataModel extends GenericDataModel,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExtraArgs extends Record<string, any> = object,
>(
  mutation: MutationBuilder<DataModel, Visibility>,
  customization: Customization<
    GenericMutationCtx<DataModel>,
    CustomArgsValidator,
    CustomCtx,
    CustomMadeArgs,
    ExtraArgs
  > = NoOp as unknown as Customization<
    GenericMutationCtx<DataModel>,
    CustomArgsValidator,
    CustomCtx,
    CustomMadeArgs,
    ExtraArgs
  >,
) {
  return customFnBuilder(mutation, customization) as CustomBuilder<
    "mutation",
    CustomArgsValidator,
    CustomCtx,
    CustomMadeArgs,
    GenericMutationCtx<DataModel>,
    Visibility,
    ExtraArgs
  >;
}

export function vCustomAction<
  CustomArgsValidator extends PropertyValidators,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomCtx extends Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomMadeArgs extends Record<string, any>,
  Visibility extends FunctionVisibility,
  DataModel extends GenericDataModel,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExtraArgs extends Record<string, any> = object,
>(
  action: ActionBuilder<DataModel, Visibility>,
  customization: Customization<
    GenericActionCtx<DataModel>,
    CustomArgsValidator,
    CustomCtx,
    CustomMadeArgs,
    ExtraArgs
  > = NoOp as unknown as Customization<
    GenericActionCtx<DataModel>,
    CustomArgsValidator,
    CustomCtx,
    CustomMadeArgs,
    ExtraArgs
  >,
) {
  return customFnBuilder(action, customization) as CustomBuilder<
    "action",
    CustomArgsValidator,
    CustomCtx,
    CustomMadeArgs,
    GenericActionCtx<DataModel>,
    Visibility,
    ExtraArgs
  >;
}
