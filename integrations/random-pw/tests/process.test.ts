import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, stat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

test("packaged PW clients reuse one host/browser; real live harness is rehearsed offline; stop reaps Chromium", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pw-process-"));
  const preload = new URL("./process-preload.js", import.meta.url).href;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    RANDOM_PW_TEST_ROOT: root,
    NODE_OPTIONS: `--import=${preload}`,
  };
  delete env.NODE_TEST_CONTEXT;
  for (const key of [
    "CI",
    "GITHUB_ACTIONS",
    "TF_BUILD",
    "BUILD_BUILDID",
    "JENKINS_URL",
    "TEAMCITY_VERSION",
  ])
    delete env[key];
  const bin = fileURLToPath(new URL("../src/bin.js", import.meta.url));
  const run = (args: string[], file = bin, input?: string) => {
    const pending = promisify(execFile)(process.execPath, [file, ...args], {
      env,
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 65536,
    });
    pending.child.stdin!.end(input);
    return pending;
  };
  t.after(async () => {
    await run(["ipc-server", "stop", "--json"]).catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  });
  assert.equal(
    JSON.parse((await run(["ipc-server", "status", "--json"])).stdout).running,
    false,
  );
  await run([
    "profile",
    "configure",
    "demo",
    "--contact",
    "operator@example.com",
  ]);
  const invoke = () =>
    run([
      "integers",
      "--count",
      "3",
      "--min",
      "2",
      "--max",
      "5",
      "--profile",
      "demo",
      "--json",
    ]);
  const coldStart = performance.now();
  await invoke();
  const cold = performance.now() - coldStart;
  const warmStart = performance.now();
  await invoke();
  const warm = performance.now() - warmStart;
  const concurrent = await Promise.all([invoke(), invoke()]);
  for (const item of concurrent) {
    assert.deepEqual(JSON.parse(item.stdout), { values: [2, 2, 2] });
    assert.equal(item.stderr, "");
  }
  const proof = await run(
    ["--profile", "demo"],
    fileURLToPath(
      new URL("../integration-tests/profile-proof.js", import.meta.url),
    ),
  );
  assert.match(proof.stdout, /pass 4/);
  assert.match(proof.stdout, /fail 0/);
  const trace = join(root, "runtime-proof.jsonl");
  const events = (await readFile(trace, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "launch");
  assert.ok(events[0].browserPid > 0);
  assert.equal(
    JSON.parse((await run(["ipc-server", "status", "--json"])).stdout).pid,
    events[0].hostPid,
  );
  const captured: string[] = [];
  const inspectVideo = async (stderr: string) => {
    const lines = stderr.trim().split("\n");
    assert.equal(lines.length, 1);
    assert.ok(lines[0]!.startsWith("Browser video: "));
    const path = JSON.parse(
      lines[0]!.slice("Browser video: ".length),
    ) as string;
    captured.push(path);
    assert.ok((await stat(path)).size > 0);
    assert.equal(
      (await readFile(path)).subarray(0, 4).toString("hex"),
      "1a45dfa3",
    );
  };
  const help = await run(["integers", "--help"]);
  assert.match(help.stdout, /--headed/);
  assert.match(help.stdout, /--record-video/);
  const recorded = await run([
    "integers",
    "--count",
    "2",
    "--record-video",
    "--profile",
    "demo",
    "--json",
  ]);
  assert.deepEqual(JSON.parse(recorded.stdout), { values: [1, 1] });
  await inspectVideo(recorded.stderr);
  const headed = await run([
    "sequence",
    "--min",
    "1",
    "--max",
    "2",
    "--headed",
    "--record-video",
    "--profile",
    "demo",
    "--json",
  ]);
  assert.deepEqual(JSON.parse(headed.stdout), { values: [2, 1] });
  await inspectVideo(headed.stderr);
  const normal = await invoke();
  assert.equal(normal.stderr, "");
  const requests = [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "cli.execute",
      params: {
        argv: [
          "integers",
          "--count",
          "2",
          "--record-video",
          "--profile",
          "demo",
        ],
      },
    },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "cli.execute",
      params: {
        argv: ["sequence", "--min", "1", "--max", "2", "--profile", "demo"],
      },
    },
  ];
  const rpc = await run(
    ["--json-rpc"],
    bin,
    requests.map((r) => JSON.stringify(r)).join("\n") + "\n",
  );
  const replies = rpc.stdout
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(replies, [
    { jsonrpc: "2.0", id: 1, result: { values: [1, 1] } },
    { jsonrpc: "2.0", id: 2, result: { values: [2, 1] } },
  ]);
  await inspectVideo(rpc.stderr);
  assert.equal(new Set(captured).size, 3);
  const artifacts = join(root, "random-pw-cli", "demo", "browser", "artifacts");
  assert.equal(
    (await readdir(artifacts, { recursive: true })).filter((path) =>
      path.endsWith(".webm"),
    ).length,
    3,
  );
  assert.equal(
    JSON.parse((await run(["ipc-server", "status", "--json"])).stdout).pid,
    events[0].hostPid,
  );
  await run(["ipc-server", "stop", "--json"]);
  const stopped = (await readFile(trace, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(stopped.length, 6);
  assert.deepEqual(
    stopped
      .filter((event) => event.event === "launch")
      .map((event) => event.headless),
    [true, false, true],
  );
  assert.equal(stopped[1].event, "close");
  assert.equal(stopped[1].identity, events[0].identity);
  for (const event of stopped.filter((event) => event.event === "launch"))
    assert.throws(() => process.kill(event.browserPid, 0), { code: "ESRCH" });
  assert.equal(
    JSON.parse((await run(["ipc-server", "status", "--json"])).stdout).running,
    false,
  );
  t.diagnostic(
    JSON.stringify({
      fixtureColdBrowserMs: Math.round(cold),
      fixtureWarmBrowserMs: Math.round(warm),
      warmBaselineLaunches: 1,
      launchesIncludingModeSwitches: 3,
    }),
  );
});
