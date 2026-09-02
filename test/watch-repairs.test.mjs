import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  loadPage,
  assertDocumentShell,
  countSentences,
} from "../test-helpers/page.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = loadPage(root, "watch-repairs.html");

describe("watch-repairs.html document shell", () => {
  const shell = assertDocumentShell(page, "watch-repairs.html");

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

  test("has a Watch Repairs title", () => {
    assert.equal(page.textOf("title"), "Watch Repairs");
  });

  test("carries a meta description for the search snippet", () => {
    assert.ok(shell.hasDescription(), "missing or invalid meta description");
  });
});

describe("watch-repairs.html content", () => {
  test("wraps its content in a single <main> landmark", () => {
    assert.equal(page.tags("main").length, 1);
  });

  test("has exactly one <h1>, reading 'Watch Repairs'", () => {
    assert.equal(page.tags("h1").length, 1);
    assert.equal(page.textOf("h1"), "Watch Repairs");
  });

  test("has no <footer>", () => {
    assert.equal(page.tags("footer").length, 0);
  });

  test("uses at most three sentences in the main content", () => {
    assert.ok(
      countSentences(page.mainOf()) <= 3,
      "expected at most three sentences in <main>",
    );
  });

  test("has exactly one <nav> with a single link back to all services", () => {
    assert.equal(page.tags("nav").length, 1);
    const nav = page.markup.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i)[1];
    const navLinks = [...nav.matchAll(/<a\s+href="([^"]+)"[^>]*>/gi)];
    assert.equal(navLinks.length, 1);
    assert.equal(navLinks[0][1], "services.html");
  });

  test("<main> contains an inline link to clock repairs with meaningful text, outside the <nav>", () => {
    const main = page.mainOf();
    const navMatch = main.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i);
    const mainWithoutNav = navMatch
      ? main.slice(0, navMatch.index) + main.slice(navMatch.index + navMatch[0].length)
      : main;

    const clockLink = mainWithoutNav.match(
      /<a\s+href="clock-repairs\.html"[^>]*>([\s\S]*?)<\/a>/i,
    );
    assert.ok(clockLink, "expected an <a href=\"clock-repairs.html\"> inside <main>, outside <nav>");

    const linkText = clockLink[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    assert.ok(linkText.length > 0, "clock repairs link has no text");
  });
});

describe("stylesheet wiring", () => {
  test("links styles.css", () => {
    const shell = assertDocumentShell(page, "watch-repairs.html");
    assert.ok(shell.linksStylesheet(), "missing styles.css link");
  });

  test("styles.css file exists", () => {
    const shell = assertDocumentShell(page, "watch-repairs.html");
    assert.ok(shell.stylesheetExists(), "styles.css does not exist");
  });
});

describe("linked files", () => {
  test("clock-repairs.html exists", () => {
    assert.ok(page.fileExists("clock-repairs.html"));
  });

  test("services.html exists", () => {
    assert.ok(page.fileExists("services.html"));
  });
});
