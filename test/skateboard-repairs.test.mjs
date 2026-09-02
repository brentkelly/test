import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPage, assertDocumentShell, mainOf, countSentences } from "../test-helpers/page.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = loadPage(root, "skateboard-repairs.html");

describe("skateboard-repairs.html document shell", () => {
  const shell = assertDocumentShell(page, "skateboard-repairs.html");

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

  test("has a Skateboard Repairs title", () => {
    assert.equal(page.textOf("title"), "Skateboard Repairs");
  });

  test("carries a meta description for the search snippet", () => {
    assert.ok(shell.hasDescription(), "missing or invalid meta description");
  });
});

describe("skateboard-repairs.html content", () => {
  test("wraps its content in a single <main> landmark", () => {
    assert.equal(page.tags("main").length, 1, "expected exactly one <main>");
  });

  test("has exactly one <h1>, reading 'Skateboard Repairs'", () => {
    assert.equal(page.tags("h1").length, 1, "expected exactly one <h1>");
    assert.equal(page.textOf("h1"), "Skateboard Repairs");
  });

  test("has no <footer> element", () => {
    assert.equal(page.tags("footer").length, 0, "expected no <footer>");
  });

  test("the main content has at most three sentences", () => {
    const main = mainOf(page);
    assert.match(main, /^Skateboard Repairs We rebuild and repair skateboards,/);
    const sentences = countSentences(main);
    assert.ok(
      sentences <= 3,
      `expected at most 3 sentences, found ${sentences}: "${main}"`,
    );
  });

  test("has exactly one <nav> with a single link to services.html", () => {
    const navTags = page.tags("nav");
    assert.equal(navTags.length, 1, "expected exactly one <nav>");

    const navMatch = page.markup.match(/<nav(?:\s[^>]*)?>[\s\S]*?<\/nav>/i);
    assert.ok(navMatch, "expected <nav> content");

    const links = [...page.markup.matchAll(/<a\s+href="([^"]+)"/gi)];
    const servicesLinks = links.filter(m => m[1] === "services.html");
    assert.equal(servicesLinks.length, 1, "expected exactly one link to services.html");
  });

  test("the nav link includes an arrow with aria-hidden", () => {
    const navMatch = page.markup.match(/<nav(?:\s[^>]*)?>[\s\S]*?<\/nav>/i);
    assert.ok(navMatch, "expected <nav> content");

    const navContent = navMatch[0];
    const linkMatch = navContent.match(/<a\s+href="services\.html"[^>]*>[\s\S]*?<\/a>/i);
    assert.ok(linkMatch, "expected link to services.html in nav");

    const linkContent = linkMatch[0];
    assert.ok(/←/.test(linkContent), "expected arrow (←) in link");
    assert.ok(/aria-hidden/.test(linkContent), "expected aria-hidden attribute on arrow");
  });

  test("the heading precedes the paragraph", () => {
    assert.ok(page.markup.search(/<h1\b/i) < page.markup.search(/<p\b/i));
  });
});

describe("stylesheet wiring", () => {
  test("links styles.css", () => {
    const shell = assertDocumentShell(page, "skateboard-repairs.html");
    assert.ok(shell.linksStylesheet(), "missing styles.css link");
  });

  test("styles.css file exists", () => {
    const shell = assertDocumentShell(page, "skateboard-repairs.html");
    assert.ok(shell.stylesheetExists(), "styles.css does not exist");
  });
});
