// The automatable Verify items of docs/standards/repo-layout.md.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const API_MODULE = "apps/mobile/src/convex/api.ts";
const issues = [];

// Mobile reaches convex/_generated only through the api.ts module.
const tracked = execFileSync("git", ["ls-files", "-z", "apps/mobile"], {
	encoding: "utf8",
})
	.split("\0")
	.filter((file) => /\.(?:[cm]?[jt]sx?)$/.test(file) && file !== API_MODULE);
for (const file of tracked) {
	if (/from\s+["'][^"']*convex\/_generated/.test(readFileSync(file, "utf8")))
		issues.push(`${file}: import convex/_generated through ${API_MODULE}`);
}

// packages/core stays dependency-free.
const core = JSON.parse(readFileSync("packages/core/package.json", "utf8"));
for (const field of ["dependencies", "peerDependencies"])
	if (Object.keys(core[field] ?? {}).length)
		issues.push(`packages/core/package.json: remove ${field}`);

if (issues.length) {
	for (const issue of issues) console.error(issue);
	process.exit(1);
}
console.log("Repository layout checks passed.");
