// `vid(tableName)` — a Valibot schema that round-trips with Convex's
// `v.id("tableName")`. Counterpart to convex-helpers' `zid()`.
//
// Wraps a `v.pipe(v.string(), v.nonEmpty(...))` with a hidden symbol the
// converter recognizes; at parse time it behaves like a non-empty string.
// At conversion time it emits `cv.id(tableName)`.
//
// Generic over the project's `DataModel` so that callers get table-name
// autocomplete (`Id<"canonicalItems">`, etc.) just like `zid` did.

import * as v from "valibot";
import type { GenericDataModel, TableNamesInDataModel } from "convex/server";
import type { GenericId } from "convex/values";
import { VID_TABLE } from "./valibot-to-convex.js";

/** Branded Valibot schema that parses a string and converts to `cv.id(table)`.
 *  Input is bare `string` (what callers pass); output is `Id<TableName>` (what
 *  handlers receive after parse). Matches `zid` semantics so call sites that
 *  consume vid output via `ctx.db.get(...)` etc. type-check without manual casts. */
export type Vid<TableName extends string> = v.BaseSchema<
  string,
  GenericId<TableName>,
  v.BaseIssue<unknown>
> & { readonly [VID_TABLE]: TableName };

export const vid = <
  DataModel extends GenericDataModel,
  TableName extends
    TableNamesInDataModel<DataModel> = TableNamesInDataModel<DataModel>,
>(
  tableName: TableName,
): Vid<TableName> => {
  const base = v.pipe(
    v.string(),
    v.nonEmpty(`expected non-empty id for table "${tableName}"`),
  );
  // Attach the hidden marker non-enumerably so it survives identity checks
  // but doesn't show up in normal object iteration / serialization.
  Object.defineProperty(base, VID_TABLE, {
    value: tableName,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return base as unknown as Vid<TableName>;
};
