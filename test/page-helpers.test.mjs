// Unit tests for the shared page helpers. The service-page tests lean on
// countSentences() to hold the brief's three-sentence cap and on countWords()
// to keep the copy inside it from thinning out, so both counters need to be
// pinned rather than trusted.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadPage, countSentences, countWords } from "../test-helpers/page.mjs";

describe("countSentences", () => {
  test("counts each terminator once, whichever it is", () => {
    assert.equal(countSentences("One. Two! Three?"), 3);
  });

  test("ignores tags, so it counts copy rather than markup", () => {
    assert.equal(countSentences("<p>One. <a href='x'>Two</a> is here.</p>"), 2);
  });

  test("does not count a trailing terminator as a fourth sentence", () => {
    assert.equal(countSentences("One. Two. Three."), 3);
  });

  test("counts an unterminated final clause", () => {
    assert.equal(countSentences("One. Two"), 2);
  });

  test("counts nothing in empty or absent copy", () => {
    assert.equal(countSentences(""), 0);
    assert.equal(countSentences("   "), 0);
    assert.equal(countSentences(null), 0);
  });
});

describe("countWords", () => {
  test("counts words, not markup", () => {
    assert.equal(countWords("<p>One <a href='x'>two</a> three</p>"), 3);
  });

  test("collapses runs of whitespace rather than counting them", () => {
    assert.equal(countWords("  one \n\n  two  "), 2);
  });

  test("counts nothing in empty or absent copy", () => {
    assert.equal(countWords(""), 0);
    assert.equal(countWords("   "), 0);
    assert.equal(countWords("<span></span>"), 0);
    assert.equal(countWords(null), 0);
  });
});

describe("loadPage().mainOf", () => {
  test("returns the inner markup of <main>, links intact", () => {
    // The watch-repairs test looks for an <a> inside this string, so mainOf
    // must not strip tags the way textOf does.
    const main = loadPage("watch-repairs.html").mainOf();
    assert.match(main, /<a\b[^>]*href="clock-repairs\.html"/i);
    assert.doesNotMatch(main, /<nav\b/i);
  });

  test("returns the empty string for a page with no <main>", () => {
    // index.html has no <main> landmark, so this is the real no-match path.
    assert.equal(loadPage("index.html").mainOf(), "");
  });
});
