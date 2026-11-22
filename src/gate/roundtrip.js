// Roundtrip gate (design §5): decode -> encode -> bytewise diff ->
// 4-class attribution -> verdict. Teach-first diagnostics per cluster.

import { decode } from "../codec/decode.js";
import { encode } from "../codec/encode.js";

export function classify(spec, sample, tree, out, diffs) {
  const toleranceFields = new Set((spec.tolerances || []).map((t) => t.field));
  const recomputeSpans = [];
  for (const r of spec.codec?.recompute || []) {
    const span = tree.spans.find((s) => s.path === r.field) || tree.spans.find((s) => `${s.path}`.startsWith(r.field));
    if (span) recomputeSpans.push({ start: span.start, end: span.end, field: r.field });
  }
  const fieldSpans = tree.spans;
  const attribution = [];
  for (const d of diffs) {
    let cls = null, owner = null;
    for (const rs of recomputeSpans) if (d.off >= rs.start && d.off < rs.end) { cls = "recompute"; owner = rs.field; break; }
    if (!cls) for (const fs of fieldSpans) {
      if (d.off >= fs.start && d.off < fs.end) {
        const region = fs.path.split(".")[0];
        const bare = `${region}.${fs.field.name}`;
        const fieldKey = fs.path;
        if (toleranceFields.has(fieldKey) || toleranceFields.has(bare)) { cls = "tolerance"; owner = fieldKey; }
        else { cls = "modeled"; owner = fieldKey; }
        break;
      }
    }
    if (!cls) { cls = "unmapped"; owner = null; }
    attribution.push({ off: d.off, got: d.got, expected: d.expected, cls, owner });
  }
  return attribution;
}

export function bytewiseDiff(a, b) {
  const diffs = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) diffs.push({ off: i, expected: a[i], got: b[i] });
  }
  return diffs;
}

const HINTS = {
  recompute: "this field is declared recompute — if the diff persists, the rule (algorithm/range/endian) guess is wrong: fix the rule, not the value",
  tolerance: "this field is a declared tolerance — expected to differ; ensure the reason is still accurate",
  modeled: "a modeled field wrote back differently — this is an engine/spec bug, please report it with the sample",
  unmapped: "this byte belongs to no modeled field and no captured raw gap — the decode tree missed it (engine bug)",
};

export function diagnosticsFor(attribution) {
  // cluster consecutive offsets with the same class+owner
  const clusters = [];
  for (const a of attribution) {
    const last = clusters.at(-1);
    if (last && a.cls === last.cls && a.owner === last.owner && a.off === last.end) {
      last.end = a.off + 1; last.items.push(a);
    } else clusters.push({ cls: a.cls, owner: a.owner, start: a.off, end: a.off + 1, items: [a] });
  }
  return clusters.map((c) => ({
    offset: `0x${c.start.toString(16).toUpperCase()}`,
    field: c.owner ?? "(unmapped)",
    class: c.cls,
    expected: hex(c.items.map((i) => i.expected)),
    got: hex(c.items.map((i) => i.got)),
    hint: HINTS[c.cls],
  }));
}

function hex(bytes) { return bytes.map((b) => (b ?? 0).toString(16).padStart(2, "0").toUpperCase()).join(" "); }

export function verdict(spec, sample, tree, out, attribution) {
  const failures = attribution.filter((a) => a.cls === "modeled" || a.cls === "unmapped");
  const okClasses = attribution.filter((a) => a.cls === "recompute" || a.cls === "tolerance");
  if (attribution.length === 0) return { status: "verified-byte-equal", proof: { diffCount: 0 } };
  if (failures.length === 0) {
    return { status: "verified-semantic-equal", proof: { diffCount: attribution.length, normalizedReport: diagnosticsFor(attribution) } };
  }
  return { status: "hypothesis", proof: null, failures: diagnosticsFor(failures), mixed: okClasses.length > 0 };
}

export function runGate(spec, sample) {
  const tree = decode(spec, sample);
  const { bytes: out, recomputes } = encode(spec, sample, tree);
  const diffs = bytewiseDiff(sample, out);
  const attribution = classify(spec, sample, tree, out, diffs);
  const v = verdict(spec, sample, tree, out, attribution);
  return { tree, out, diffs, attribution, verdict: v, recomputes };
}
