import assert from "node:assert/strict";
import test from "node:test";
import { command, createCli, Permission, targetCommands } from "../src/index.js";
import { createCliFixture } from "../src/testing.js";

function targetCommandTypeContract() {
  const targets = targetCommands(() => ({ fixture: true }));
  targets.read("get <item-id>", "Get item", (_target, { args }) => {
    const id: string = args["item-id"];
    // @ts-expect-error Target binding must not broaden inferred positional names.
    void args.itemId;
    return id;
  });
}
void targetCommandTypeContract;

test("target commands resolve after admission and once per ordinary or RPC invocation", async (t) => {
  const fixture = await createCliFixture(t, {
    applicationId: "target-commands-test",
    profiles: [
      { name: "default", permissions: [] },
      { name: "other", permissions: [Permission.ReadOnly] },
    ],
  });
  const seen: string[] = [];
  const targets = targetCommands((context) => {
    seen.push(context.profile.name);
    return { profile: context.profile.name, sequence: seen.length };
  });
  const app = fixture.createApplication((runtime) => createCli({
    name: "target-commands-test",
    description: "Target command fixture",
    runtime,
    permissions: {
      categories: [{ name: "Admin", description: "Administrative fixture operations" }],
    },
    commands: [command("items", "Items", [
      targets.read("get <id>", "Read", (target, { args }, context) => ({
        ...target, id: args.id, appData: context.appArguments.AppDataDirectory,
      })),
      targets.update("set <id>", "Update", (target, { args }) => ({ ...target, id: args.id })),
      targets.gated("Admin")("delete <id>", "Delete", (target, { args }) => ({
        ...target, id: args.id,
      })),
    ])],
  }));

  await assert.rejects(app.execute(["items", "get", "one"]), /Permission 'ReadOnly'/);
  await assert.rejects(app.execute(["items", "set", "one"]), /Permission 'Update'/);
  await assert.rejects(app.execute(["items", "delete", "one"]), /Permission 'Admin'/);
  assert.deepEqual(seen, [], "denied leaves must not construct an authenticated target");

  await fixture.profileStore.setPermissions("default", [
    Permission.ReadOnly, Permission.Update, "Admin",
  ]);
  assert.deepEqual(await app.execute(["items", "set", "two"]), {
    profile: "default", sequence: 1, id: "two",
  });
  assert.deepEqual(await app.execute(["items", "delete", "three"]), {
    profile: "default", sequence: 2, id: "three",
  });

  assert.deepEqual(await fixture.rpc(app, [
    ["items", "get", "one"],
    ["items", "get", "two", "--profile", "other"],
    ["items", "get", "three"],
  ]), [
    { jsonrpc: "2.0", id: 0, result: {
      profile: "default", sequence: 3, id: "one",
      appData: fixture.appArguments.AppDataDirectory,
    } },
    { jsonrpc: "2.0", id: 1, result: {
      profile: "other", sequence: 4, id: "two",
      appData: fixture.appArguments.WithProfile("other").AppDataDirectory,
    } },
    { jsonrpc: "2.0", id: 2, result: {
      profile: "default", sequence: 5, id: "three",
      appData: fixture.appArguments.AppDataDirectory,
    } },
  ]);
  assert.deepEqual(seen, ["default", "default", "default", "other", "default"]);
});
