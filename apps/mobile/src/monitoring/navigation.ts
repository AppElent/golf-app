import * as Sentry from "@sentry/react-native";
import { useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { sentryEnabled } from "./init";
import { routeName } from "./options";

/** One `navigation` breadcrumb per screen change: route patterns, no ids. */
export function useNavigationBreadcrumbs() {
	const segments = useSegments();
	const to = routeName(segments);
	const from = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (sentryEnabled && from.current !== undefined && from.current !== to) {
			Sentry.addBreadcrumb({
				category: "navigation",
				type: "navigation",
				data: { from: from.current, to },
			});
		}
		from.current = to;
	}, [to]);
}
