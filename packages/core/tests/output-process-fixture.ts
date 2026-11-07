import { once } from "node:events";
import { createCli, localCommand, streamResult } from "../src/index.js";

const app = createCli({
  name: "output-test-cli", description: "Synthetic output process fixture", version: "1.0.0",
  commands: [
    localCommand("value", "Return a value", () => ({ ok: true })),
    localCommand("items", "List items", () => streamResult(async function* () {
      try { yield { ok: true }; yield { ok: false }; }
      finally { process.send?.("iterator closed"); }
    })),
  ],
  resources: [{ dispose() { process.send?.("disposed"); } }],
});

// Parent closes its stdout reader before allowing any output. No timing or buffer-size race.
const start = once(process, "message");
process.send?.("ready");
await start;
try {
  process.exitCode = await app.run(process.argv.slice(2));
} finally {
  await app.dispose();
  process.disconnect();
}
