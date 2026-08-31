// Shared static-HTML assertions for the page tests.
//
// Every page in this repo is a standalone file with the same document shell, so
// the tests were duplicating the same three helpers and the same eight shell
// assertions per page. This holds them once. Like test-helpers/cdp.mjs it uses
// only Node built-ins: the site has no build step, so the tests must not
// introduce a parser dependency either.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Reads a page from the repo root and returns it with the accessors the tests
 * need. `markup` is the HTML with comments stripped, so commented-out markup
 * can never satisfy a tag count; `html` is the file verbatim, for the doctype
 * check that has to see the very first bytes.
 */
export function loadPage(filename) {
  const html = readFileSync(join(root, filename), "utf8");
  const markup = html.replace(/<!--[\s\S]*?-->/g, "");

  /** Every opening tag of `name`, e.g. tags("li").length for a count. */
  const tags = (name) =>
    markup.match(new RegExp(`<${name}(?:\\s[^>]*)?>`, "gi")) ?? [];

  /** The text of the first `name` element, tags stripped, or null. */
  const textOf = (name) => {
    const m = markup.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
    );
    return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : null;
  };

  /** The inner markup of the first <main>, or "" if the page has none. */
  const mainOf = () =>
    markup.match(/<main(?:\s[^>]*)?>([\s\S]*?)<\/main>/i)?.[1] ?? "";

  return { filename, html, markup, tags, textOf, mainOf };
}

/**
 * Asserts the document shell every page in the site shares: HTML5 doctype, a
 * declared language and charset, a responsive viewport, a usable meta
 * description, one <h1>, the shared stylesheet, and the expected <title>.
 */
export function assertDocumentShell(page, { title }) {
  const { html, markup, tags, textOf, filename } = page;

  assert.match(html.trimStart(), /^<!DOCTYPE html>/i, `${filename}: no doctype`);
  assert.match(markup, /<html\b[^>]*\blang="en"/i, `${filename}: no lang="en"`);
  assert.match(
    markup,
    /<meta\b[^>]*\bcharset="utf-8"/i,
    `${filename}: no utf-8 charset`,
  );

  const viewport = markup.match(
    /<meta\b[^>]*name="viewport"[^>]*content="([^"]*)"/i,
  );
  assert.ok(viewport, `${filename}: expected a viewport meta tag`);
  assert.match(viewport[1], /width=device-width/);
  assert.match(viewport[1], /initial-scale=1\b/);

  const description = markup.match(
    /<meta\b[^>]*name="description"[^>]*content="([^"]*)"/i,
  );
  assert.ok(description, `${filename}: expected a meta description tag`);
  const summary = description[1].trim();
  assert.ok(summary.length > 0, `${filename}: meta description is empty`);
  // Long enough to be a useful snippet, short enough not to be truncated.
  assert.ok(
    summary.length <= 160,
    `${filename}: meta description is ${summary.length} chars; search engines truncate near 160`,
  );

  assert.equal(tags("h1").length, 1, `${filename}: expected exactly one <h1>`);

  assert.match(
    markup,
    /<link\b[^>]*rel="stylesheet"[^>]*href="styles\.css"/i,
    `${filename}: does not link styles.css`,
  );

  assert.equal(textOf("title"), title, `${filename}: wrong <title>`);
}

/** How many sentences a chunk of copy reads as, tags and markup ignored. */
export function countSentences(text) {
  return (text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/[.!?]+(?:\s|$)/)
    .filter((sentence) => sentence.trim().length > 0).length;
}
