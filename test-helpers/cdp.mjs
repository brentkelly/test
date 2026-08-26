// Minimal Chrome DevTools Protocol client.
//
// Deliberately dependency-free: it uses only Node built-ins (child_process, fs,
// os, path, and the global WebSocket/fetch available since Node 22). TT-3 ships
// a standalone HTML file with no package manager, so the tests must not
// introduce one either.

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CANDIDATE_BROWSERS = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

/** Absolute path to a usable Chromium build, or null if none is installed. */
export function findBrowser() {
  for (const candidate of CANDIDATE_BROWSERS) {
    if (candidate && existsSync(candidate)) return candidate
  }
  // Playwright keeps its downloads under a versioned directory; glob it by hand
  // rather than depending on playwright itself.
  const root = join(process.env.HOME ?? '', '.cache', 'ms-playwright')
  if (!existsSync(root)) return null
  for (const entry of readdirSafe(root)) {
    if (!entry.startsWith('chromium')) continue
    for (const layout of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-linux/headless_shell']) {
      const candidate = join(root, entry, layout)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Launch headless Chromium and attach to its first page target.
 * Returns a session with `send`, `evaluate` and `close`.
 */
export async function launch(executablePath) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'tt3-cdp-'))
  const child = spawn(executablePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--user-data-dir=${userDataDir}`,
    // Port 0 makes Chromium pick a free port and record it in DevToolsActivePort.
    '--remote-debugging-port=0',
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] })

  const cleanup = () => {
    try { child.kill('SIGKILL') } catch {}
    try { rmSync(userDataDir, { recursive: true, force: true }) } catch {}
  }

  try {
    const port = await waitForPort(join(userDataDir, 'DevToolsActivePort'), child)
    const wsUrl = await waitForPageTarget(port)
    const socket = await connect(wsUrl)
    return makeSession(socket, cleanup)
  } catch (error) {
    cleanup()
    throw error
  }
}

async function waitForPort(portFile, child, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`browser exited early with code ${child.exitCode}`)
    if (existsSync(portFile)) {
      const port = readFileSync(portFile, 'utf8').split('\n')[0].trim()
      if (port) return Number(port)
    }
    await sleep(50)
  }
  throw new Error('timed out waiting for DevToolsActivePort')
}

async function waitForPageTarget(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      const targets = await response.json()
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // Browser not serving yet; retry.
    }
    await sleep(50)
  }
  throw new Error('timed out waiting for a page target')
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl)
    socket.addEventListener('open', () => resolve(socket), { once: true })
    socket.addEventListener('error', () => reject(new Error(`failed to connect to ${wsUrl}`)), { once: true })
  })
}

export function makeSession(socket, cleanup) {
  let nextId = 1
  const pending = new Map()
  // Set once the socket is gone. Every later send() fails fast with this rather
  // than parking a promise nothing can ever settle.
  let dead = null

  // A dropped socket used to strand in-flight requests until the per-test
  // timeout fired, which hid the real cause (usually a browser crash) behind a
  // generic timeout. Fail them loudly instead.
  const killPending = (error) => {
    dead ??= error
    for (const settle of pending.values()) settle.reject(error)
    pending.clear()
  }

  socket.addEventListener('close', () => killPending(new Error('CDP socket closed')), { once: true })
  socket.addEventListener('error', () => killPending(new Error('CDP socket errored')), { once: true })

  socket.addEventListener('message', (event) => {
    const frame = JSON.parse(event.data)
    if (frame.id === undefined) return // protocol event; unused here
    const settle = pending.get(frame.id)
    if (!settle) return
    pending.delete(frame.id)
    if (frame.error) settle.reject(new Error(`${frame.method ?? 'CDP'}: ${frame.error.message}`))
    else settle.resolve(frame.result)
  })

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    if (dead) {
      reject(dead)
      return
    }
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })

  /** Evaluate an expression in the page and return its JSON value. */
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? 'evaluation failed')
    }
    return result.result.value
  }

  const close = async () => {
    try { socket.close() } catch {}
    cleanup()
  }

  return { send, evaluate, close, sleep }
}
