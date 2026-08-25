// Renders about.html in headless Chrome to prove the things static parsing
// cannot: that styles.css actually applies (rather than 404ing), and that a
// narrow viewport does not produce a horizontal scrollbar.
//
// Skips cleanly, with a stated reason, when the environment cannot run it (no
// headless Chrome, or a Node too old for the global WebSocket), so `npm test`
// stays dependency-free on machines that do not have one.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE_WIDTH = 375;
const LOAD_TIMEOUT_MS = 15_000;

const PLAYWRIGHT_CACHE = join(process.env.HOME ?? "", ".cache/ms-playwright");
const SHELL_PREFIX = "chromium_headless_shell-";

/**
 * Playwright pins a different build revision per version, so discover whatever
 * this machine actually has rather than hardcoding one. Newest revision first.
 */
async function playwrightCandidates() {
  let entries;
  try {
    entries = await readdir(PLAYWRIGHT_CACHE);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.startsWith(SHELL_PREFIX))
    .sort(
      (a, b) =>
        Number.parseInt(b.slice(SHELL_PREFIX.length), 10) -
        Number.parseInt(a.slice(SHELL_PREFIX.length), 10),
    )
    .map((name) =>
      join(
        PLAYWRIGHT_CACHE,
        name,
        "chrome-headless-shell-linux64/chrome-headless-shell",
      ),
    );
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    ...(await playwrightCandidates()),
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  for (const path of candidates) {
    try {
      await access(path, constants.X_OK);
      return path;
    } catch {}
  }
  return null;
}

const TYPES = { ".html": "text/html", ".css": "text/css" };

/** Serves the repo root, so a missing styles.css shows up as a real 404. */
function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (path.includes("..")) return res.writeHead(403).end();
    try {
      const body = await readFile(join(root, path));
      const ext = path.slice(path.lastIndexOf("."));
      res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server)),
  );
}

/** Minimal CDP client — enough to navigate and evaluate one expression. */
async function connect(port) {
  let targets;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (targets.length) break;
    } catch {}
    await sleep(250);
  }
  assert.ok(targets?.length, "headless Chrome exposed no debugging target");
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  const pending = new Map();
  const waiters = new Map();
  let id = 0;
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    // Events carry a method and no id; command replies carry an id.
    if (message.id === undefined) {
      const resolvers = waiters.get(message.method);
      waiters.delete(message.method);
      resolvers?.forEach((resolve) => resolve(message.params));
      return;
    }
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  };
  return {
    send: (method, params = {}) =>
      new Promise((resolve) => {
        const next = ++id;
        pending.set(next, resolve);
        ws.send(JSON.stringify({ id: next, method, params }));
      }),
    /** Resolves on the next occurrence of a CDP event. Arm before you trigger it. */
    once: (method) =>
      new Promise((resolve) => {
        const resolvers = waiters.get(method) ?? [];
        resolvers.push(resolve);
        waiters.set(method, resolvers);
      }),
    close: () => ws.close(),
  };
}

const chrome = await findChrome();

/** Why this suite cannot run in this environment, or false if it can. */
function skipReason() {
  if (typeof WebSocket === "undefined")
    return "the CDP client needs the global WebSocket of Node >=22 (see package.json engines)";
  if (!chrome) return "no headless Chrome available";
  return false;
}

describe("about.html renders", { skip: skipReason() }, () => {
  let server;
  let browser;
  let cdp;
  let page;

  before(async () => {
    server = await serve();
    const port = 9222 + (process.pid % 500);
    browser = spawn(
      chrome,
      [
        "--no-sandbox",
        "--disable-gpu",
        `--remote-debugging-port=${port}`,
        `--window-size=${MOBILE_WIDTH},800`,
        "about:blank",
      ],
      { stdio: "ignore" },
    );
    cdp = await connect(port);
    await cdp.send("Page.enable");
    // Arm the listener before navigating, or the event can land first.
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", {
      url: `http://127.0.0.1:${server.address().port}/about.html`,
    });
    await Promise.race([
      loaded,
      sleep(LOAD_TIMEOUT_MS, null, { ref: false }).then(() => {
        throw new Error(
          `about.html did not fire load within ${LOAD_TIMEOUT_MS}ms`,
        );
      }),
    ]);
    const { result } = await cdp.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `({
        styleSheetCount: document.styleSheets.length,
        ruleCount: [...document.styleSheets].reduce((n, s) => n + s.cssRules.length, 0),
        lineHeight: parseFloat(getComputedStyle(document.body).lineHeight),
        fontSize: parseFloat(getComputedStyle(document.body).fontSize),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        paragraphHeight: document.querySelector('main p').getBoundingClientRect().height,
        headingText: document.querySelector('h1').textContent.trim(),
      })`,
    });
    page = result.result.value;
  });

  after(() => {
    cdp?.close();
    browser?.kill();
    server?.close();
  });

  test("applies styles.css instead of 404ing on it", () => {
    assert.equal(page.styleSheetCount, 1);
    assert.ok(page.ruleCount > 0, "stylesheet loaded but parsed to zero rules");
  });

  test("the applied line-height is the one styles.css asks for", () => {
    // 1.6 * font-size, per the body rule — proves cascade, not just a fetch.
    assert.ok(Math.abs(page.lineHeight / page.fontSize - 1.6) < 0.01);
  });

  test("does not scroll horizontally at a 375px viewport", () => {
    assert.equal(page.clientWidth, MOBILE_WIDTH);
    assert.ok(
      page.scrollWidth <= page.clientWidth,
      `scrollWidth ${page.scrollWidth} exceeds viewport ${page.clientWidth}`,
    );
  });

  test("shows the heading and the paragraph", () => {
    assert.equal(page.headingText, "About Us");
    assert.ok(page.paragraphHeight > 0, "paragraph rendered with zero height");
  });
});
