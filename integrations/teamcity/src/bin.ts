#!/usr/bin/env node
import { createTeamCityCli } from "./cli.js";

const app = createTeamCityCli();
// The first Ctrl+C stops local work such as waiting and reports how to resume; a second one exits.
const interrupt = new AbortController();
const onInterrupt = () => interrupt.abort(new Error("Interrupted."));
process.once("SIGINT", onInterrupt);
try {
  process.exitCode = await app.run(process.argv.slice(2), { signal: interrupt.signal });
} finally {
  process.off("SIGINT", onInterrupt);
  await app.dispose();
}
