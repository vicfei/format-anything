#!/usr/bin/env node
import { runSelfTest } from "./selftest.js";
const ok = await runSelfTest();
process.exit(ok ? 0 : 1);
