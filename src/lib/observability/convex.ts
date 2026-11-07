import * as Sentry from "@sentry/react";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { reportError } from "./errors";

/**
 * Report backend failures returned to this browser at the one client every
 * `useMutation` goes through. Arguments and results are never attached; only
 * the function name is. Query failures surface through React error handling
 * instead (`src/client.tsx`).
 */
export function instrumentConvexClient(
	client: ConvexReactClient,
): ConvexReactClient {
	const mutation = client.mutation.bind(client);
	client.mutation = (reference, ...args) => {
		const operation = getFunctionName(reference);
		return Sentry.startSpan(
			{ name: operation, op: "convex.mutation" },
			async () => {
				try {
					return await mutation(reference, ...args);
				} catch (error) {
					reportError(error, operation);
					throw error;
				}
			},
		);
	};
	return client;
}
