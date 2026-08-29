#!/usr/bin/env node
import { createTeamCityCli } from "./cli.js";

process.exitCode = await createTeamCityCli().run();
