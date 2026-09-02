// The watch repairs service page, checked as text. Alongside the shell and the
// back-link every service page carries, this pins the one thing the brief
// singles out for this page: the inline link across to clock repairs.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  loadPage,
  assertDocumentShell,
  countSentences,
  countWords,
} from "../test-helpers/page.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = loadPage("watch-repairs.html");
const { markup, tags, textOf, mainOf } = page;

const navMatch = markup.match(/<nav(?:\s[^>]*)?>([\s\S]*?)<\/nav>/i);
const nav = navMatch?.[1] ?? "";
const anchors = nav.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
const attr = (tag, name) =>
  tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;
const textIn = (fragment) =>
  fragment.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

describe("watch-repairs.html document shell", () => {
  test("matches the shell every page in the site shares", () => {
    assertDocumentShell(page, { title: "Watch Repairs" });
  });

  test("has exactly one <h1>, reading 'Watch Repairs'", () => {
    assert.equal(tags("h1").length, 1, "expected exactly one <h1>");
    assert.equal(textOf("h1"), "Watch Repairs");
  });

  test("wraps its content in a single <main> landmark", () => {
    assert.equal(tags("main").length, 1, "expected exactly one <main>");
    assert.ok(mainOf().trim().length > 0, "the <main> landmark is empty");
  });

  test("carries no <footer> — the social footer is About-specific", () => {
    assert.equal(tags("footer").length, 0, "expected no <footer>");
  });
});

describe("watch-repairs.html copy", () => {
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

describe("the brief-mandated link across to clock repairs", () => {
  // The brief asks watch repairs to link back to clock repairs, and the link
  // has to read as part of the copy. An href sitting in the <nav>, or an
  // anchor with no text, would satisfy neither the brief nor a reader — so
  // this looks inside <main> only, which the back-link nav sits outside of.
  const inline = mainOf().match(
    /<a\b[^>]*\bhref="clock-repairs\.html"[^>]*>([\s\S]*?)<\/a>/i,
  );

  test("sits inline in the copy, not in the back-link nav", () => {
    assert.ok(
      inline,
      'expected an <a href="clock-repairs.html"> inside <main>, outside the <nav>',
    );
    assert.doesNotMatch(
      nav,
      /clock-repairs\.html/i,
      "the cross-link belongs in the copy, not the nav",
    );
  });

  test("reads as words, not as a bare URL", () => {
    const label = textIn(inline[1]);
    assert.ok(label.length > 0, "the clock-repairs link has no text");
    assert.doesNotMatch(
      label,
      /^https?:|\.html$/i,
      `link text should be prose, not a URL: ${label}`,
    );
  });

  test("points at a page that is actually in the repo", () => {
    const href = inline[0].match(/\bhref="([^"]*)"/i)[1];
    assert.doesNotMatch(href, /^\w+:|^\/\//, "expected a relative link");
    assert.ok(
      existsSync(join(root, href)),
      `watch-repairs links to ${href}, which does not exist`,
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
    const spoken = textIn(
      anchors[0].replace(
        /<span\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/gi,
        "",
      ),
    );
    assert.equal(spoken, "All services");
  });
});

describe("watch-repairs.html keeps the single-stylesheet contract", () => {
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
