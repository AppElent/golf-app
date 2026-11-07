/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as catalog_index from "../catalog/index.js";
import type * as clubs from "../clubs.js";
import type * as courseCatalog from "../courseCatalog.js";
import type * as courses from "../courses.js";
import type * as lib from "../lib.js";
import type * as rounds from "../rounds.js";
import type * as seed from "../seed.js";
import type * as seedPreview from "../seedPreview.js";
import type * as settings from "../settings.js";
import type * as shots from "../shots.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  "catalog/index": typeof catalog_index;
  clubs: typeof clubs;
  courseCatalog: typeof courseCatalog;
  courses: typeof courses;
  lib: typeof lib;
  rounds: typeof rounds;
  seed: typeof seed;
  seedPreview: typeof seedPreview;
  settings: typeof settings;
  shots: typeof shots;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
