import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Adjust to the app: source root and the tsconfig used to resolve imports.
const sourceRoot = "apps/mobile/src/";
const featureRoot = `${sourceRoot}features/`;
const uiRoot = `${sourceRoot}ui/`;

/** Check syntax and direct dependency boundaries; component ownership needs review. */
export function inspectMobileSource(filename, source, resolveImport) {
	const file = filename.replaceAll("\\", "/");
	const feature = file.startsWith(featureRoot);
	const ui = file.startsWith(uiRoot);
	if (!feature && !ui) return [];
	const issues = [];
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	const report = (node, rule, message) => {
		const line =
			tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
		issues.push({ file, line, rule, message });
	};
	if (
		feature &&
		!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.(?:ios|android|native|web|test|spec))*\.(?:ts|tsx)$/.test(
			path.posix.basename(file),
		)
	) {
		issues.push({
			file,
			line: 1,
			rule: "feature-filename",
			message:
				"Use a kebab-case basename; retain it for platform and test suffixes.",
		});
	}
	const checkDependency = (literal) => {
		if (!ui || !literal || !ts.isStringLiteralLike(literal)) return;
		const target = resolveImport(literal.text, file)?.replaceAll("\\", "/");
		if (target?.startsWith(featureRoot)) {
			report(
				literal,
				"ui-feature-import",
				"Generic UI must not import or re-export feature code.",
			);
		}
	};
	const literalSize = (node) => {
		if (ts.isParenthesizedExpression(node)) return literalSize(node.expression);
		return (
			ts.isNumericLiteral(node) ||
			ts.isStringLiteralLike(node) ||
			(ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
		);
	};
	const visit = (node) => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
			checkDependency(node.moduleSpecifier);
		if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference)
		)
			checkDependency(node.moduleReference.expression);
		if (
			ts.isCallExpression(node) &&
			(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
				(ts.isIdentifier(node.expression) &&
					node.expression.text === "require"))
		)
			checkDependency(node.arguments[0]);
		if (feature && ts.isPropertyAssignment(node)) {
			const name = ts.isComputedPropertyName(node.name)
				? node.name.expression
				: node.name;
			if (
				(ts.isIdentifier(name) || ts.isStringLiteralLike(name)) &&
				name.text === "fontSize" &&
				literalSize(node.initializer)
			) {
				report(
					node,
					"feature-font-size",
					"Use a shared theme typography token instead of a literal fontSize.",
				);
			}
		}
		if (
			feature &&
			ts.isJsxAttribute(node) &&
			node.name.getText(tree) === "fontSize" &&
			node.initializer
		) {
			const value = ts.isJsxExpression(node.initializer)
				? node.initializer.expression
				: node.initializer;
			if (value && literalSize(value))
				report(
					node,
					"feature-font-size",
					"Use a shared theme typography token instead of a literal fontSize.",
				);
		}
		ts.forEachChild(node, visit);
	};
	visit(tree);
	return issues;
}

export function checkMobileArchitecture(root) {
	const configPath = path.join(root, "apps/mobile/tsconfig.json");
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	if (config.error)
		throw new Error(
			ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
		);
	const parsed = ts.parseJsonConfigFileContent(
		config.config,
		ts.sys,
		path.dirname(configPath),
	);
	if (parsed.errors.length)
		throw new Error(
			parsed.errors
				.map((error) =>
					ts.flattenDiagnosticMessageText(error.messageText, "\n"),
				)
				.join("\n"),
		);
	const resolveImport = (specifier, file) => {
		const resolved = ts.resolveModuleName(
			specifier,
			path.join(root, file),
			parsed.options,
			ts.sys,
		).resolvedModule;
		return resolved
			? path.relative(root, resolved.resolvedFileName)
			: undefined;
	};
	const scan = (directory) =>
		fs
			.readdirSync(path.join(root, directory), { withFileTypes: true })
			.flatMap((entry) => {
				const file = `${directory}/${entry.name}`;
				if (entry.isDirectory()) return scan(file);
				if (!/\.tsx?$/.test(file)) return [];
				return inspectMobileSource(
					file,
					fs.readFileSync(path.join(root, file), "utf8"),
					resolveImport,
				);
			});
	return [...scan(featureRoot.slice(0, -1)), ...scan(uiRoot.slice(0, -1))];
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const issues = checkMobileArchitecture(
		path.resolve(import.meta.dirname, ".."),
	);
	for (const issue of issues)
		console.error(
			`${issue.file}:${issue.line} [${issue.rule}] ${issue.message}`,
		);
	if (issues.length) process.exitCode = 1;
	else console.log("Mobile structure checks passed.");
}
