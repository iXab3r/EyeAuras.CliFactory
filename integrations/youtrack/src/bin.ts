#!/usr/bin/env node
import { createYouTrackCli } from "./cli.js";

const app = createYouTrackCli();
try {
  process.exitCode = await app.run();
} finally {
  await app.dispose();
}
