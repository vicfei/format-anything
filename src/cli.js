#!/usr/bin/env node
// CLI (design §9): analyze | verify | search(stub) | selftest.
// Exit codes: 0 verified · 1 hypothesis/partial · 2 invalid input — CI-able.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { analyze, TOOL_VERSION } from "./pipeline.js";
import { runGate } from "./gate/roundtrip.js";
import { validateSpec } from "./spec/validate.js";

const [cmd, ...args] = process.argv.slice(2);

function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

function die(msg, code = 2) { console.error(msg); process.exit(code); }

if (cmd === "analyze") {
  const files = args.filter((a) => !a.startsWith("--"));
  if (!files.length) die("usage: analyze <file> [--context \"...\"] [--out DIR]");
  const out = flag("out");
  if (out) mkdirSync(out, { recursive: true });
  let worst = 0;
  for (const f of files) {
    const sample = readFileSync(f);
    const result = await analyze({ sample, sampleName: f.split("/").pop(), context: flag("context", "") || "" });
    const md = result.formatMd ?? `# observe-only\n\n${result.reason}\n`;
    if (out) writeFileSync(`${out}/${f.split("/").pop()}.FORMAT.md`, md);
    console.log(`${f}: ${result.status}${result.iterations ? ` (${result.iterations} gate iterations)` : ""}`);
    if (!result.status.startsWith("verified")) worst = Math.max(worst, 1);
  }
  process.exit(worst);
} else if (cmd === "verify") {
  const [mdPath, ...files] = args.filter((a) => !a.startsWith("--"));
  if (!mdPath || !files.length) die("usage: verify <FORMAT.md> <file...>");
  const md = readFileSync(mdPath, "utf8");
  const m = md.match(/```format-spec\n([\s\S]*?)```/);
  if (!m) die("no format-spec block found", 2);
  let spec;
  try { spec = JSON.parse(m[1]); validateSpec(spec); }
  catch (e) { die(`invalid spec: ${e.message}`, 2); }
  let worst = 0;
  for (const f of files) {
    const r = runGate(spec, readFileSync(f));
    console.log(`${f}: ${r.verdict.status}`);
    if (!r.verdict.status.startsWith("verified")) worst = 1;
  }
  process.exit(worst);
} else if (cmd === "search") {
  die("search: arrives with the V2 knowledge base", 1);
} else if (cmd === "selftest") {
  const { runSelfTest } = await import("../seeds/selftest.js");
  const ok = runSelfTest();
  process.exit(ok ? 0 : 1);
} else {
  console.error(`format-anything ${TOOL_VERSION}\nusage: format-anything analyze|verify|search|selftest`);
  process.exit(2);
}
