/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accents from "../accents.js";
import type * as access from "../access.js";
import type * as auth from "../auth.js";
import type * as clock from "../clock.js";
import type * as crons from "../crons.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as playback from "../playback.js";
import type * as presence from "../presence.js";
import type * as seed from "../seed.js";
import type * as setlists from "../setlists.js";
import type * as songs from "../songs.js";
import type * as sound from "../sound.js";
import type * as users from "../users.js";
import type * as vocabulary from "../vocabulary.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accents: typeof accents;
  access: typeof access;
  auth: typeof auth;
  clock: typeof clock;
  crons: typeof crons;
  groups: typeof groups;
  http: typeof http;
  playback: typeof playback;
  presence: typeof presence;
  seed: typeof seed;
  setlists: typeof setlists;
  songs: typeof songs;
  sound: typeof sound;
  users: typeof users;
  vocabulary: typeof vocabulary;
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
