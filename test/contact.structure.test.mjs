// Structural guards for contact.html.
//
// Run with:  node --test
//
// These assertions are cheap and run anywhere. They protect the markup contract
// that makes the form inert; contact.browser.test.mjs proves the same contract
// holds in a real browser.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(join(root, 'contact.html'), 'utf8')
const formTag = html.match(/<form\b[^>]*>/i)?.[0] ?? ''

test('document has the boilerplate that keeps it renderable and accessible', () => {
  assert.match(html, /^<!doctype html>/i)
  assert.match(html, /<html\b[^>]*\blang="en"/i)
  assert.match(html, /<meta\b[^>]*\bcharset="utf-8"/i)
  assert.match(html, /<meta\b[^>]*\bname="viewport"[^>]*\bcontent="width=device-width/i)
  assert.match(html, /<title>Contact<\/title>/i)
})

test('exposes exactly the two fields the brief asks for', () => {
  const inputs = html.match(/<input\b[^>]*>/gi) ?? []
  const textareas = html.match(/<textarea\b[^>]*>/gi) ?? []

  assert.equal(inputs.length, 1, 'expected a single Name input')
  assert.equal(textareas.length, 1, 'expected a single Message textarea')
  assert.match(inputs[0], /\btype="text"/i)
  assert.match(inputs[0], /\bid="name"/i)
  assert.match(textareas[0], /\bid="message"/i)
})

test('labels are wired to their fields by for/id', () => {
  assert.match(html, /<label\b[^>]*\bfor="name"[^>]*>\s*Name\s*<\/label>/i)
  assert.match(html, /<label\b[^>]*\bfor="message"[^>]*>\s*Message\s*<\/label>/i)
})

test('has a submit button labelled Send', () => {
  assert.match(html, /<button\b[^>]*\btype="submit"[^>]*>\s*Send\s*<\/button>/i)
})

test('form is inert: onsubmit returns false', () => {
  // Load-bearing. Without this a form with no action submits to the current URL
  // and reloads the page, so the form would not "do nothing".
  assert.notEqual(formTag, '', 'contact.html must contain a <form>')
  assert.match(formTag, /\bonsubmit="return false"/i)
})

test('form declares no action, method or target', () => {
  assert.doesNotMatch(formTag, /\baction=/i)
  assert.doesNotMatch(formTag, /\bmethod=/i)
  assert.doesNotMatch(formTag, /\btarget=/i)
})

test('no field is marked required, so native validation never fires', () => {
  // Native validation popups would be the form doing something.
  assert.doesNotMatch(html, /\brequired\b/i)
})

test('is self-contained: no external stylesheet, script or network reference', () => {
  assert.doesNotMatch(html, /<link\b/i)
  assert.doesNotMatch(html, /<script\b/i)
  assert.doesNotMatch(html, /https?:\/\//i)
  assert.match(html, /<style>/i, 'styling should be inline in a <style> block')
})
