import { createCli, command, Permission, tokenAuth } from "../src/index.js";

const unexpected = async (): Promise<never> => {
  throw new Error("Parser fixture reached profile mutation, credentials, or network.");
};
const profile = { name: "default", values: {} };
const cli = createCli({
  name: "builtin-test-cli",
  description: "Synthetic built-in parser process fixture",
  permissions: {},
  auth: tokenAuth({ required: () => false }),
  commands: [command("ping", "Confirm the process remains available", () => ({ ok: true }), {
    permission: Permission.ReadOnly,
  })],
  runtime: {
    profileStore: {
      get: async () => profile,
      list: async () => ({ active: "default", profiles: [profile] }),
      create: unexpected,
      set: unexpected,
      setDefault: unexpected,
      delete: unexpected,
      getPermissions: async () => undefined,
      setPermissions: unexpected,
    },
    secretStore: { get: unexpected, set: unexpected, delete: unexpected },
    fetch: unexpected,
  },
});

const [mode, serialized] = process.argv.slice(2);
if (mode === "rpc") {
  process.exitCode = await cli.run(["--json-rpc"]);
} else if (mode === "execute") {
  for (const argv of JSON.parse(serialized!) as string[][]) {
    try {
      console.log(JSON.stringify({ result: await cli.execute(argv) }));
    } catch (error) {
      console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  }
} else if (mode === "run") {
  const code = await cli.run(JSON.parse(serialized!) as string[]);
  console.log(JSON.stringify({ returned: code }));
  process.exitCode = code;
} else {
  throw new Error("Unknown parser fixture mode.");
}
