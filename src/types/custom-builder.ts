// Type machinery for the CustomBuilder<> returned by vCustomQuery / vCustomMutation / vCustomAction.
// Ported from convex-zod/src/types/custom-builder.ts — same structural shape with Zod
// type-level helpers swapped for Valibot's `v.InferInput` / `v.InferOutput`.

import * as v from "valibot";
import type {
  ArgsArrayToObject,
  DefaultFunctionArgs,
  FunctionVisibility,
} from "convex/server";
import type {
  ObjectType,
  PropertyValidators,
} from "convex/values";

import type { Expand, Overwrite } from "../utils.js";
import type { Registration } from "../customization.js";

export type AnyValibotSchema = v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
export type ValibotFields = Record<string, AnyValibotSchema>;

type NullToUndefinedOrNull<T> = T extends null ? T | undefined | void : T;
type Returns<T> = Promise<NullToUndefinedOrNull<T>> | NullToUndefinedOrNull<T>;

/** A Valibot object schema with arbitrary entries. */
type AnyValibotObjectSchema = v.ObjectSchema<v.ObjectEntries, undefined>;

// Detour through `v.ObjectSchema<F>` so Valibot's own inference applies the
// `?:` optional marker for fields wrapped in `v.optional`. Per-field
// `v.InferInput<F[K]>` would erase that marker.
type FieldsInferInput<F extends ValibotFields> = v.InferInput<v.ObjectSchema<F, undefined>>;
type FieldsInferOutput<F extends ValibotFields> = v.InferOutput<v.ObjectSchema<F, undefined>>;

export type ReturnValueInput<
  ReturnsValidator extends AnyValibotSchema | ValibotFields | void,
> = [ReturnsValidator] extends [AnyValibotSchema]
  ? Returns<v.InferInput<ReturnsValidator>>
  : [ReturnsValidator] extends [ValibotFields]
    ? Returns<FieldsInferInput<ReturnsValidator>>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : any;

export type ReturnValueOutput<
  ReturnsValidator extends AnyValibotSchema | ValibotFields | void,
> = [ReturnsValidator] extends [AnyValibotSchema]
  ? Returns<v.InferOutput<ReturnsValidator>>
  : [ReturnsValidator] extends [ValibotFields]
    ? Returns<FieldsInferOutput<ReturnsValidator>>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : any;

type OneArgArray<ArgsObject extends DefaultFunctionArgs = DefaultFunctionArgs> =
  [ArgsObject];

export type ArgsInput<
  ArgsValidator extends ValibotFields | AnyValibotObjectSchema | void,
> = [ArgsValidator] extends [AnyValibotObjectSchema]
  ? [v.InferInput<ArgsValidator>]
  : ArgsValidator extends Record<string, never>
    ? [Record<string, never>]
    : [ArgsValidator] extends [ValibotFields]
      ? [FieldsInferInput<ArgsValidator>]
      : OneArgArray;

export type ArgsOutput<
  ArgsValidator extends ValibotFields | AnyValibotObjectSchema | void,
> = [ArgsValidator] extends [AnyValibotObjectSchema]
  ? [v.InferOutput<ArgsValidator>]
  : [ArgsValidator] extends [ValibotFields]
    ? [FieldsInferOutput<ArgsValidator>]
    : OneArgArray;

type ArgsForHandlerType<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OneOrZeroArgs extends [] | [Record<string, any>],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomMadeArgs extends Record<string, any>,
> =
  CustomMadeArgs extends Record<string, never>
    ? OneOrZeroArgs
    : OneOrZeroArgs extends [infer A]
      ? [Expand<A & CustomMadeArgs>]
      : [CustomMadeArgs];

export type CustomBuilder<
  FuncType extends "query" | "mutation" | "action",
  CustomArgsValidator extends PropertyValidators,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomCtx extends Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CustomMadeArgs extends Record<string, any>,
  InputCtx,
  Visibility extends FunctionVisibility,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExtraArgs extends Record<string, any>,
> = {
  <
    ArgsValidator extends ValibotFields | AnyValibotObjectSchema | void,
    ReturnsValibotValidator extends AnyValibotSchema | ValibotFields | void = void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ReturnValue extends ReturnValueInput<ReturnsValibotValidator> = any,
  >(
    func:
      | ({
          args?: ArgsValidator;
          handler: (
            ctx: Overwrite<InputCtx, CustomCtx>,
            ...args: ArgsForHandlerType<
              ArgsOutput<ArgsValidator>,
              CustomMadeArgs
            >
          ) => ReturnValue;
          returns?: ReturnsValibotValidator;
          skipConvexValidation?: boolean;
        } & {
          [key in keyof ExtraArgs as key extends
            | "args"
            | "handler"
            | "skipConvexValidation"
            | "returns"
            ? never
            : key]: ExtraArgs[key];
        })
      | {
          (
            ctx: Overwrite<InputCtx, CustomCtx>,
            ...args: ArgsForHandlerType<
              ArgsOutput<ArgsValidator>,
              CustomMadeArgs
            >
          ): ReturnValue;
        },
  ): Registration<
    FuncType,
    Visibility,
    ArgsArrayToObject<
      CustomArgsValidator extends Record<string, never>
        ? ArgsInput<ArgsValidator>
        : ArgsInput<ArgsValidator> extends [infer A]
          ? [Expand<A & ObjectType<CustomArgsValidator>>]
          : [ObjectType<CustomArgsValidator>]
    >,
    ReturnsValibotValidator extends void
      ? ReturnValue
      : ReturnValueOutput<ReturnsValibotValidator>
  >;
};
