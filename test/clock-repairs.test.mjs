// The clock repairs service page, checked as text. It is the first of the three
// pages services.html links to, so alongside the shell this pins the back-link
// that carries a reader out of the leaf and back to the index.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  loadPage,
  assertDocumentShell,
  countSentences,
} from "../test-helpers/page.mjs";

const page = loadPage("clock-repairs.html");
const { markup, tags, textOf, mainOf } = page;

const navMatch = markup.match(/<nav(?:\s[^>]*)?>([\s\S]*?)<\/nav>/i);
const nav = navMatch?.[1] ?? "";
const anchors = nav.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
const attr = (tag, name) =>
  tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;
const textIn = (fragment) =>
  fragment.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

describe("clock-repairs.html document shell", () => {
  test("matches the shell every page in the site shares", () => {
    assertDocumentShell(page, { title: "Clock Repairs" });
  });

  test("has exactly one <h1>, reading 'Clock Repairs'", () => {
    assert.equal(tags("h1").length, 1);
    assert.equal(textOf("h1"), "Clock Repairs");
  });

  test("wraps its content in a single <main> landmark", () => {
    assert.equal(tags("main").length, 1);
    assert.ok(mainOf().trim().length > 0, "the <main> landmark is empty");
  });

  test("carries no <footer> — the social footer is About-specific", () => {
    assert.equal(tags("footer").length, 0);
  });

  test("meta description is drawn verbatim from the page copy", () => {
    const description = markup
      .match(/<meta\b[^>]*name="description"[^>]*content="([^"]*)"/i)[1]
      .replace(/\s+/g, " ")
      .trim();
    // The full copy runs past the 160-character description limit the shell
    // enforces, so the description truncates it at a sentence boundary.
    // Everything it does keep must still read exactly as the copy does.
    const kept = description.replace(/\.$/, "");
    assert.ok(
      textIn(mainOf()).includes(kept),
      `meta description diverges from the copy: ${kept}`,
    );
  });
});

describe("clock-repairs.html copy", () => {
  test("says its piece in no more than three sentences", () => {
    const sentences = countSentences(mainOf());
    assert.ok(sentences >= 1, "the page has no copy");
    assert.ok(
      sentences <= 3,
      `the copy runs to ${sentences} sentences; the brief caps it at three`,
    );
  });

  test("keeps the heading ahead of the copy", () => {
    assert.ok(markup.search(/<h1\b/i) < markup.search(/<p\b/i));
  });
});

describe("the back-link out to the services index", () => {
  test("sits in exactly one <nav>, ahead of <main>", () => {
    assert.equal(tags("nav").length, 1);
    assert.ok(navMatch, "expected a closed <nav>");
    assert.ok(
      markup.search(/<nav\b/i) < markup.search(/<main\b/i),
      "the nav must precede the main landmark in source order",
    );
  });

  test("is the nav's only link, and points at services.html", () => {
    assert.equal(anchors.length, 1, "the nav must hold exactly one link");
    assert.equal(attr(anchors[0], "href"), "services.html");
  });

  test("carries the shared .back-link class the services card shipped", () => {
    assert.match(attr(anchors[0], "class") ?? "", /\bback-link\b/);
  });

  test("reads as 'All services', with the arrow hidden from screen readers", () => {
    const label = textIn(anchors[0]);
    assert.ok(label.length > 0, "the back-link has no accessible text");
    // The arrow is decoration: announcing it would prefix the link with
    // "left arrow". Stripping every aria-hidden span must leave the label whole.
    const spoken = textIn(
      anchors[0].replace(/<span\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/gi, ""),
    );
    assert.equal(spoken, "All services");
  });
});

describe("clock-repairs.html keeps the single-stylesheet contract", () => {
  test("adds no inline <style> element", () => {
    assert.equal(tags("style").length, 0);
  });

  test("links exactly one stylesheet", () => {
    const links = [...markup.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)];
    assert.equal(links.length, 1);
  });

  test("references no remote assets, so the page stays self-contained", () => {
    assert.doesNotMatch(markup, /<img\b/i);
    assert.doesNotMatch(markup, /\bsrc="/i);
  });
});
