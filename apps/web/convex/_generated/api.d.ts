/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analyses from "../analyses.js";
import type * as auth from "../auth.js";
import type * as billing from "../billing.js";
import type * as codeGraph from "../codeGraph.js";
import type * as devices from "../devices.js";
import type * as github_analysis from "../github/analysis.js";
import type * as github_handlers from "../github/handlers.js";
import type * as github_index from "../github/index.js";
import type * as github_mutations from "../github/mutations.js";
import type * as guardrails from "../guardrails.js";
import type * as interventions from "../interventions.js";
import type * as memories from "../memories.js";
import type * as scanWorker from "../scanWorker.js";
import type * as scans from "../scans.js";
import type * as scm from "../scm.js";
import type * as teamTokens from "../teamTokens.js";
import type * as temporal from "../temporal.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analyses: typeof analyses;
  auth: typeof auth;
  billing: typeof billing;
  codeGraph: typeof codeGraph;
  devices: typeof devices;
  "github/analysis": typeof github_analysis;
  "github/handlers": typeof github_handlers;
  "github/index": typeof github_index;
  "github/mutations": typeof github_mutations;
  guardrails: typeof guardrails;
  interventions: typeof interventions;
  memories: typeof memories;
  scanWorker: typeof scanWorker;
  scans: typeof scans;
  scm: typeof scm;
  teamTokens: typeof teamTokens;
  temporal: typeof temporal;
  webhooks: typeof webhooks;
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
