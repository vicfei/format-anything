// FORMAT.md writer (design §8): status stamped by the gate, never by the
// LLM; evidence pointers auto-filled from decode spans; a verified-* claim
// without a proof block is impossible to produce here by construction.

import { createHash } from "node:crypto";

function fieldHex(buf, start, end) {
  const slice = buf.subarray(start, Math.min(end, start + 16));
  return slice.toString("hex").replace(/(..)/g, "$1 ").trim().toUpperCase();
}

function evidencePointers(tree, buf, sampleIndex = 0) {
  return tree.spans.slice(0, 24).map((s) => ({
    sample: sampleIndex, offset: s.start, hex: fieldHex(buf, s.start, s.end), field: s.path,
  }));
}

export function writeFormatMd({ spec, meta, tree, sample, gateResult, toolVersion }) {
  const sha = (b) => createHash("sha256").update(b).digest("hex");
  const v = gateResult.verdict;
  const lines = [];
  lines.push("---");
  lines.push(`format: ${meta.slug}`);
  lines.push(`name: ${meta.name}`);
  lines.push(`versions: [${(meta.versions || []).join(", ")}]`);
  lines.push(`category: ${meta.category || "other"}`);
  lines.push(`status: ${v.status}`);
  lines.push(`verified: ${v.status.startsWith("verified") ? new Date().toISOString().slice(0, 10) : "null"}`);
  lines.push("license: CC-BY-4.0");
  lines.push("provenance:");
  lines.push(`  discovered-by: format-anything ${toolVersion}${meta.llm ? ` + ${meta.llm}` : " (no LLM)"}`);
  lines.push(`  samples: [{name: ${JSON.stringify(meta.sampleName || "sample.bin")}, sha256: ${sha(sample)}, size: ${sample.length}}]`);
  if (meta.references?.length) lines.push(`references: [${meta.references.map((r) => JSON.stringify(r)).join(", ")}]`);
  lines.push("---", "");
  lines.push("## Identity", "");
  lines.push(meta.identity || "(see spec regions)", "");
  lines.push("## Layout", "");
  for (const r of tree.regions) {
    lines.push(`- \`${r.name}\`: 0x${r.start.toString(16)}–0x${r.end.toString(16)} (${r.records.length} record${r.records.length > 1 ? "s" : ""})`);
  }
  lines.push("");
  lines.push("## Fields", "");
  for (const r of tree.regions) for (const rec of r.records) for (const f of rec.fields) {
    const val = typeof f.value === "bigint" ? f.value.toString() : f.value;
    const shown = typeof val === "string" && val.length > 40 ? val.slice(0, 40) + "…" : val;
    lines.push(`- \`${f.path}\` (${f.field ?? ""}) = ${JSON.stringify(shown)}`);
  }
  lines.push("");
  if (tree.raws.length) {
    lines.push(`Unmodeled gaps preserved as raw spans: ${tree.raws.map((g) => `0x${g.start.toString(16)}–0x${g.end.toString(16)}`).join(", ")}`, "");
  }
  lines.push("## Roundtrip proof", "");
  if (v.status === "verified-byte-equal") {
    lines.push(`- verdict: **verified-byte-equal** — decode→re-encode reproduces the sample byte-for-byte`);
    lines.push(`- tool: format-anything ${toolVersion}`);
    lines.push(`- sample sha256: ${sha(sample)} · output sha256: ${sha(gateResult.out)}`);
  } else if (v.status === "verified-semantic-equal") {
    lines.push(`- verdict: **verified-semantic-equal** — every differing byte maps to a declared recompute/tolerance:`);
    lines.push(`- tool: format-anything ${toolVersion} · diff bytes: ${v.proof.diffCount}`);
    lines.push("```");
    for (const d of v.proof.normalizedReport) lines.push(`  ${d.offset} ${d.field} [${d.class}] expected ${d.expected} got ${d.got} — ${d.hint}`);
    lines.push("```");
  } else {
    lines.push(`- verdict: **${v.status}** — roundtrip FAILED; findings below are structure proposals, NOT verified knowledge.`);
    for (const d of v.failures || []) lines.push(`  - ${d.offset} ${d.field} [${d.class}]: ${d.hint}`);
  }
  lines.push("");
  lines.push("## Executable spec (format-spec v0.1)", "");
  lines.push("```format-spec");
  lines.push(JSON.stringify(withEvidence(spec, tree, sample), null, 2));
  lines.push("```");
  return lines.join("\n") + "\n";
}

function withEvidence(spec, tree, buf) {
  const out = structuredClone(spec);
  const ptrs = evidencePointers(tree, buf);
  let i = 0;
  for (const region of out.regions) for (const f of region.fields) {
    if (ptrs[i]) f.evidence = { sample: ptrs[i].sample, offset: ptrs[i].offset, hex: ptrs[i].hex };
    i++;
  }
  return out;
}
