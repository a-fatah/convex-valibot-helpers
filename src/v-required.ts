// vRequired() + addFieldsToValidator() ported from convex-helpers/validators.ts
// (lines 318-396, 924-1047) so we don't take a runtime dependency on convex-helpers.
// The runtime logic walks Convex validator kinds — no Zod involvement.

import { v } from "convex/values";
import type {
  GenericValidator,
  ObjectType,
  OptionalProperty,
  PropertyValidators,
  Validator,
  VAny,
  VArray,
  VBoolean,
  VBytes,
  VFloat64,
  VId,
  VInt64,
  VLiteral,
  VNull,
  VObject,
  VRecord,
  VString,
  VUnion,
} from "convex/values";

import type { Expand, NotUndefined } from "./utils";

export type VRequired<T extends Validator<any, OptionalProperty, any>> =
  T extends VId<infer Type, OptionalProperty>
    ? VId<NotUndefined<Type>, "required">
    : T extends VString<infer Type, OptionalProperty>
      ? VString<NotUndefined<Type>, "required">
      : T extends VFloat64<infer Type, OptionalProperty>
        ? VFloat64<NotUndefined<Type>, "required">
        : T extends VInt64<infer Type, OptionalProperty>
          ? VInt64<NotUndefined<Type>, "required">
          : T extends VBoolean<infer Type, OptionalProperty>
            ? VBoolean<NotUndefined<Type>, "required">
            : T extends VNull<infer Type, OptionalProperty>
              ? VNull<NotUndefined<Type>, "required">
              : T extends VAny<infer Type, OptionalProperty>
                ? VAny<NotUndefined<Type>, "required">
                : T extends VLiteral<infer Type, OptionalProperty>
                  ? VLiteral<NotUndefined<Type>, "required">
                  : T extends VBytes<infer Type, OptionalProperty>
                    ? VBytes<NotUndefined<Type>, "required">
                    : T extends VObject<
                          infer Type,
                          infer Fields,
                          OptionalProperty,
                          infer FieldPaths
                        >
                      ? VObject<NotUndefined<Type>, Fields, "required", FieldPaths>
                      : T extends VArray<
                            infer Type,
                            infer Element,
                            OptionalProperty
                          >
                        ? VArray<NotUndefined<Type>, Element, "required">
                        : T extends VRecord<
                              infer Type,
                              infer Key,
                              infer Value,
                              OptionalProperty,
                              infer FieldPaths
                            >
                          ? VRecord<
                              NotUndefined<Type>,
                              Key,
                              Value,
                              "required",
                              FieldPaths
                            >
                          : T extends VUnion<
                                infer Type,
                                infer Members,
                                OptionalProperty,
                                infer FieldPaths
                              >
                            ? VUnion<
                                NotUndefined<Type>,
                                Members,
                                "required",
                                FieldPaths
                              >
                            : never;

export function vRequired<T extends Validator<any, OptionalProperty, any>>(
  validator: T,
): VRequired<T> {
  const { kind, isOptional } = validator;
  if (isOptional === "required") {
    return validator as unknown as VRequired<T>;
  }

  switch (kind) {
    case "id":
      return v.id(validator.tableName) as VRequired<T>;
    case "string":
      return v.string() as VRequired<T>;
    case "float64":
      return v.float64() as VRequired<T>;
    case "int64":
      return v.int64() as VRequired<T>;
    case "boolean":
      return v.boolean() as VRequired<T>;
    case "null":
      return v.null() as VRequired<T>;
    case "any":
      return v.any() as VRequired<T>;
    case "literal":
      return v.literal(validator.value) as VRequired<T>;
    case "bytes":
      return v.bytes() as VRequired<T>;
    case "object":
      return v.object(validator.fields) as VRequired<T>;
    case "array":
      return v.array(validator.element) as VRequired<T>;
    case "record":
      return v.record(validator.key, validator.value) as VRequired<T>;
    case "union":
      return v.union(...validator.members) as VRequired<T>;
    default:
      kind satisfies never;
      throw new Error("Unknown Convex validator type: " + kind);
  }
}

export type AddFieldsToValidator<
  V extends Validator<any, any, any>,
  Fields extends PropertyValidators,
> =
  V extends VObject<infer T, infer F, infer O>
    ? VObject<Expand<T & ObjectType<Fields>>, Expand<F & Fields>, O>
    : Validator<
        Expand<V["type"] & ObjectType<Fields>>,
        V["isOptional"],
        V["fieldPaths"] &
          {
            [Property in keyof Fields & string]:
              | `${Property}.${Fields[Property]["fieldPaths"]}`
              | Property;
          }[keyof Fields & string] &
          string
      >;

function intersectValidators(
  fields: PropertyValidators,
  fields2: PropertyValidators,
): PropertyValidators {
  const merged = { ...fields };
  for (const [k, vNext] of Object.entries(fields2)) {
    const existing = merged[k];
    if (existing) {
      if (existing.kind !== vNext.kind) {
        throw new Error(
          `Cannot intersect validators with different kinds: ${existing.kind} and ${vNext.kind}`,
        );
      }
      if (existing.isOptional !== vNext.isOptional) {
        if (existing.isOptional === "optional") {
          merged[k] = vNext;
        }
      }
    } else {
      merged[k] = vNext;
    }
  }
  return merged;
}

export function addFieldsToValidator<
  Props extends PropertyValidators,
  Fields extends PropertyValidators,
>(
  validator: Props,
  fields: Fields,
): VObject<ObjectType<Props & Fields>, Props & Fields, "required">;
export function addFieldsToValidator<
  V extends VObject<any, any, any>,
  Fields extends PropertyValidators,
>(
  validator: V,
  fields: Fields,
): VObject<
  V["type"] & ObjectType<Fields>,
  V["fields"] & Fields,
  V["isOptional"]
>;
export function addFieldsToValidator<
  V extends VUnion<any, any[], any>,
  Fields extends PropertyValidators,
>(validator: V, fields: Fields): AddFieldsToValidator<V, Fields>;
export function addFieldsToValidator<
  V extends VObject<any, any, any> | VUnion<any, any[], any>,
  Fields extends PropertyValidators,
>(validator: V, fields: Fields): AddFieldsToValidator<V, Fields>;
export function addFieldsToValidator<
  V extends
    | PropertyValidators
    | VObject<any, any, any>
    | VUnion<any, any[], any>,
  Fields extends PropertyValidators,
>(validatorOrFields: V, fields: Fields) {
  // If the caller passed a bare PropertyValidators map, wrap it in v.object().
  const validator: GenericValidator =
    "kind" in validatorOrFields
      ? (validatorOrFields as GenericValidator)
      : v.object(validatorOrFields as PropertyValidators);
  if (Object.keys(fields).length === 0) {
    return validator;
  }
  switch (validator.kind) {
    case "object":
      return v.object(intersectValidators(validator.fields, fields));
    case "union":
      return v.union(
        ...validator.members.map((m: GenericValidator) =>
          addFieldsToValidator(m as VObject<any, any, any>, fields),
        ),
      );
    default:
      throw new Error(
        "Cannot add arguments to a validator that is not an object or union.",
      );
  }
}
