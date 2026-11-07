import assert from "node:assert/strict";
import test from "node:test";
import type { CommandDefinition } from "@eyeauras/cli-factory";
import { teamCityDefinition } from "../src/cli.js";
import { createTestRuntime } from "./support.js";

// Assert meaning and writing constraints across the actual declarations, including generated leaves.
test("TeamCity help uses short actions and retains scenario examples", async t => {
  const definition = teamCityDefinition();
  const verbs = /^(Add|Append|Approve|Assign|Attach|Browse|Cancel|Change|Check|Choose|Clean|Clear|Commit|Configure|Confirm|Copy|Create|Delete|Detach|Disable|Discover|Edit|Enable|Explain|Filter|Force|Forget|Grant|Import|Include|Inherit|Inspect|Issue|Limit|List|Load|Manage|Move|Mute|Notify|Operate|Pause|Pin|Probe|Queue|Read|Remove|Reorder|Repeat|Replace|Report|Request|Reset|Resolve|Revoke|Save|Schedule|Select|Set|Show|Skip|Start|Stop|Summarize|Supply|Terminate|Unmute|Update|Upload|Use|Wait|Work)\b/;
  const check = (description: string, path: string) => {
    assert.ok(description.length <= 60, `${path}: description exceeds 60 characters`);
    assert.ok(description.split(/\s+/).length <= 8, `${path}: description exceeds eight words`);
    assert.match(description, verbs, path);
    assert.doesNotMatch(description, /\b(explicitly|never|non-secret|bounded|typed|literal|allowlisted|invented)\b/i, path);
  };
  let checked = 0;
  const walk = (commands: readonly CommandDefinition[], parent = "") => {
    for (const command of commands) {
      const path = `${parent} ${command.name}`;
      check(command.description, path);
      checked++;
      for (const option of command.options ?? []) check(option.description, `${path} ${option.flags}`);
      walk(command.children ?? [], path);
    }
  };
  walk(definition.commands);
  assert.ok(checked > 300, "The entire generated TeamCity command tree was checked.");
  for (const field of definition.profile?.fields ?? []) check(field.description, field.flags);
  assert.ok(definition.examples?.some(example => example.includes("jobs run")));
  const runtime = await createTestRuntime(t);
  const cli = runtime.createCli();
  const help = await runtime.run(cli, ["builds", "list", "--help"]);
  assert.match(help.stdout, /List queued, running and finished builds/);
  assert.match(help.stdout, /Select queued, running, finished or any \(default\)/);
  const configure = await runtime.run(cli, ["profile", "configure", "--help"]);
  assert.match(configure.stdout, /--url <url>\s+Set URL: http\(s\):\/\/host\[:port\]\[\/context\]/);
  assert.match(configure.stdout, /Read the token from stdin/);
  assert.match(configure.stdout, /My Settings & Tools >\s+Access Tokens/);
});
