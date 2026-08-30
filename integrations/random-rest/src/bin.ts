#!/usr/bin/env node
import { createRandomRestCli } from "./cli.js";

process.exitCode = await createRandomRestCli().run();
