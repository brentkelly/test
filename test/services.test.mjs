// The services index, checked as text. It is a list of links to pages that the
// sibling cards still have to add, so this asserts the hrefs it must point at
// rather than that they resolve — see the note on the link suite below.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPage, assertDocumentShell, countSentences } from "../test-helpers/page.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "styles.css"), "utf8");

const page = loadPage("services.html");
const { markup, tags, textOf, mainOf } = page;

/** The three service pages, in the order the brief fixed them. */
const EXPECTED = [
  { href: "clock-repairs.html", name: "Clock repairs" },
  { href: "watch-repairs.html", name: "Watch repairs" },
  { href: "skateboard-repairs.html", name: "Skateboard repairs" },
];

const listMatch = markup.match(
  /<ul\b[^>]*class="[^"]*\bservice-list\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/i,
);
const list = listMatch?.[1] ?? "";
const items = list.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) ?? [];
const anchors = list.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
const attr = (tag, name) =>
  tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;
const textIn = (fragment) =>
  fragment.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

describe("services.html document shell", () => {
  test("matches the shell every page in the site shares", () => {
    assertDocumentShell(page, { title: "Services" });
  });

  test("has exactly one <h1>, reading 'Services'", () => {
    assert.equal(tags("h1").length, 1, "expected exactly one <h1>");
    assert.equal(textOf("h1"), "Services");
  });

  test("wraps its content in a single <main> landmark", () => {
    assert.equal(tags("main").length, 1, "expected exactly one <main>");
    assert.ok(mainOf().trim().length > 0, "the <main> landmark is empty");
  });

  test("carries no <footer> — the social footer is About-specific", () => {
    assert.equal(tags("footer").length, 0, "expected no <footer>");
  });

  test("introduces the list with a short line of copy", () => {
    const intro = textOf("p");
    assert.ok(intro, "expected an introductory paragraph");
    assert.ok(intro.length > 0, "the introductory paragraph is empty");
    assert.ok(
      countSentences(intro) <= 2,
      `the intro runs to ${countSentences(intro)} sentences; the list is the page`,
    );
    assert.doesNotMatch(intro, /lorem ipsum/i, "the intro is still lorem ipsum");
  });

  test("keeps the heading and the intro ahead of the list", () => {
    const listStart = markup.search(/<ul\b/i);
    assert.ok(listStart !== -1, "expected a list");
    assert.ok(
      markup.search(/<h1\b/i) < listStart,
      "expected the <h1> to precede the list",
    );
    assert.ok(
      markup.search(/<p\b/i) < listStart,
      "expected the intro <p> to precede the list",
    );
  });
});

describe("the services list", () => {
  test("is exactly one <ul class=\"service-list\">", () => {
    assert.equal(tags("ul").length, 1, "expected exactly one <ul>");
    assert.ok(listMatch, 'expected a closed <ul class="service-list">');
  });

  test("holds exactly three items, one link each", () => {
    assert.equal(items.length, 3, "expected exactly three <li> in the list");
    assert.equal(tags("li").length, 3, "no <li> may sit outside the list");
    for (const [index, item] of items.entries()) {
      assert.equal(
        (item.match(/<a\b[^>]*>/gi) ?? []).length,
        1,
        `item ${index} does not hold exactly one link`,
      );
    }
  });

  // These three pages land on their own cards, so the hrefs 404 until they
  // merge. That is the point of pinning them here: each sibling page has to
  // ship at exactly the filename this index already points at.
  test("links the three service pages, in order", () => {
    assert.deepEqual(
      anchors.map((a) => attr(a, "href")),
      EXPECTED.map((e) => e.href),
      "the list must link the three service pages in the order the brief fixed",
    );
  });

  test("gives every link non-empty text", () => {
    assert.equal(
      anchors.length,
      EXPECTED.length,
      "expected one link per service",
    );
    for (const [index, anchor] of anchors.entries()) {
      const label = textIn(anchor);
      assert.ok(label.length > 0, `link ${index} has no text`);
      assert.equal(label, EXPECTED[index].name, `link ${index} is mislabelled`);
    }
  });

  test("keeps the links relative, so the page works from file://", () => {
    for (const anchor of anchors) {
      const href = attr(anchor, "href");
      assert.doesNotMatch(href, /^(https?:)?\/\//, `${href} is remote`);
      assert.doesNotMatch(href, /^\//, `${href} is root-relative`);
    }
  });
});

describe("services.html keeps the single-stylesheet contract", () => {
  test("adds no inline <style> element", () => {
    assert.equal(tags("style").length, 0, "expected no inline <style>");
  });

  test("links exactly one stylesheet", () => {
    const links = [...markup.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)];
    assert.equal(links.length, 1, "expected exactly one stylesheet link");
  });

  test("references no remote assets, so the page stays self-contained", () => {
    assert.doesNotMatch(markup, /<img\b/i);
    assert.doesNotMatch(markup, /\bsrc="/i);
  });
});

describe("styles.css carries the services rules", () => {
  test("styles the list as an unstyled, spaced-out set of links", () => {
    const rule = css.match(/\.service-list\s*\{([^}]*)\}/);
    assert.ok(rule, "expected a .service-list rule");
    assert.match(rule[1], /list-style:\s*none/);
    assert.match(rule[1], /padding:\s*0/);
    // The gap between items, wherever the block chooses to hang it.
    assert.match(css, /\.service-list\b[^{]*\{[^}]*margin[^}]*\}/);
  });

  test("ships the back-link the service pages will reuse", () => {
    assert.match(css, /\.back-link\b/);
    assert.match(css, /^nav\s*\{/m);
  });

  test("gives the back-link a visible focus outline", () => {
    const focus = css.match(/\.back-link:focus-visible\s*\{([^}]*)\}/);
    assert.ok(focus, "expected a .back-link:focus-visible rule");
    assert.match(focus[1], /outline:\s*2px solid/);
    assert.match(focus[1], /outline-offset/);
  });

  test("stays page-agnostic, as the About tests require", () => {
    assert.doesNotMatch(css, /\.about[\w-]*/i);
    assert.doesNotMatch(css, /#services\b/i);
  });
});
