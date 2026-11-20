import { createFileRoute } from "@tanstack/react-router";
import { APP_STORE_LIVE } from "../components/app-links";
import { OpenTheApp } from "../components/open-the-app";

export const Route = createFileRoute("/")({
	component: () => <OpenTheApp storeLive={APP_STORE_LIVE} />,
});
