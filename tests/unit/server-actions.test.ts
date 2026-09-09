import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Guards the one rule about `"use server"` files that a type checker cannot see.
 *
 * Next wraps every export of a `"use server"` module in a runtime check
 * (`ensureServerEntryExports`) and throws `A "use server" file can only export
 * async functions, found object.` — error E352 — when an export turns out not
 * to be a function. Nothing in `tsc`, ESLint or a development render catches
 * it: the admin action files each exported an `IDLE` state object for their
 * client components to use as the initial `useActionState` value, every page
 * rendered fine locally, and the dashboard broke only once deployed.
 *
 * So the check is static. Every file in the app whose directive prologue says
 * `"use server"` is parsed, and each export is required to be either an async
 * function or a type — the two things Next allows. Shared values belong in a
 * plain module (see `app/admin/(dashboard)/action-state.ts`), which both
 * server actions and client components can import.
 */

const ROOT = path.resolve(import.meta.dirname, "../..");
const SEARCH_ROOTS = ["app", "components", "lib"];
const SKIP_DIRECTORIES = new Set(["node_modules", ".next", "dist", "build"]);

function sourceFiles(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRECTORIES.has(entry.name)) continue;
    const full = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  }

  return found;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/**
 * True when the file opens with a `"use server"` directive.
 *
 * Only the directive prologue counts — the leading run of bare string
 * expression statements. A file that merely mentions `"use server"` in a
 * comment or in the middle of the module (as this test's own fixtures and the
 * shared state module do) is not a server module, and `grep` cannot tell the
 * difference.
 */
function isServerModule(source: ts.SourceFile): boolean {
  for (const statement of source.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteralLike(statement.expression)
    ) {
      return false;
    }
    if (statement.expression.text === "use server") return true;
  }

  return false;
}

function isExported(node: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword ||
        modifier.kind === ts.SyntaxKind.DefaultKeyword,
    )
  );
}

function isAsync(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
    )
  );
}

/** Every export of a server module, described well enough to fail usefully. */
function offendingExports(source: ts.SourceFile): string[] {
  const problems: string[] = [];

  for (const statement of source.statements) {
    // `export type X = …`, `export interface X {}`, `export enum` — erased or
    // not, only the first two survive as nothing at runtime.
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      continue;
    }

    if (ts.isFunctionDeclaration(statement) && isExported(statement)) {
      if (!isAsync(statement)) {
        problems.push(`function ${statement.name?.text ?? "default"} is not async`);
      }
      continue;
    }

    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const name = declaration.name.getText(source);
        const initialiser = declaration.initializer;

        if (
          initialiser &&
          (ts.isArrowFunction(initialiser) || ts.isFunctionExpression(initialiser)) &&
          isAsync(initialiser)
        ) {
          continue;
        }

        problems.push(
          initialiser && (ts.isArrowFunction(initialiser) || ts.isFunctionExpression(initialiser))
            ? `const ${name} is a function but is not async`
            : `const ${name} is a value, not an async function`,
        );
      }
      continue;
    }

    if (ts.isClassDeclaration(statement) && isExported(statement)) {
      problems.push(`class ${statement.name?.text ?? "default"} is not an async function`);
      continue;
    }

    if (ts.isEnumDeclaration(statement) && isExported(statement)) {
      problems.push(`enum ${statement.name.text} is a value, not an async function`);
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      problems.push("`export default <expression>` cannot be checked statically");
      continue;
    }

    // `export { a, b }` / `export * from …`: the exported values are declared
    // elsewhere, so nothing here proves they are async functions.
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      const clause = statement.exportClause;

      if (clause && ts.isNamedExports(clause)) {
        for (const specifier of clause.elements) {
          if (specifier.isTypeOnly) continue;
          problems.push(`re-exported \`${specifier.name.text}\` is not a local async function`);
        }
      } else {
        problems.push("`export *` cannot be checked statically");
      }
    }
  }

  return problems;
}

const serverModules = SEARCH_ROOTS.flatMap((root) => sourceFiles(path.join(ROOT, root)))
  .filter((file) => isServerModule(parse(file)))
  .map((file) => path.relative(ROOT, file))
  .sort();

describe('"use server" modules export only async functions', () => {
  it("finds the server action files at all", () => {
    // A refactor that renames or moves them must not silently empty this suite.
    expect(serverModules.length).toBeGreaterThan(0);
    expect(serverModules).toContain("app/payment/actions.ts");
  });

  it.each(serverModules)("%s", (relative) => {
    const problems = offendingExports(parse(path.join(ROOT, relative)));

    expect(
      problems,
      `${relative} exports something Next will reject at runtime with E352:\n` +
        problems.map((problem) => `  - ${problem}`).join("\n") +
        "\nMove shared values into a module without the \"use server\" directive.",
    ).toEqual([]);
  });

  it("does not mistake the shared state module for a server module", () => {
    // It documents the rule in a comment, which is exactly the case a `grep`
    // for the directive gets wrong.
    expect(serverModules).not.toContain("app/admin/(dashboard)/action-state.ts");
  });
});
