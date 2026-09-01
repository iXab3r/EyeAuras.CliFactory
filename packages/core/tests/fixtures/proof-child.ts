import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const mode = process.argv[2];
if (mode === "json") {
  process.stdout.write(JSON.stringify({ value: "synthetic", stdin: await readInput() }));
} else if (mode === "environment") {
  process.stdout.write(JSON.stringify({
    credentialPresent: Object.keys(process.env).some(name => name.toUpperCase() === "SYNTHETIC_TOKEN"),
    retained: process.env.SYNTHETIC_KEEP,
  }));
} else if (mode === "bytes") {
  process.stdout.write("é".repeat(Number(process.argv[3])));
  process.stderr.write("é".repeat(Number(process.argv[4])));
} else if (mode === "failure") {
  process.stdout.write("synthetic-private-stdout");
  process.stderr.write("synthetic-private-stderr");
  process.exitCode = 17;
} else if (mode === "rpc") {
  for await (const line of createInterface({ input: process.stdin })) {
    const request = JSON.parse(line);
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result: { pid: process.pid } })}\n`);
  }
} else if (mode === "hang" || mode === "overflow" || mode === "closed-input") {
  writeFileSync(process.argv[3]!, String(process.pid));
  process.on("SIGTERM", () => undefined);
  if (mode === "closed-input") {
    process.stdin.destroy();
    process.exit(0);
  }
  if (mode === "overflow") process.stdout.write("synthetic-private-output".repeat(1000));
  setInterval(() => undefined, 1000);
}

async function readInput(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
