// Unit tests for the CDP session's failure handling.
//
// The browser tests only ever exercise the happy path, where every request gets
// a reply. This covers the other case: the socket dying with requests still in
// flight. Left unhandled, those requests hang until the per-test timeout and
// report a timeout instead of the real cause.
//
// makeSession only ever touches addEventListener/send/close on its socket, so a
// stub stands in for a real one and keeps these tests browser-free.

import test from 'node:test'
import assert from 'node:assert/strict'
import { makeSession } from '../test-helpers/cdp.mjs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function stubSocket() {
  const listeners = new Map()
  return {
    sent: [],
    addEventListener(type, fn) {
      listeners.set(type, fn)
    },
    emit(type, event) {
      listeners.get(type)?.(event)
    },
    send(payload) {
      this.sent.push(JSON.parse(payload))
    },
    close() {},
  }
}

/** Resolve to the promise's outcome, or the string 'hung' if it never settles. */
async function outcomeOf(promise, ms = 250) {
  return Promise.race([
    promise.then(() => 'resolved', (error) => error),
    sleep(ms).then(() => 'hung'),
  ])
}

test('a request in flight rejects when the socket closes', async () => {
  const socket = stubSocket()
  const session = makeSession(socket, () => {})

  const inFlight = session.send('Runtime.evaluate')
  socket.emit('close', {})

  const outcome = await outcomeOf(inFlight)
  assert.notEqual(outcome, 'hung', 'send() never settled after the socket closed')
  assert.ok(outcome instanceof Error, `expected an Error, got ${outcome}`)
  assert.match(outcome.message, /closed/)
})

test('a request in flight rejects when the socket errors', async () => {
  const socket = stubSocket()
  const session = makeSession(socket, () => {})

  const inFlight = session.send('Runtime.evaluate')
  socket.emit('error', {})

  const outcome = await outcomeOf(inFlight)
  assert.notEqual(outcome, 'hung', 'send() never settled after the socket errored')
  assert.ok(outcome instanceof Error, `expected an Error, got ${outcome}`)
  assert.match(outcome.message, /errored/)
})

test('every outstanding request rejects, not just the first', async () => {
  const socket = stubSocket()
  const session = makeSession(socket, () => {})

  const outcomes = Promise.all([
    outcomeOf(session.send('Page.enable')),
    outcomeOf(session.send('Runtime.enable')),
    outcomeOf(session.send('Runtime.evaluate')),
  ])
  socket.emit('close', {})

  for (const outcome of await outcomes) {
    assert.ok(outcome instanceof Error, `expected an Error, got ${outcome}`)
  }
})

test('a request made after the socket closed fails fast', async () => {
  const socket = stubSocket()
  const session = makeSession(socket, () => {})
  socket.emit('close', {})

  const outcome = await outcomeOf(session.send('Runtime.evaluate'))
  assert.notEqual(outcome, 'hung', 'send() never settled on a dead socket')
  assert.ok(outcome instanceof Error, `expected an Error, got ${outcome}`)
  assert.equal(socket.sent.length, 0, 'nothing should be written to a dead socket')
})

test('replies still resolve their request on a healthy socket', async () => {
  const socket = stubSocket()
  const session = makeSession(socket, () => {})

  const inFlight = session.send('Runtime.evaluate', { expression: '1 + 1' })
  const { id } = socket.sent.at(-1)
  socket.emit('message', { data: JSON.stringify({ id, result: { value: 2 } }) })

  assert.deepEqual(await inFlight, { value: 2 })
})

test('an error reply rejects its request', async () => {
  const socket = stubSocket()
  const session = makeSession(socket, () => {})

  const inFlight = session.send('Runtime.evaluate')
  const { id } = socket.sent.at(-1)
  socket.emit('message', { data: JSON.stringify({ id, error: { message: 'boom' } }) })

  await assert.rejects(inFlight, /boom/)
})
