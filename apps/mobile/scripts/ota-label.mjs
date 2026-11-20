// Prints the OTA label for an update about to be published, for the EAS update
// message (developer-home standards/releases.md, "OTA label"):
//
//   node scripts/ota-label.mjs <commit sha>     // 1.0.0 · 20 nov · a1b2c3d
//
// The version is `expo.version` of the checked-out commit, the day is today.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatOtaLabel } from "../src/updates/ota-label.mjs";

const appJson = join(dirname(fileURLToPath(import.meta.url)), "..", "app.json");
const { version } = JSON.parse(readFileSync(appJson, "utf8")).expo;
console.log(formatOtaLabel(version, new Date(), process.argv[2]));
