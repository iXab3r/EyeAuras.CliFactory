import assert from "node:assert/strict";
import test from "node:test";
import { CliError, command, createCli, durationParser, recordView } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

interface Outcome {
  id: number;
  outcome: string;
}

const outcomeView = recordView<Outcome>({
  title: (value) => `Item ${value.id}`,
  fields: [{ label: "Outcome", value: (value) => value.outcome }],
});

async function fixture(t: test.TestContext) {
  const f = await createCliFixture(t, {
    applicationId: "outcome-cli",
    profiles: [{ name: "default" }, { name: "uat" }],
  });
  const app = f.createApplication((runtime) => createCli({
    name: "outcome-cli",
    description: "Outcome fixture",
    commands: [
      command("fail <id>", "Report a failed outcome", ({ args }, context) => {
        context.progress(`Checking ${args.id}`);
        throw new CliError(`Item ${args.id} failed.`, {
          code: "item.failed",
          result: { id: Number(args.id), outcome: "failed" },
          next: [["inspect", args.id]],
        });
      }, { view: outcomeView }),
      command("late <id>", "Report a deadline", ({ args }) => {
        throw new CliError(`Item ${args.id} is still running.`, {
          code: "item.timeout", exitCode: 124, next: [["late", args.id]],
        });
      }),
      command("plain", "Throw an ordinary error", () => {
        throw new Error("Ordinary failure.");
      }),
    ],
    runtime,
  }));
  return { f, app };
}

test("a failed outcome keeps its data on stdout and reports the reason and exit code", async (t) => {
  const { f, app } = await fixture(t);

  const human = await f.run(app, ["fail", "7", "--profile", "uat"]);
  assert.equal(human.exitCode, 1);
  assert.equal(human.stdout, "Item 7\nOutcome:  failed\n");
  assert.equal(human.stderr, "Checking 7\nItem 7 failed.\n", "A rendered result shows its own follow-ups.");

  const json = await f.run(app, ["fail", "7", "--json"]);
  assert.equal(json.exitCode, 1);
  assert.deepEqual(JSON.parse(json.stdout), { id: 7, outcome: "failed" });
  assert.equal(json.stderr, "Item 7 failed.\n", "JSON mode never prints progress.");

  const late = await f.run(app, ["late", "8", "--profile", "uat"]);
  assert.equal(late.exitCode, 124);
  assert.equal(late.stdout, "");
  assert.equal(
    late.stderr,
    "Item 8 is still running.\nNext:\n  outcome-cli late 8 --profile uat\n",
  );

  const plain = await f.run(app, ["plain"]);
  assert.deepEqual([plain.exitCode, plain.stdout, plain.stderr], [1, "", "Ordinary failure.\n"]);
});

test("execute rejects with the result and JSON-RPC returns it in the error data", async (t) => {
  const { f, app } = await fixture(t);

  await assert.rejects(app.execute(["fail", "7", "--profile", "uat"]), (error: unknown) => {
    assert.ok(error instanceof CliError);
    assert.equal(error.code, "item.failed");
    assert.equal(error.exitCode, 1);
    assert.equal(error.profile, "uat");
    assert.deepEqual(error.result, { id: 7, outcome: "failed" });
    return true;
  });

  const replies = await f.rpc(app, [["fail", "7", "--profile", "uat"], ["late", "8"], ["plain"]]);
  assert.deepEqual(replies, [
    {
      jsonrpc: "2.0", id: 0,
      error: {
        code: -32000,
        message: "Item 7 failed.",
        data: {
          code: "item.failed", exitCode: 1, profile: "uat",
          next: [["inspect", "7", "--profile", "uat"]],
          result: { id: 7, outcome: "failed" },
        },
      },
    },
    {
      jsonrpc: "2.0", id: 1,
      error: {
        code: -32000,
        message: "Item 8 is still running.",
        data: { code: "item.timeout", exitCode: 124, profile: "default", next: [["late", "8", "--profile", "default"]] },
      },
    },
    { jsonrpc: "2.0", id: 2, error: { code: -32000, message: "Ordinary failure." } },
  ]);
});

test("CliError validates its code and exit status", () => {
  assert.throws(() => new CliError("x", { code: "Not valid" }), /code/);
  assert.throws(() => new CliError("x", { code: "a.b", exitCode: 0 }), /exit code/);
  assert.throws(() => new CliError("x", { code: "a.b", exitCode: 256 }), /exit code/);
  assert.equal(new CliError("x", { code: "a.b" }).exitCode, 1);
});

test("durations accept h/m/s segments within bounds and reject everything else", () => {
  const parse = durationParser({ min: 1_000, max: 2 * 3_600_000, errorMessage: "Bad duration." });
  assert.equal(parse("1s"), 1_000);
  assert.equal(parse("90s"), 90_000);
  assert.equal(parse("10m"), 600_000);
  assert.equal(parse("1h30m"), 5_400_000);
  assert.equal(parse("1h0m5s"), 3_605_000);
  assert.equal(parse("2h"), 7_200_000);
  for (const bad of ["", "0s", "2h1s", "10", "1.5m", "-5s", "5 s", "5S", "m", "1m1h", "05x"]) {
    assert.throws(() => parse(bad), (error: Error) => error.message === "Bad duration.", bad);
  }
  assert.throws(() => durationParser({ min: 5, max: 1, errorMessage: "x" }), /bounds/);
});
