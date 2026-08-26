// The footer's social links, checked as text. Structure, URLs, rel guards and
// labelling are all provable from the markup; that the icons actually paint is
// render.test.mjs's job, and that they are the *right* marks is a human's.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "about.html"), "utf8");
const css = readFileSync(join(root, "styles.css"), "utf8");

/** Strip comments so tag counts don't pick up commented-out markup. */
const markup = html.replace(/<!--[\s\S]*?-->/g, "");

const tags = (name) =>
  markup.match(new RegExp(`<${name}(?:\\s[^>]*)?>`, "gi")) ?? [];

const footerMatch = markup.match(/<footer(?:\s[^>]*)?>([\s\S]*?)<\/footer>/i);
const footer = footerMatch?.[1] ?? "";

const anchors = footer.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];
const attr = (tag, name) =>
  tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;
const textOf = (fragment) =>
  fragment.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** The three networks, in the order the brief fixed them. */
const EXPECTED = [
  { name: "Facebook", href: "https://www.facebook.com/" },
  { name: "Instagram", href: "https://www.instagram.com/" },
  { name: "X", href: "https://x.com/" },
];

describe("the social footer's structure", () => {
  test("has exactly one <footer>", () => {
    assert.equal(tags("footer").length, 1);
    assert.ok(footerMatch, "expected a closed <footer> element");
  });

  test("places the footer after the main landmark", () => {
    const mainEnd = markup.search(/<\/main>/i);
    assert.ok(mainEnd !== -1, "expected a closing </main>");
    assert.ok(
      markup.search(/<footer\b/i) > mainEnd,
      "the footer must sit outside <main>, after it closes",
    );
  });

  test("holds one list of exactly three items", () => {
    assert.equal((footer.match(/<ul\b[^>]*>/gi) ?? []).length, 1);
    assert.equal((footer.match(/<li\b[^>]*>/gi) ?? []).length, 3);
  });

  test("labels the list with a visually-hidden heading", () => {
    const heading = footer.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    assert.ok(heading, "expected an <h2> naming the link group");
    assert.match(heading[0], /class="[^"]*\bvisually-hidden\b/);
    assert.ok(textOf(heading[1]).length > 0, "the heading is empty");
  });

  test("leaves TT-5's document contract intact", () => {
    // The footer adds no second <main>, no second <h1>, and no <p>.
    assert.equal(tags("main").length, 1);
    assert.equal(tags("h1").length, 1);
    assert.equal(tags("p").length, 1);
  });
});

describe("the social links themselves", () => {
  test("are exactly the three expected networks, in order", () => {
    assert.equal(anchors.length, EXPECTED.length);
    assert.deepEqual(
      anchors.map((a) => attr(a, "href")),
      EXPECTED.map((e) => e.href),
    );
  });

  for (const [index, expected] of EXPECTED.entries()) {
    describe(expected.name, () => {
      const anchor = () => {
        assert.ok(anchors[index], `no anchor at position ${index}`);
        return anchors[index];
      };

      test("points at an https homepage with no query string", () => {
        const href = attr(anchor(), "href");
        const url = new URL(href);
        assert.equal(url.protocol, "https:");
        assert.equal(url.search, "", `${href} carries a query string`);
        assert.equal(url.hash, "", `${href} carries a fragment`);
        assert.doesNotMatch(href, /utm_|fbclid|igshid|\bref=/i);
      });

      test("opens in a new tab without leaking the opener", () => {
        assert.equal(attr(anchor(), "target"), "_blank");
        const rel = attr(anchor(), "rel") ?? "";
        assert.match(rel, /\bnoopener\b/);
        assert.match(rel, /\bnoreferrer\b/);
      });

      test("carries one decorative inline 24x24 icon", () => {
        const svgs = anchor().match(/<svg\b[^>]*>/gi) ?? [];
        assert.equal(svgs.length, 1, "expected exactly one inline <svg>");
        assert.equal(attr(svgs[0], "viewBox"), "0 0 24 24");
        assert.equal(attr(svgs[0], "aria-hidden"), "true");
        assert.equal(attr(svgs[0], "focusable"), "false");
        // No fill on the path: the icon takes its colour from the cascade.
        const path = anchor().match(/<path\b[^>]*>/i);
        assert.ok(path, "expected a <path> inside the icon");
        assert.ok(
          attr(path[0], "d")?.length > 0,
          "the icon path has no geometry",
        );
        assert.equal(attr(path[0], "fill"), null);
      });

      test("is named by visually-hidden text, not aria-label", () => {
        assert.equal(
          attr(anchor(), "aria-label"),
          null,
          "the visually-hidden span is the single source of the accessible name",
        );
        const span = anchor().match(
          /<span\b[^>]*class="[^"]*\bvisually-hidden\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
        );
        assert.ok(span, "expected a visually-hidden label span");
        const label = textOf(span[1]);
        assert.ok(label.length > 0, "the label is empty");
        assert.match(label, new RegExp(`\\b${expected.name}\\b`));
        assert.match(label, /new tab/i);
      });
    });
  }

  test("references no remote assets, so the page stays self-contained", () => {
    assert.doesNotMatch(footer, /<img\b/i, "the icons must be inline SVG");
    assert.doesNotMatch(footer, /\bsrc="/i);
    assert.doesNotMatch(footer, /url\(/i);
  });
});

describe("the footer keeps the single-stylesheet contract", () => {
  test("adds no inline <style> element", () => {
    // render.test.mjs asserts document.styleSheets.length === 1, and an inline
    // <style> counts towards that.
    assert.equal(tags("style").length, 0);
  });

  test("still links exactly one stylesheet", () => {
    const links = [...markup.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)];
    assert.equal(links.length, 1);
  });

  test("styles.css carries the footer's rules and stays page-agnostic", () => {
    assert.match(css, /\.visually-hidden\b/);
    assert.match(css, /\.social-links\b/);
    assert.doesNotMatch(css, /\.about[\w-]*/i);
    assert.doesNotMatch(css, /#about[\w-]*/i);
  });

  test("gives every link a target at least as large as the 44px minimum", () => {
    assert.match(css, /min-width:\s*44px/);
    assert.match(css, /min-height:\s*44px/);
  });
});
