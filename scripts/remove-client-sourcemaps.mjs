/**
 * Deletes the browser's source maps after `vite build`. They are generated
 * hidden (no `sourceMappingURL`) and uploaded to Sentry by the Vite plugin when
 * a deploy supplies SENTRY_AUTH_TOKEN; the deployed static assets must not
 * serve them. Worker maps in dist/server are not served and stay.
 */
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

async function removeMaps(directory) {
	let removed = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) removed += await removeMaps(path);
		else if (entry.name.endsWith(".map")) {
			await rm(path);
			removed += 1;
		}
	}
	return removed;
}

const removed = await removeMaps("dist/client");
console.log(`Removed ${removed} public source map(s) from dist/client.`);
