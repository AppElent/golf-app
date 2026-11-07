/**
 * Re-exports the generated Convex API across the monorepo boundary.
 *
 * `convex/_generated` is generated at the repo root by `npx convex dev` /
 * `deploy` and crosses here by deep relative path, not by workspace package.
 * There is no separate mobile backend or schema: this app is a second client of
 * the same Convex deployment and Clerk tenant the web app talks to.
 */
export { api } from "../../../../convex/_generated/api";
export type { Doc, Id } from "../../../../convex/_generated/dataModel";
