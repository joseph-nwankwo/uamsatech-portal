import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  EMAIL_TRIM_CODE_POINTS,
  emailField,
  normalizeEmail,
} from "@/lib/auth/normalize-email";

// S1 / Codex finding 1: the app normaliser, the migration's
// portal_normalize_email(), its CHECK constraint and scripts/preflight-s1.sql
// must all treat exactly the same characters as trimmable.

const ROOT = path.resolve(__dirname, "../..");
const MIGRATION = path.join(
  ROOT,
  "prisma/migrations/20261121120000_s1_normalize_emails/migration.sql"
);
const PREFLIGHT = path.join(ROOT, "scripts/preflight-s1.sql");

const hex = (cp: number) => cp.toString(16).padStart(4, "0");
const expected = [...EMAIL_TRIM_CODE_POINTS].sort((a, b) => a - b);

/** Code points JS trim() removes, found by checking every BMP code point. */
function jsTrimSet(): number[] {
  const out: number[] = [];
  for (let cp = 0; cp <= 0xffff; cp++) {
    if (String.fromCharCode(cp).trim() === "") out.push(cp);
  }
  return out;
}

/** SQL with `--` comment lines removed. */
function sqlCode(file: string): string {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

/**
 * Every E'' edge-trim regex literal in the file, each expanded to the code
 * points of its two character classes. The literal must have the exact shape
 * ^[class]+|[class]+$ with both classes identical.
 */
function sqlTrimClasses(file: string): number[][] {
  const code = sqlCode(file);
  const literal =
    /E'\^\[((?:\\\\u[0-9a-f]{4}(?:-\\\\u[0-9a-f]{4})?)+)\]\+\|\[((?:\\\\u[0-9a-f]{4}(?:-\\\\u[0-9a-f]{4})?)+)\]\+\$'/gi;
  const classes: number[][] = [];
  for (const m of code.matchAll(literal)) {
    expect(m[1], "both classes in one literal must match").toBe(m[2]);
    const cps: number[] = [];
    for (const t of m[1].matchAll(
      /\\\\u([0-9a-f]{4})(?:-\\\\u([0-9a-f]{4}))?/gi
    )) {
      const from = parseInt(t[1], 16);
      const to = t[2] ? parseInt(t[2], 16) : from;
      for (let cp = from; cp <= to; cp++) cps.push(cp);
    }
    classes.push(cps.sort((a, b) => a - b));
  }
  return classes;
}

describe("normalizeEmail", () => {
  it.each([
    ["  Alice@Example.COM  ", "spaces"],
    ["\tAlice@Example.COM\t", "tabs"],
    ["\nAlice@Example.COM\n", "newlines"],
    ["\r\nAlice@Example.COM\r\n", "CRLF"],
    [" \t\n Alice@Example.COM \n\t ", "mixed"],
    [" Alice@Example.COM ", "no-break space"],
    ["﻿Alice@Example.COM", "byte-order mark"],
    [" Alice@Example.COM　", "line separator / ideographic space"],
  ])("strips %j (%s) and lowercases", (input) => {
    expect(normalizeEmail(input)).toBe("alice@example.com");
  });

  it("leaves inner characters alone", () => {
    expect(normalizeEmail(" a\tb@x.com ")).toBe("a\tb@x.com");
  });

  it("does not strip characters outside the list", () => {
    expect(normalizeEmail("​A@x.com")).toBe("​a@x.com"); // zero-width space: not JS whitespace
    expect(normalizeEmail("_a@x.com_")).toBe("_a@x.com_");
  });

  it("is idempotent", () => {
    const once = normalizeEmail("\t A@B.com \n");
    expect(normalizeEmail(once)).toBe(once);
  });

  it("emailField accepts whitespace-wrapped input and stores the normal form", () => {
    expect(emailField().parse("\n\tBob@Example.com \r\n")).toBe(
      "bob@example.com"
    );
  });
});

describe("one trim set everywhere (app, migration, preflight)", () => {
  it("EMAIL_TRIM_CODE_POINTS is exactly what JS trim() strips", () => {
    expect(expected.map(hex)).toEqual(jsTrimSet().map(hex));
  });

  it("normalizeEmail strips every listed code point and nothing else at the edges", () => {
    for (let cp = 0; cp <= 0xffff; cp++) {
      const ch = String.fromCharCode(cp);
      const stripped = normalizeEmail(`${ch}a@x.com${ch}`) === "a@x.com";
      expect(stripped, `U+${hex(cp)}`).toBe(ch.trim() === "");
    }
  });

  it("migration.sql: the function uses the same set, and nothing uses btrim()", () => {
    const classes = sqlTrimClasses(MIGRATION);
    expect(classes).toHaveLength(1); // defined once, in portal_normalize_email
    expect(classes[0].map(hex)).toEqual(expected.map(hex));

    const code = sqlCode(MIGRATION);
    expect(code).not.toMatch(/btrim\s*\(/i);
    // Guards, UPDATEs and the CHECK all go through the function.
    expect(code).toMatch(
      /CHECK \("email" = "portal_normalize_email"\("email"\)\)/
    );
    // CREATE 1 + COMMENT 1 + 2 guards + 2 UPDATEs x2 + CHECK 1.
    expect(code.match(/"portal_normalize_email"\(/g)?.length).toBe(9);
    expect(code).toMatch(/COMMENT ON FUNCTION "portal_normalize_email"/);
  });

  it("preflight-s1.sql: every inlined expression uses the same set, no btrim()", () => {
    const classes = sqlTrimClasses(PREFLIGHT);
    expect(classes).toHaveLength(4);
    for (const c of classes) expect(c.map(hex)).toEqual(expected.map(hex));
    expect(sqlCode(PREFLIGHT)).not.toMatch(/btrim\s*\(/i);
  });
});
