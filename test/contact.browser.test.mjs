// Behavioural proof that contact.html "does nothing".
//
// Run with:  node --test
//
// The brief's one subtle requirement is that submitting the form has no effect.
// That is browser behaviour, not markup, so it is checked by driving a real
// headless Chromium over the DevTools Protocol. Set CHROME_PATH to point at a
// browser if one is not found automatically.

import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { findBrowser, launch } from './helpers/cdp.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pageUrl = pathToFileURL(join(root, 'contact.html')).href
const browserPath = findBrowser()

// A value stashed on `window` after load. Any navigation or reload creates a
// fresh window, so its disappearance is a reliable "the page went somewhere"
// signal — more trustworthy than watching the URL alone, since a form with no
// action reloads to the *same* URL.
const MARKER = '__tt3_page_instance__'

async function openPage() {
  const session = await launch(browserPath)
  await session.send('Page.enable')
  await session.send('Runtime.enable')
  await session.send('Page.navigate', { url: pageUrl })
  // Wait for the document to finish loading before stamping the marker.
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const state = await session.evaluate('document.readyState')
    if (state === 'complete') break
    await session.sleep(50)
  }
  await session.evaluate(`window.${MARKER} = 'original'`)
  return session
}

/** True when the page never navigated or reloaded since openPage(). */
async function stayedPut(session) {
  await session.sleep(400) // give any navigation a chance to happen
  return session.evaluate(`window.${MARKER} === 'original'`)
}

const options = browserPath
  ? {}
  : { skip: 'no Chromium found — set CHROME_PATH to run the browser tests' }

test('contact form behaviour in a real browser', options, async (t) => {
  const session = await openPage()
  t.after(() => session.close())

  await t.test('renders the heading, both fields and the Send button', async () => {
    const view = await session.evaluate(`(() => ({
      heading: document.querySelector('h1')?.textContent.trim(),
      name: !!document.querySelector('input#name'),
      message: !!document.querySelector('textarea#message'),
      button: document.querySelector('button')?.textContent.trim(),
    }))()`)

    assert.equal(view.heading, 'Contact')
    assert.ok(view.name, 'Name input should be present')
    assert.ok(view.message, 'Message textarea should be present')
    assert.equal(view.button, 'Send')
  })

  await t.test('clicking Send does not navigate, reload or change the URL', async () => {
    const before = await session.evaluate('location.href')
    await session.evaluate(`document.querySelector('button').click()`)

    assert.ok(await stayedPut(session), 'page reloaded or navigated when Send was clicked')
    assert.equal(await session.evaluate('location.href'), before)
    // A real submission would serialise the fields into a query string.
    assert.equal(await session.evaluate('location.search'), '')
  })

  await t.test('clicking Send with the fields filled in still does nothing', async () => {
    await session.evaluate(`(() => {
      const name = document.querySelector('#name')
      const message = document.querySelector('#message')
      name.value = 'Ada'
      message.value = 'Hello there'
    })()`)
    await session.evaluate(`document.querySelector('button').click()`)

    assert.ok(await stayedPut(session), 'page navigated when submitting filled fields')
    assert.equal(await session.evaluate('location.search'), '')
    // The values are simply left alone — nothing clears or submits them.
    assert.equal(await session.evaluate(`document.querySelector('#name').value`), 'Ada')
  })

  await t.test('pressing Enter in the Name field does not submit', async () => {
    // The implicit-submission trap: a form with one submit-blocking field
    // submits on Enter even without a button being clicked.
    await session.evaluate(`document.querySelector('#name').focus()`)
    for (const type of ['rawKeyDown', 'char', 'keyUp']) {
      await session.send('Input.dispatchKeyEvent', {
        type,
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        text: '\r',
        unmodifiedText: '\r',
      })
    }

    assert.ok(await stayedPut(session), 'page navigated when Enter was pressed in Name')
    assert.equal(await session.evaluate('location.search'), '')
  })

  await t.test('the submit event fires but is cancelled', async () => {
    // Proves inertness is achieved by cancelling the event, not by the event
    // never reaching the form — the distinction the plan calls out.
    const outcome = await session.evaluate(`(() => {
      const form = document.querySelector('form')
      let seen = false
      const spy = () => { seen = true }
      form.addEventListener('submit', spy)
      const event = new Event('submit', { bubbles: true, cancelable: true })
      const notCancelled = form.dispatchEvent(event)
      form.removeEventListener('submit', spy)
      return { seen, cancelled: !notCancelled }
    })()`)

    assert.ok(outcome.seen, 'a submit event should reach the form')
    assert.ok(outcome.cancelled, 'the submit event should be cancelled by onsubmit="return false"')
  })

  await t.test('clicking a label focuses its field', async () => {
    const focused = await session.evaluate(`(() => {
      document.querySelector('label[for="message"]').click()
      return document.activeElement?.id
    })()`)
    assert.equal(focused, 'message')
  })

  await t.test('layout holds at a 375px viewport without horizontal scroll', async () => {
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 375, height: 720, deviceScaleFactor: 1, mobile: true,
    })
    await session.sleep(100)
    const overflow = await session.evaluate(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth')
    assert.ok(overflow <= 0, `expected no horizontal overflow, got ${overflow}px`)
    await session.send('Emulation.clearDeviceMetricsOverride')
  })
})
