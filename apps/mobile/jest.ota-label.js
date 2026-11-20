/**
 * Jest stand-in for `src/updates/ota-label.mjs`: evaluates the real file with
 * its `export` keywords dropped, so tests run developer-home's code, not a copy.
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const source = readFileSync(
	join(__dirname, "src/updates/ota-label.mjs"),
	"utf8",
).replace(/^export /gm, "");

module.exports = new Function(
	`${source}\nreturn { OTA_LABEL_MONTHS, formatOtaLabel };`,
)();
