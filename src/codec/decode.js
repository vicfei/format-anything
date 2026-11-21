// Lossless decoder (design §4): every field records its span AND value;
// after decoding all regions, unmodeled gaps are captured as raw spans so
// the encoder can reproduce the file byte-for-byte.

import { evaluate } from "../spec/expr.js";

const DV = { u8: (dv) => dv.getUint8(0), s8: (dv) => dv.getInt8(0) };

function readField(buf, off, field, endian) {
  const little = field.le ? true : field.be ? false : endian !== "big";
  const n = (c) => (typeof c === "number" ? c : c);
  switch (field.type) {
    case "u8": return { size: 1, value: buf.readUInt8(off) };
    case "s8": return { size: 1, value: buf.readInt8(off) };
    case "u16": return { size: 2, value: little ? buf.readUInt16LE(off) : buf.readUInt16BE(off) };
    case "s16": return { size: 2, value: little ? buf.readInt16LE(off) : buf.readInt16BE(off) };
    case "u32": return { size: 4, value: little ? buf.readUInt32LE(off) : buf.readUInt32BE(off) };
    case "s32": return { size: 4, value: little ? buf.readInt32LE(off) : buf.readInt32BE(off) };
    case "u64": case "s64": {
      const v = little ? buf.readBigUInt64LE(off) : buf.readBigUInt64BE(off);
      return { size: 8, value: v };
    }
    case "f32": return { size: 4, value: little ? buf.readFloatLE(off) : buf.readFloatBE(off) };
    case "f64": return { size: 8, value: little ? buf.readDoubleLE(off) : buf.readDoubleLE(off) };
    case "bytes": {
      const size = n(field._countVal);
      return { size, value: buf.subarray(off, off + size).toString("hex") };
    }
    case "str": {
      const size = n(field._countVal);
      return { size, value: buf.toString("latin1", off, off + size) };
    }
    case "zstr": {
      let end = off;
      while (end < buf.length && buf[end] !== 0) end++;
      return { size: end - off + 1, value: buf.toString("latin1", off, end) };
    }
    case "raw": {
      const size = n(field._countVal ?? field._lenVal ?? 0);
      return { size, value: buf.subarray(off, off + size).toString("hex") };
    }
    default: throw new Error(`decode: unhandled type ${field.type}`);
  }
}

export function decode(spec, buf) {
  const regionsOut = [];
  const regionValues = {};   // $region.field -> value
  const regionLens = {};     // $region_len
  const spans = [];          // all modeled spans {start, end, path}

  for (const region of spec.regions) {
    const baseExprCtx = { regions: regionValues, regionLens };
    let offset = typeof region.offset === "number" ? region.offset : evaluate(region.offset, baseExprCtx);
    if (offset > buf.length) throw new Error(`decode: region ${region.name} starts past end of file (offset ${offset} > ${buf.length})`);
    const length = typeof region.length === "number" ? region.length : evaluate(region.length, baseExprCtx);
    let repeats = 1;
    if (region.repeat?.count !== undefined) {
      repeats = typeof region.repeat.count === "number" ? region.repeat.count : evaluate(region.repeat.count, baseExprCtx);
    }
    const records = [];
    for (let i = 0; i < repeats; i++) {
      const fields = [];
      const thisValues = {};
      for (const f0 of region.fields) {
        const ctx = { regions: regionValues, regionLens, this: thisValues };
        // never mutate the input spec — compute per-record field view locally
        const f = { ...f0 };
        if (f.count !== undefined) f._countVal = typeof f.count === "number" ? f.count : evaluate(f.count, ctx);
        if (f.type === "raw") f._lenVal = length;
        const { size, value } = readField(buf, offset, f, spec.endianness);
        const path = `${region.name}${repeats > 1 ? `[${i}]` : ""}.${f.name}`;
        fields.push({ name: f.name, path, start: offset, end: offset + size, value });
        spans.push({ start: offset, end: offset + size, path, field: f0 });
        thisValues[f.name] = value;
        offset += size;
        if (offset > buf.length) throw new Error(`decode: region ${region.name} runs past end of file at ${path}`);
      }
      records.push({ fields, values: thisValues });
      // repeat.until guard evaluated with this record's values
      if (region.repeat?.until !== undefined) {
        const stop = evaluate(region.repeat.until, { regions: regionValues, regionLens, this: thisValues });
        if (stop) break;
      }
    }
    // store values (single-record regions expose fields directly; repeated expose arrays)
    if (repeats === 1) {
      regionValues[region.name] = records[0].values;
    } else {
      regionValues[region.name] = records.map((r) => r.values);
    }
    const regionEnd = records.length ? records[records.length - 1].fields.at(-1).end : offset;
    regionLens[region.name] = regionEnd - (typeof region.offset === "number" ? region.offset : evaluate(region.offset, baseExprCtx));
    regionsOut.push({ name: region.name, start: typeof region.offset === "number" ? region.offset : evaluate(region.offset, baseExprCtx), end: regionEnd, records });
  }

  // capture unmodeled gaps as raw spans (lossless-by-construction, design §4)
  spans.sort((a, b) => a.start - b.start);
  const raws = [];
  let cursor = 0;
  for (const s of spans) {
    if (s.start > cursor) raws.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < buf.length) raws.push({ start: cursor, end: buf.length });

  return { regions: regionsOut, raws, spans, values: regionValues, size: buf.length };
}

export function spanOfField(tree, path) {
  for (const r of tree.regions) for (const rec of r.records) for (const f of rec.fields)
    if (f.path === path) return { start: f.start, end: f.end, value: f.value };
  return null;
}

export { DV };
