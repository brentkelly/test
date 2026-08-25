import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');

test('declares the HTML5 doctype', () => {
  assert.match(html, /^<!DOCTYPE html>/i);
});

test('declares the document language', () => {
  assert.match(html, /<html\b[^>]*\slang="en"/i);
});

test('declares a UTF-8 charset', () => {
  assert.match(html, /<meta\b[^>]*\scharset="utf-8"/i);
});

test('declares a responsive viewport', () => {
  assert.match(html, /<meta\b[^>]*\sname="viewport"[^>]*\scontent="width=device-width, initial-scale=1"/i);
});

test('the tab title is exactly "Hi Yo!"', () => {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i);
  assert.ok(title, 'expected a <title> element');
  assert.equal(title[1], 'Hi Yo!');
});

test('the sole heading is an <h1> reading exactly "Hi Yo!"', () => {
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  assert.equal(headings.length, 1, 'expected exactly one heading');
  assert.equal(headings[0][1], '1', 'expected the heading to be an <h1>');
  assert.equal(headings[0][2].trim(), 'Hi Yo!');
});

test('the body is the only element rendering text, and it renders the greeting', () => {
  const body = html.match(/<body>([\s\S]*?)<\/body>/i);
  assert.ok(body, 'expected a <body> element');
  const text = body[1].replace(/<[^>]*>/g, '').trim();
  assert.equal(text, 'Hi Yo!');
});

test('centres content horizontally and vertically via flexbox', () => {
  const style = html.match(/<style>([\s\S]*?)<\/style>/i);
  assert.ok(style, 'expected an inline <style> block');
  const css = style[1];
  for (const decl of [
    /\bmargin:\s*0\b/,
    /\bmin-height:\s*100vh\b/,
    /\bdisplay:\s*flex\b/,
    /\balign-items:\s*center\b/,
    /\bjustify-content:\s*center\b/,
  ]) {
    assert.match(css, decl);
  }
});

test('uses a system font stack rather than a web font', () => {
  assert.match(html, /font-family:\s*system-ui\b/i);
});

test('requests no resources beyond the document itself', () => {
  assert.doesNotMatch(html, /<script\b/i, 'expected no <script> elements');
  assert.doesNotMatch(html, /url\s*\(/i, 'expected no CSS url() references');
  assert.doesNotMatch(html, /@import\b/i, 'expected no CSS @import');

  // Every resource-bearing attribute must be a self-contained data: URI, so the
  // document fetches nothing over the network.
  const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/gi)].map(m => m[1]);
  for (const ref of refs) {
    assert.match(ref, /^data:/, `expected ${JSON.stringify(ref)} to be an inline data: URI`);
  }
});

test('suppresses the browser\'s automatic /favicon.ico request', () => {
  // Browsers fetch /favicon.ico for any http(s) document unless an icon is
  // declared, which 404s and logs a console error. An empty data: URI declares
  // one without a network round-trip.
  assert.match(html, /<link\b[^>]*\brel="icon"[^>]*\bhref="data:[^"]*"/i);
});
