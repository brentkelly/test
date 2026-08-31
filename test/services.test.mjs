import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPage, assertDocumentShell } from "../test-helpers/page.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = loadPage(root, "services.html");

describe("services.html document shell", () => {
  const shell = assertDocumentShell(page, "services.html");

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

  test("has a Services title", () => {
    assert.equal(page.textOf("title"), "Services");
  });

  test("carries a meta description for the search snippet", () => {
    assert.ok(shell.hasDescription(), "missing or invalid meta description");
  });
});

describe("services.html content", () => {
  test("wraps its content in a single <main> landmark", () => {
    assert.equal(page.tags("main").length, 1);
  });

  test("has exactly one <h1>, reading 'Services'", () => {
    assert.equal(page.tags("h1").length, 1);
    assert.equal(page.textOf("h1"), "Services");
  });

  test("lists three services as links", () => {
    assert.equal(page.tags("li").length, 3);
  });

  test("each service has a link to its page", () => {
    const links = [...page.markup.matchAll(/<a\s+href="([^"]+)"/gi)];
    assert.equal(links.length, 3, "expected 3 service links");
    const hrefs = links.map((m) => m[1]);
    assert.ok(hrefs.includes("clock-repairs.html"));
    assert.ok(hrefs.includes("watch-repairs.html"));
    assert.ok(hrefs.includes("skateboard-repairs.html"));
  });

  test("service names are correct", () => {
    const text = page.markup;
    assert.ok(text.includes("Clock Repairs"));
    assert.ok(text.includes("Watch Repairs"));
    assert.ok(text.includes("Skateboard Repairs"));
  });
});

describe("stylesheet wiring", () => {
  test("links styles.css", () => {
    const shell = assertDocumentShell(page, "services.html");
    assert.ok(shell.linksStylesheet(), "missing styles.css link");
  });

  test("styles.css file exists", () => {
    const shell = assertDocumentShell(page, "services.html");
    assert.ok(shell.stylesheetExists(), "styles.css does not exist");
  });
});
