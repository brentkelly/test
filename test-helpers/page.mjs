import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

export function getTags(markup, name) {
  return markup.match(new RegExp(`<${name}(?:\\s[^>]*)?>`, "gi")) ?? [];
}

export function getTextOf(markup, name) {
  const m = markup.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
  );
  return m ? m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : null;
}

export function loadPage(root, filename) {
  const html = readFileSync(join(root, filename), "utf8");
  const css = readFileSync(join(root, "styles.css"), "utf8");
  const markup = stripComments(html);

  return {
    html,
    css,
    markup,
    tags: (name) => getTags(markup, name),
    textOf: (name) => getTextOf(markup, name),
    fileExists: (path) => existsSync(join(root, path)),
  };
}

export function assertDocumentShell(page, filename) {
  const { html, markup, fileExists } = page;

  return {
    hasDoctype: () => html.trimStart().match(/^<!DOCTYPE html>/i),
    hasLanguage: () => markup.match(/<html\b[^>]*\blang="en"/i),
    hasCharset: () => markup.match(/<meta\b[^>]*\bcharset="utf-8"/i),
    hasViewport: () => {
      const viewport = markup.match(
        /<meta\b[^>]*name="viewport"[^>]*content="([^"]*)"/i,
      );
      return viewport && /width=device-width/.test(viewport[1]) &&
             /initial-scale=1\b/.test(viewport[1]);
    },
    hasDescription: () => {
      const description = markup.match(
        /<meta\b[^>]*name="description"[^>]*content="([^"]*)"/i,
      );
      return description && description[1].trim().length > 0 &&
             description[1].length <= 160;
    },
    linksStylesheet: () =>
      markup.match(/<link\b[^>]*rel="stylesheet"[^>]*href="styles\.css"/i),
    stylesheetExists: () => fileExists("styles.css"),
  };
}

/**
 * Extract the text content of the <main> element.
 * @param {Object} page - The loaded page object
 * @returns {string} The text content of the main element
 */
export function mainOf(page) {
  return getTextOf(page.markup, "main") ?? "";
}

/**
 * Count the number of sentences in the given text.
 * A sentence is text ending with a period, question mark, or exclamation mark.
 * @param {string} text - The text to analyze
 * @returns {number} The number of sentences
 */
export function countSentences(text) {
  // Match sentence-ending punctuation: period, question mark, exclamation
  // Avoid counting abbreviations by requiring at least one space or character after
  const sentences = text.match(/[.!?]+(?:\s|$)/g) || [];
  return sentences.length;
}
