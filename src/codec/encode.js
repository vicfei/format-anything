// Lossless encoder (design §4): verbatim writeback of field spans + raw
// gap spans; only declared recompute rules re-derive bytes. Byte-equality
// is the expected outcome for a complete spec — deviations are exactly the
// recompute/tolerance classes the gate attributes.

import { evaluate } from "../spec/expr.js";

function applyRule(rule, buf, out, ctx) {
  const from = typeof rule.range[0] === "number" ? rule.range[0] : evaluate(rule.range[0], ctx);
  const to = typeof rule.range[1] === "number" ? rule.range[1] : evaluate(rule.range[1], ctx);
  let sum = 0;
  for (let i = from; i < to; i++) sum += out[i];
  if (rule.rule === "sum8") return sum & 0xff;
  if (rule.rule === "sum16le") return sum & 0xffff;
  return sum & 0xffff; // sum16be — width same, endianness handled by caller
}

export function encode(spec, buf, tree) {
  const out = Buffer.alloc(buf.length);
  buf.copy(out); // verbatim baseline: span bytes + raw gaps are already correct

  const ctx = { regions: tree.values, regionLens: Object.fromEntries(tree.regions.map((r) => [r.name, r.end - r.start])) };
  const recomputes = [];
  for (const r of spec.codec?.recompute || []) {
    const span = findSpan(tree, r.field);
    if (!span) throw new Error(`encode: recompute field ${r.field} not found in tree`);
    const value = applyRule(r, buf, out, ctx);
    const little = r.rule.endsWith("le");
    if (r.rule === "sum8") out.writeUInt8(value, span.start);
    else little ? out.writeUInt16LE(value, span.start) : out.writeUInt16BE(value, span.start);
    recomputes.push({ field: r.field, start: span.start, end: span.end });
  }
  return { bytes: out, recomputes };
}

export function findSpan(tree, path) {
  for (const r of tree.regions) for (const rec of r.records) for (const f of rec.fields)
    if (f.path === path || `${r.name}.${f.name}` === path) return { start: f.start, end: f.end };
  return null;
}
