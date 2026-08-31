#!/usr/bin/env node
import { createTeamCityCli } from "./cli.js";

const app = createTeamCityCli();
try {
  process.exitCode = await app.run();
} finally {
  await app.dispose();
}
