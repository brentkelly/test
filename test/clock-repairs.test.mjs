// The clock repairs service page, checked as text. It is the first of the three
// pages services.html links to, so alongside the shell this pins the back-link
// that carries a reader out of the leaf and back to the index.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  loadPage,
  assertDocumentShell,
  countSentences,
  countWords,
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
    assert.equal(tags("h1").length, 1, "expected exactly one <h1>");
    assert.equal(textOf("h1"), "Clock Repairs");
  });

  test("wraps its content in a single <main> landmark", () => {
    assert.equal(tags("main").length, 1, "expected exactly one <main>");
    assert.ok(mainOf().trim().length > 0, "the <main> landmark is empty");
  });

  test("carries no <footer> — the social footer is About-specific", () => {
    assert.equal(tags("footer").length, 0, "expected no <footer>");
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

  test("still says something inside that cap", () => {
    // The sentence cap on its own is satisfiable by a stub, so floor the copy
    // as well: three sentences that carry nothing would pass the brief and
    // fail a reader. 30 words is roughly two short sentences of substance.
    const words = countWords(mainOf());
    assert.ok(
      words >= 30,
      `the copy runs to only ${words} words; a service page needs at least 30`,
    );
  });

  test("keeps the heading ahead of the copy", () => {
    assert.ok(
      markup.search(/<h1\b/i) < markup.search(/<p\b/i),
      "expected the <h1> to precede the <p>",
    );
  });
});

describe("the back-link out to the services index", () => {
  test("sits in exactly one <nav>, ahead of <main>", () => {
    assert.equal(tags("nav").length, 1, "expected exactly one <nav>");
    assert.ok(navMatch, "expected a closed <nav>");
    assert.ok(
      markup.search(/<nav\b/i) < markup.search(/<main\b/i),
      "the nav must precede the main landmark in source order",
    );
  });

  test("is the nav's only link, and points at services.html", () => {
    assert.equal(anchors.length, 1, "the nav must hold exactly one link");
    assert.equal(
      attr(anchors[0], "href"),
      "services.html",
      "the back-link must point at the services index",
    );
  });

  test("carries the shared .back-link class the services card shipped", () => {
    assert.match(
      attr(anchors[0], "class") ?? "",
      /\bback-link\b/,
      "the back-link must carry the shared .back-link class",
    );
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
