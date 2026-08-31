#!/usr/bin/env node
import { createYouTrackCli } from "./cli.js";

process.exitCode = await createYouTrackCli().run();
