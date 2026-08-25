import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "about.html"), "utf8");
const css = readFileSync(join(root, "styles.css"), "utf8");

/** Strip comments so tag counts don't pick up commented-out markup. */
const markup = html.replace(/<!--[\s\S]*?-->/g, "");

const tags = (name) =>
  markup.match(new RegExp(`<${name}(?:\\s[^>]*)?>`, "gi")) ?? [];

const textOf = (name) => {
  const m = markup.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
  );
  return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : null;
};

describe("about.html document shell", () => {
  test("declares the HTML5 doctype", () => {
    assert.match(html.trimStart(), /^<!DOCTYPE html>/i);
  });

  test("sets the document language", () => {
    assert.match(markup, /<html\b[^>]*\blang="en"/i);
  });

  test("declares a UTF-8 charset", () => {
    assert.match(markup, /<meta\b[^>]*\bcharset="utf-8"/i);
  });

  test("declares a responsive viewport", () => {
    const viewport = markup.match(
      /<meta\b[^>]*name="viewport"[^>]*content="([^"]*)"/i,
    );
    assert.ok(viewport, "expected a viewport meta tag");
    assert.match(viewport[1], /width=device-width/);
    assert.match(viewport[1], /initial-scale=1\b/);
  });

  test("has an About Us title", () => {
    assert.equal(textOf("title"), "About Us");
  });
});

describe("about.html content", () => {
  test("wraps its content in a single <main> landmark", () => {
    assert.equal(tags("main").length, 1);
  });

  test("has exactly one <h1>, reading 'About Us'", () => {
    assert.equal(tags("h1").length, 1);
    assert.equal(textOf("h1"), "About Us");
  });

  test("has exactly one paragraph, as the brief requires", () => {
    assert.equal(tags("p").length, 1);
  });

  test("the paragraph carries real body copy", () => {
    const paragraph = textOf("p");
    assert.ok(paragraph, "expected a paragraph element");
    // A one-paragraph About page: long enough to say something, short enough
    // to stay one paragraph.
    assert.ok(
      paragraph.split(/\s+/).length >= 40,
      `paragraph is only ${paragraph.split(/\s+/).length} words`,
    );
    assert.doesNotMatch(paragraph, /lorem ipsum/i);
  });

  test("the heading precedes the paragraph", () => {
    assert.ok(markup.search(/<h1\b/i) < markup.search(/<p\b/i));
  });
});

describe("stylesheet wiring", () => {
  test("links styles.css", () => {
    assert.match(
      markup,
      /<link\b[^>]*rel="stylesheet"[^>]*href="styles\.css"/i,
    );
  });

  test("every linked stylesheet resolves to a file that exists", () => {
    const hrefs = [...markup.matchAll(/<link\b[^>]*href="([^"]+)"/gi)].map(
      (m) => m[1],
    );
    assert.ok(hrefs.length > 0, "expected at least one linked stylesheet");
    for (const href of hrefs) {
      assert.ok(
        !/^(https?:)?\/\//.test(href),
        `${href} is remote; the page should be self-contained`,
      );
      assert.ok(existsSync(join(root, href)), `${href} does not exist`);
    }
  });
});

describe("styles.css stays page-agnostic and readable", () => {
  test("applies a border-box reset", () => {
    assert.match(css, /box-sizing:\s*border-box/);
  });

  test("constrains the measure so long copy stays readable", () => {
    assert.match(css, /max-width:\s*\d+(\.\d+)?(ch|rem|px)/);
  });

  test("sets a comfortable line-height on the body", () => {
    const lineHeight = css.match(/line-height:\s*(\d+(?:\.\d+)?)/);
    assert.ok(lineHeight, "expected a line-height declaration");
    assert.ok(Number(lineHeight[1]) >= 1.4);
  });

  test("carries no page-specific selectors, so other pages can reuse it", () => {
    assert.doesNotMatch(css, /\.about[\w-]*/i);
    assert.doesNotMatch(css, /#about[\w-]*/i);
  });

  test("uses no fixed pixel widths that would force horizontal scrolling", () => {
    assert.doesNotMatch(css, /\bwidth:\s*\d{3,}px/);
  });
});
