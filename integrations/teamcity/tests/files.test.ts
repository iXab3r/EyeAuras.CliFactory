import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, readdir, mkdir, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { AppArguments } from "@eyeauras/cli-factory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createTeamCityCli } from "../src/cli.js";
import { createTestRuntime } from "./support.js";
import { fileCases, sourceBytes, pngBytes } from "./files-cases.js";
import { safeFile, remotePath } from "../src/file-models.js";
const base = "https://teamcity.test/app/rest",
  service = "ai-cli-factory:teamcity-cli";
const server = setupServer();
test.before(() => server.listen({ onUnhandledRequest: "error" }));
test.afterEach(() => server.resetHandlers());
test.after(() => server.close());
async function fileRuntime(input = "") {
  const root = await mkdtemp(join(tmpdir(), "teamcity-files-test-"));
  const runtime = await createTestRuntime({ input });
  const appArguments = new AppArguments({
    AppName: "teamcity-cli",
    Environment: {
      AppDomainDirectory: root,
      ApplicationExecutablePath: join(root, "cli.js"),
      EnvironmentLocalAppData: root,
      EnvironmentAppData: root,
      ProcessId: 1,
    },
  });
  runtime.runtime.appArguments = appArguments;
  return {
    root,
    runtime,
    appArguments,
    cli: createTeamCityCli(runtime.runtime),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}
for (const c of fileCases)
  test(`S10 contract: ${c.method} ${c.path}`, async () => {
    const t = await fileRuntime();
    let calls = 0;
    try {
      for (const [key, value] of Object.entries(c.storedSecrets ?? {}))
        await t.runtime.secretStore.set(service, "default:" + key, value);
      server.use(
        http.all(/^https:\/\/teamcity\.test\/app\/rest\//, async ({ request }) => {
          calls++;
          const url = new URL(request.url);
          assert.equal(request.method, c.method);
          assert.equal(url.pathname, "/app/rest" + c.path);
          assert.deepEqual(Object.fromEntries(url.searchParams), c.query ?? {});
          assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
          assert.equal(
            request.headers.get("Accept"),
            c.bytes
              ? c.media === "application/octet-stream" || c.media === "application/zip"
                ? "*/*"
                : c.media
              : (c.media ?? "application/json"),
          );
          assert.equal(
            request.headers.get("Content-Type"),
            c.body === undefined ? null : "text/plain",
          );
          assert.equal(await request.text(), c.body ?? "");
          return c.bytes
            ? new HttpResponse(c.bytes as never, { headers: { "Content-Type": c.media! } })
            : c.media
              ? HttpResponse.text(String(c.response))
              : HttpResponse.json(c.response as never);
        }),
      );
      if (c.permission) {
        await assert.rejects(t.cli.execute(c.argv), /Permission 'Credentials'/);
        assert.equal(calls, 0);
        await t.cli.execute(["permissions", "grant", c.permission]);
      }
      assert.equal(await t.cli.run([...c.argv, "--json"]), 0, t.runtime.stderr());
      const result = JSON.parse(t.runtime.stdout());
      if (c.bytes) {
        const name = c.argv[c.argv.indexOf("--output") + 1]!;
        assert.deepEqual(result, {
          path: join(t.appArguments.AppDataDirectory, "downloads", name),
          bytes: c.bytes.length,
          sha256: createHash("sha256").update(c.bytes).digest("hex"),
          mediaType: c.media,
        });
        assert.deepEqual(new Uint8Array(await readFile(result.path)), c.bytes);
        assert.deepEqual(await readdir(t.appArguments.TempDirectory), []);
      } else assert.deepEqual(result, c.expected);
      if (c.storedKey)
        assert.equal(
          await t.runtime.secretStore.get(service, "default:" + c.storedKey),
          c.storedValue,
        );
      assert.equal(calls, 1);
    } finally {
      await t.cleanup();
    }
  });

