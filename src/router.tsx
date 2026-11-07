import * as Sentry from "@sentry/react";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
	});

	if (!router.isServer) {
		// Route templates (`/courses/$courseId/edit`), never resolved ids.
		const tagRoute = () =>
			Sentry.setTag("route", router.state.matches.at(-1)?.routeId ?? "/");
		router.subscribe("onResolved", tagRoute);
		tagRoute();
		Sentry.addIntegration(
			Sentry.tanstackRouterBrowserTracingIntegration(router),
		);
	}

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
