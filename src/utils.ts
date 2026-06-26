// Tiny structural helpers used across the package.
// Copied from convex-helpers/index.ts so we don't take a runtime dependency on it.

export function pick<T extends Record<string, any>, Keys extends (keyof T)[]>(
  obj: T,
  keys: Keys,
) {
  return Object.fromEntries(
    Object.entries(obj).filter(([k]) => keys.includes(k as Keys[number])),
  ) as {
    [K in Keys[number]]: T[K];
  };
}

export type Expand<ObjectType extends Record<any, any>> =
  ObjectType extends Record<any, any>
    ? {
        [Key in keyof ObjectType]: ObjectType[Key];
      }
    : never;

export type NotUndefined<T> = Exclude<T, undefined>;

export type Overwrite<T, U> = Omit<T, keyof U> & U;
