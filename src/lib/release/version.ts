/**
 * What `/version` answers (releases standard): which build of Fairway runs
 * on this deployment. The values are inlined by `vite.config.ts` at build
 * time; the deploy's smoke check compares `commit` with the commit it shipped.
 */
export type VersionInfo = {
	app: "fairway";
	/** SemVer from `apps/mobile/app.json`. */
	version: string;
	/** Full git commit the bundle was built from. */
	commit: string;
	/** The deployment: staging, production, preview, ci, or unknown. */
	environment: string;
	/** When the bundle was built, which is when the deploy ran. */
	deployedAt: string | null;
};

export function versionInfo(environment: string): VersionInfo {
	return {
		app: "fairway",
		version: import.meta.env.VITE_APP_VERSION || "unknown",
		commit: import.meta.env.VITE_GIT_COMMIT || "unknown",
		environment,
		deployedAt: import.meta.env.VITE_BUILT_AT || null,
	};
}

export function isVersionRequest(request: Request): boolean {
	return (
		(request.method === "GET" || request.method === "HEAD") &&
		new URL(request.url).pathname === "/version"
	);
}

export function versionResponse(environment: string): Response {
	return Response.json(versionInfo(environment), {
		headers: { "cache-control": "no-store" },
	});
}