const download = [
  "builds",
  "artifacts",
  "download",
  "7",
  "docs/example.bin",
  "--output",
  "example.bin",
];
test("S10 all gates and generated help run before network, keyring input or filesystem creation", async () => {
  const t = await fileRuntime();
  let calls = 0;
  try {
    await t.runtime.profileStore.setPermissions("default", []);
    server.use(
      http.all("*", () => {
        calls++;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    for (const c of fileCases) {
      await assert.rejects(t.cli.execute(c.argv), /Permission/);
      assert.equal(await t.cli.run([...c.argv, "--help"]), 0);
    }
    assert.equal(calls, 0);
    assert.deepEqual(await readdir(t.root), []);
  } finally {
    await t.cleanup();
  }
});
test("S10 rejects traversal, encoded/absolute paths, devices, unsafe areas and missing output before HTTP", async () => {
  const t = await fileRuntime();
  let calls = 0;
  try {
    server.use(
      http.all("*", () => {
        calls++;
        return HttpResponse.json({});
      }),
    );
    for (const path of [
      "../secret",
      "x/../y",
      "%2e%2e/secret",
      "C:/secret",
      "/secret",
      "x\\y",
      "x//y",
      ".",
      "x\u0000y",
    ]) {
      assert.throws(() => remotePath(path));
      await assert.rejects(t.cli.execute([...download.slice(0, 4), path, ...download.slice(5)]));
    }
    for (const name of ["../other.bin", "C:\\other.bin", "CON", "nul.bin", "file.", "a:b", "/x"]) {
      await assert.rejects(t.cli.execute([...download.slice(0, -1), name]));
    }
    for (const argv of [
      ["server", "files", "list", "custom.hidden"],
      ["jobs", "files", "list", "Build", "--limit", "101"],
      ["users", "avatar", "download", "3", "--size", "301", "--output", "avatar.png"],
      [...download, "--max-bytes", "67108865"],
      download.slice(0, 5),
    ])
      await assert.rejects(t.cli.execute(argv));
    assert.equal(calls, 0);
  } finally {
    await t.cleanup();
  }
});
test("S10 existing destinations and publication races never overwrite another file", async () => {
  const t = await fileRuntime(),
    dir = join(t.appArguments.AppDataDirectory, "downloads"),
    path = join(dir, "example.bin");
  let calls = 0;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path, "synthetic-existing");
    server.use(
      http.get(base + "/builds/id:7/artifacts/files/docs/example.bin", async () => {
        calls++;
        await writeFile(path, "synthetic-racing-owner", { flag: "wx" });
        return new HttpResponse(sourceBytes as never);
      }),
    );
    await assert.rejects(t.cli.execute(download), /already exists/);
    assert.equal(calls, 0);
    assert.equal(await readFile(path, "utf8"), "synthetic-existing");
    await rm(path);
    await assert.rejects(t.cli.execute(download), /no destination was published/);
    assert.equal(calls, 1);
    assert.equal(await readFile(path, "utf8"), "synthetic-racing-owner");
    assert.deepEqual(await readdir(t.appArguments.TempDirectory), []);
  } finally {
    await t.cleanup();
  }
});
test("S10 symlink or junction download/temp directories fail closed without touching target", async () => {
  for (const name of ["downloads", "temp"]) {
    const t = await fileRuntime();
    let calls = 0;
    try {
      const outside = join(t.root, "outside");
      await mkdir(outside);
      await mkdir(t.appArguments.AppDataDirectory, { recursive: true });
      await symlink(
        outside,
        join(t.appArguments.AppDataDirectory, name),
        process.platform === "win32" ? "junction" : "dir",
      );
      server.use(
        http.all("*", () => {
          calls++;
          return new HttpResponse(sourceBytes as never);
        }),
      );
      await assert.rejects(t.cli.execute(download), /symlink|junction|declared path/);
      assert.equal(calls, 0);
      assert.deepEqual(await readdir(outside), []);
    } finally {
      await t.cleanup();
    }
  }
});
test("S10 size limits apply to actual streams and all failed staging bytes are removed", async () => {
  for (const declared of [false, true]) {
    const t = await fileRuntime();
    try {
      server.use(
        http.get(
          base + "/builds/id:7/artifacts/files/docs/example.bin",
          () =>
            new HttpResponse(
              new ReadableStream({
                start(c) {
                  c.enqueue(new Uint8Array(4));
                  c.enqueue(new Uint8Array(6));
                  c.close();
                },
              }),
              { headers: declared ? { "Content-Length": "10" } : {} },
            ),
        ),
      );
      await assert.rejects(t.cli.execute([...download, "--max-bytes", "8"]), /Download failed/);
      assert.deepEqual(await readdir(join(t.appArguments.AppDataDirectory, "downloads")), []);
      assert.deepEqual(await readdir(t.appArguments.TempDirectory), []);
    } finally {
      await t.cleanup();
    }
  }
});
test("S10 invalid PNG ZIP SVG content/media never becomes a successful file", async () => {
  const samples = [
    {
      argv: ["users", "avatar", "download", "3", "--output", "x.png"],
      media: "text/html",
      bytes: pngBytes,
    },
    {
      argv: ["users", "avatar", "download", "3", "--output", "x.png"],
      media: "image/png",
      bytes: sourceBytes,
    },
    {
      argv: ["builds", "artifacts", "archive", "7", "docs", "--output", "x.zip"],
      media: "application/zip",
      bytes: sourceBytes,
    },
    {
      argv: ["builds", "icon", "7", "--output", "x.svg"],
      media: "image/svg+xml",
      bytes: new TextEncoder().encode('<!DOCTYPE svg [<!ENTITY x "synthetic">]><svg/>'),
    },
  ];
  for (const c of samples) {
    const t = await fileRuntime();
    try {
      server.use(
        http.all(
          /^https:\/\/teamcity\.test/,
          () => new HttpResponse(c.bytes as never, { headers: { "Content-Type": c.media } }),
        ),
      );
      await assert.rejects(t.cli.execute(c.argv), /Download failed/);
      assert.deepEqual(await readdir(join(t.appArguments.AppDataDirectory, "downloads")), []);
      assert.deepEqual(await readdir(t.appArguments.TempDirectory), []);
    } finally {
      await t.cleanup();
    }
  }
});
test("S10 empty ordinary files are retained and metadata keeps absent directory size", async () => {
  const t = await fileRuntime();
  try {
    server.use(
      http.get(
        base + "/builds/id:7/artifacts/files/docs/example.bin",
        () => new HttpResponse(new Uint8Array(0)),
      ),
    );
    const result = (await t.cli.execute(download)) as { path: string; bytes: number };
    assert.equal(result.bytes, 0);
    assert.equal((await readFile(result.path)).length, 0);
    assert.deepEqual(safeFile({ name: "docs" }), { name: "docs" });
    assert.throws(() => safeFile({ name: "x", size: Number.MAX_SAFE_INTEGER + 1 }));
  } finally {
    await t.cleanup();
  }
});
test("S10 cancellation during a response discards owned staging and suppresses abort reason", async () => {
  const t = await fileRuntime(),
    controller = new AbortController();
  let pulls = 0;
  try {
    t.runtime.runtime.fetch = async () =>
      new Response(
        new ReadableStream({
          pull(c) {
            pulls++;
            if (pulls === 2) {
              controller.abort(new Error("synthetic-private-abort"));
              return;
            }
            c.enqueue(new Uint8Array(4));
          },
        }),
      );
    const cli = createTeamCityCli(t.runtime.runtime);
    await assert.rejects(
      cli.execute(download, controller.signal),
      (e) =>
        e instanceof Error &&
        !e.message.includes("synthetic-private-abort") &&
        e.cause === undefined,
    );
    assert.ok(pulls >= 2);
    assert.deepEqual(await readdir(t.appArguments.TempDirectory), []);
    assert.deepEqual(await readdir(join(t.appArguments.AppDataDirectory, "downloads")), []);
  } finally {
    await t.cleanup();
  }
});
test("S10 redirects are refused without forwarding auth or following a signed URL", async () => {
  const t = await fileRuntime();
  let foreign = 0;
  try {
    server.use(
      http.get(
        base + "/builds/id:7/artifacts/files/docs/example.bin",
        () =>
          new HttpResponse(null, {
            status: 302,
            headers: { Location: "https://foreign.test/private?signature=synthetic-secret" },
          }),
      ),
      http.get("https://foreign.test/*", () => {
        foreign++;
        return new HttpResponse(sourceBytes as never);
      }),
    );
    await assert.rejects(
      t.cli.execute(download),
      (e) => e instanceof Error && !e.message.includes("synthetic-secret"),
    );
    assert.equal(foreign, 0);
    assert.deepEqual(await readdir(join(t.appArguments.AppDataDirectory, "downloads")), []);
  } finally {
    await t.cleanup();
  }
});
test("S10 persistent RPC keeps downloaded bytes and paths isolated by active profile", async () => {
  const commands = [download, [...download, "--profile", "uat"]];
  const input =
    commands
      .map((argv, id) =>
        JSON.stringify({ jsonrpc: "2.0", id, method: "cli.execute", params: { argv } }),
      )
      .join("\n") + "\n";
  const t = await fileRuntime(input);
  let calls = 0;
  try {
    await t.runtime.profileStore.create("uat", { url: "https://uat.test" });
    await t.runtime.secretStore.set(service, "uat:token", "fixture-uat");
    server.use(
      http.get(base + "/builds/id:7/artifacts/files/docs/example.bin", ({ request }) => {
        calls++;
        assert.equal(request.headers.get("Authorization"), "Bearer fixture-token");
        return new HttpResponse(new TextEncoder().encode("synthetic-default-data"));
      }),
      http.get(
        "https://uat.test/app/rest/builds/id:7/artifacts/files/docs/example.bin",
        ({ request }) => {
          calls++;
          assert.equal(request.headers.get("Authorization"), "Bearer fixture-uat");
          return new HttpResponse(new TextEncoder().encode("synthetic-uat-data"));
        },
      ),
    );
    assert.equal(await t.cli.run(["--json-rpc"]), 0);
    const frames = t.runtime
      .stdout()
      .trim()
      .split("\n")
      .map((v) => JSON.parse(v));
    assert.equal(calls, 2);
    assert.notEqual(frames[0].result.path, frames[1].result.path);
    assert.equal(await readFile(frames[0].result.path, "utf8"), "synthetic-default-data");
    assert.equal(await readFile(frames[1].result.path, "utf8"), "synthetic-uat-data");
    assert.doesNotMatch(t.runtime.stdout(), /synthetic-(?:default|uat)-data/);
    assert.ok(frames[1].result.path.startsWith(t.appArguments.WithProfile("uat").AppDataDirectory));
  } finally {
    await t.cleanup();
  }
});
test("S10 secure resolution rejects collisions and unresolved expressions and reports store failures", async () => {
  const t = await fileRuntime();
  let calls = 0;
  try {
    await t.cli.execute(["permissions", "grant", "Credentials"]);
    await t.runtime.secretStore.set(service, "default:input-secret:resolved", "synthetic-existing");
    server.use(
      http.get(base + "/builds/id:7/resolved/:value", () => {
        calls++;
        return HttpResponse.text("%env.MODE%");
      }),
    );
    const argv = ["builds", "resolve-parameter", "7", "env.MODE", "--store-as", "resolved"];
    await assert.rejects(t.cli.execute(argv), /already exists/);
    assert.equal(calls, 0);
    await t.runtime.secretStore.delete(service, "default:input-secret:resolved");
    await assert.rejects(t.cli.execute(argv), /unresolved/);
    assert.equal(calls, 1);
    assert.equal(
      await t.runtime.secretStore.get(service, "default:input-secret:resolved"),
      undefined,
    );
    server.use(
      http.get(base + "/builds/id:7/resolved/:value", () => {
        calls++;
        return HttpResponse.text("synthetic-resolved-secret");
      }),
    );
    t.runtime.secretStore.set = async () => {
      throw new Error("synthetic-private-store");
    };
    await assert.rejects(
      t.cli.execute(argv),
      /Remote operation succeeded but secure persistence failed/,
    );
    assert.equal(calls, 2);
  } finally {
    await t.cleanup();
  }
});
test("S10 secure-reference aliases are isolated from auth/input aliases and exact text survives", async () => {
  const t = await fileRuntime();
  try {
    await t.cli.execute(["permissions", "grant", "Credentials"]);
    await t.runtime.secretStore.set(
      service,
      "default:secure-reference:same",
      "synthetic-reference",
    );
    await t.runtime.secretStore.set(service, "default:input-secret:same", "synthetic-input");
    server.use(
      http.get(base + "/projects/id:Example/secure/values/synthetic-reference", () =>
        HttpResponse.text(" synthetic-secret-with-whitespace "),
      ),
    );
    assert.deepEqual(
      await t.cli.execute([
        "projects",
        "secure",
        "resolve",
        "Example",
        "--reference",
        "same",
        "--store-as",
        "target",
      ]),
      { alias: "target", stored: true },
    );
    assert.equal(
      await t.runtime.secretStore.get(service, "default:input-secret:target"),
      " synthetic-secret-with-whitespace ",
    );
    await t.cli.execute(["projects", "secure", "forget-reference", "same"]);
    assert.equal(
      await t.runtime.secretStore.get(service, "default:secure-reference:same"),
      undefined,
    );
    assert.equal(
      await t.runtime.secretStore.get(service, "default:input-secret:same"),
      "synthetic-input",
    );
    assert.equal(await t.runtime.secretStore.get(service, "default:token"), "fixture-token");
  } finally {
    await t.cleanup();
  }
});
