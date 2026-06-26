// `withSystemFields(tableName, fields)` — adds `_id: vid(tableName)` and
// `_creationTime: v.number()` to a Valibot field map. Counterpart to
// convex-helpers' `withSystemFields` for Zod, and to convex-zod's
// `withSystemFields` in this repo.
//
// Convex auto-populates these on every document; including them in the
// schemas package lets the frontend's read-side validation accept them.

import * as v from "valibot";
import { vid } from "./vid";

export function withSystemFields<
  Table extends string,
  T extends Record<string, v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>,
>(tableName: Table, fields: T) {
  return { ...fields, _id: vid(tableName), _creationTime: v.number() };
}
