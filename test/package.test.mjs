// The suite needs a newer Node than the LTS a contributor is likely to have
// (see the engines pin). These tests keep the manifest honest about that, and
// keep `npm test` able to find its tests on every Node that ships --test — so
// an under-spec Node reports a version problem rather than "Could not find
// 'test/**/*.test.mjs'".
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

describe("package.json declares what the suite needs", () => {
  test("pins a Node floor high enough for the features the tests use", () => {
    const range = pkg.engines?.node;
    assert.ok(range, "expected an engines.node range");
    const floor = Number(range.match(/(\d+)/)?.[1]);
    // render.test.mjs drives CDP over the global WebSocket, unflagged from 22.
    assert.ok(
      floor >= 22,
      `engines.node is "${range}"; the CDP client needs the global WebSocket of Node >=22`,
    );
  });

  test("the test script names every test file, on any Node", () => {
    const script = pkg.scripts?.test;
    assert.match(script ?? "", /^node --test /, "expected a node --test script");

    // npm runs scripts through sh, so expand the arguments the way npm will.
    // This is the portable form: a quoted glob is only expanded by the runner
    // itself from Node 21, and a bare directory stopped being accepted after
    // Node 22 — both leave some or all of the suite unrun.
    const argv = script.replace(/^node --test /, "");
    const expanded = execFileSync("sh", ["-c", `printf '%s\\n' ${argv}`], {
      cwd: root,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .sort();

    const onDisk = readdirSync(join(root, "test"))
      .filter((name) => name.endsWith(".test.mjs"))
      .map((name) => `test/${name}`)
      .sort();

    assert.ok(onDisk.length > 0, "expected test files on disk");
    assert.deepEqual(
      expanded,
      onDisk,
      `the test script resolves to ${JSON.stringify(expanded)}, not the suite`,
    );
  });
});
