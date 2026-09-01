import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mainOf, countSentences } from "../test-helpers/page.mjs";

describe("mainOf", () => {
  test("extracts the text of a multi-line <main>", () => {
    const page = {
      markup: "<body>\n  <main>\n    <h1>Title</h1>\n    <p>One. Two.</p>\n  </main>\n</body>",
    };
    assert.equal(mainOf(page), "Title One. Two.");
  });

  test("reads through attributes on the <main> tag", () => {
    const page = { markup: '<main id="content">\n  <p>Body.</p>\n</main>' };
    assert.equal(mainOf(page), "Body.");
  });

  test("returns an empty string when there is no <main>", () => {
    assert.equal(mainOf({ markup: "<body><p>Body.</p></body>" }), "");
  });
});

describe("countSentences", () => {
  test("counts sentence-ending punctuation", () => {
    assert.equal(countSentences("One. Two! Three?"), 3);
  });

  test("counts nothing in empty text", () => {
    assert.equal(countSentences(""), 0);
  });
});
