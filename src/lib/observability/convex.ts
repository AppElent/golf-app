import * as Sentry from "@sentry/react";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { reportError } from "./errors";

/**
 * Report backend failures returned to this browser at the one client every
 * `useMutation`/`useAction` goes through. Arguments and results are never
 * attached; only the function name is. Query failures surface through React
 * error handling instead (`src/client.tsx`).
 */
export function instrumentConvexClient<T extends ConvexReactClient>(
	client: T,
): T {
	const mutation = client.mutation.bind(client);
	const action = client.action.bind(client);
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
	client.action = (reference, ...args) => {
		const operation = getFunctionName(reference);
		return Sentry.startSpan(
			{ name: operation, op: "convex.action" },
			async () => {
				try {
					return await action(reference, ...args);
				} catch (error) {
					reportError(error, operation);
					throw error;
				}
			},
		);
	};
	return client;
}
