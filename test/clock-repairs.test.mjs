import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPage, assertDocumentShell } from "../test-helpers/page.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = loadPage(root, "clock-repairs.html");

describe("clock-repairs.html document shell", () => {
  const shell = assertDocumentShell(page, "clock-repairs.html");

  test("declares the HTML5 doctype", () => {
    assert.ok(shell.hasDoctype(), "missing HTML5 doctype");
  });

  test("sets the document language", () => {
    assert.ok(shell.hasLanguage(), "missing or incorrect lang attribute");
  });

  test("declares a UTF-8 charset", () => {
    assert.ok(shell.hasCharset(), "missing UTF-8 charset");
  });

  test("declares a responsive viewport", () => {
    assert.ok(shell.hasViewport(), "missing or incomplete viewport meta tag");
  });

  test("has a Clock Repairs title", () => {
    assert.equal(page.textOf("title"), "Clock Repairs");
  });

  test("carries a meta description for the search snippet", () => {
    assert.ok(shell.hasDescription(), "missing or invalid meta description");
  });
});

describe("clock-repairs.html content", () => {
  test("wraps its content in a single <main> landmark", () => {
    assert.equal(page.tags("main").length, 1);
  });

  test("has exactly one <h1>, reading 'Clock Repairs'", () => {
    assert.equal(page.tags("h1").length, 1);
    assert.equal(page.textOf("h1"), "Clock Repairs");
  });

  test("has exactly one paragraph with service description", () => {
    assert.equal(page.tags("p").length, 1);
    const paragraph = page.textOf("p");
    assert.ok(paragraph, "expected a paragraph element");
    assert.ok(
      paragraph.split(/\s+/).length >= 30,
      `paragraph is only ${paragraph.split(/\s+/).length} words`,
    );
  });

  test("includes link back to all services", () => {
    const navLinks = [...page.markup.matchAll(/<a\s+href="([^"]+)"/gi)];
    const hrefs = navLinks.map((m) => m[1]);
    assert.ok(hrefs.includes("services.html"), "missing link to services.html");
  });

  test("the heading precedes the paragraph", () => {
    assert.ok(page.markup.search(/<h1\b/i) < page.markup.search(/<p\b/i));
  });
});

describe("stylesheet wiring", () => {
  test("links styles.css", () => {
    const shell = assertDocumentShell(page, "clock-repairs.html");
    assert.ok(shell.linksStylesheet(), "missing styles.css link");
  });

  test("styles.css file exists", () => {
    const shell = assertDocumentShell(page, "clock-repairs.html");
    assert.ok(shell.stylesheetExists(), "styles.css does not exist");
  });
});
