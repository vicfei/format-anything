// Observe (design §6): deterministic recon. This report is the LLM's ONLY
// view of the binary — never the raw file.

import { createHash } from "node:crypto";

const MAGIC = [
  { name: "png", hex: "89504E47" }, { name: "jpeg", hex: "FFD8FF" }, { name: "gzip", hex: "1F8B" },
  { name: "zip", hex: "504B0304" }, { name: "ogg", hex: "4F676753" }, { name: "riff", hex: "52494646" },
  { name: "pdf", hex: "25504446" }, { name: "elf", hex: "7F454C46" }, { name: "sqlite", hex: "53514C69746520" },
  { name: "lz4frame", hex: "04224D18" },
];

function entropy(buf) {
  const counts = new Array(256).fill(0);
  for (const b of buf) counts[b]++;
  let h = 0;
  for (const c of counts) if (c) { const p = c / buf.length; h -= p * Math.log2(p); }
  return h;
}

export function observe(buf, { window = 256 } = {}) {
  const windows = [];
  for (let off = 0; off < buf.length; off += window) {
    const slice = buf.subarray(off, Math.min(off + window, buf.length));
    windows.push({ offset: off, entropy: +entropy(slice).toFixed(2) });
  }
  const boundaries = [];
  for (let i = 1; i < windows.length; i++) {
    if (Math.abs(windows[i].entropy - windows[i - 1].entropy) >= 1.5) boundaries.push(windows[i].offset);
  }
  const strings = [];
  let run = null;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    const printable = c >= 0x20 && c < 0x7f;
    if (printable) { run = run ?? { offset: i, text: "" }; run.text += String.fromCharCode(c); }
    else { if (run && run.text.length >= 4 && run.text.length <= 120) strings.push({ ...run }); run = null; }
  }
  if (run && run.text.length >= 4) strings.push({ ...run });
  const magic = MAGIC.filter((m) => buf.subarray(0, m.hex.length / 2).toString("hex").toUpperCase() === m.hex).map((m) => m.name);
  // zlib streams anywhere in file (78 01/9C/DA header heuristic)
  const zlibCandidates = [];
  for (let i = 0; i < Math.min(buf.length - 2, 1 << 20); i++) {
    if (buf[i] === 0x78 && [0x01, 0x9c, 0xda].includes(buf[i + 1]) && i % 1 === 0) zlibCandidates.push(i);
    if (zlibCandidates.length >= 8) break;
  }
  // fixed-stride repeat hints (16/32/64B autocorrelation, sampled)
  const strides = {};
  for (const s of [16, 32, 64]) {
    let best = 0, bestOff = -1;
    for (let off = 0; off + 2 * s <= Math.min(buf.length, 65536); off += s) {
      let eq = 0;
      for (let k = 0; k < s; k += 4) if (buf[off + k] === buf[off + s + k]) eq++;
      const score = eq / Math.ceil(s / 4);
      if (score > best) { best = score; bestOff = off; }
    }
    strides[s] = { score: +best.toFixed(2), at: bestOff };
  }
  const hexWindow = (o) => buf.subarray(o, Math.min(o + 256, buf.length)).toString("hex").replace(/(..)/g, "$1 ").trim().toUpperCase();
  return {
    size: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
    fingerprint: { head: createHash("sha256").update(buf.subarray(0, 4096)).digest("hex"), entropyVector: windows.map((w) => w.entropy) },
    magic,
    entropy: { overall: +entropy(buf).toFixed(2), windows: windows.slice(0, 64), boundaries },
    strings: strings.slice(0, 64),
    zlibCandidates,
    strideHints: strides,
    hexWindows: { head: hexWindow(0), tail: hexWindow(Math.max(0, buf.length - 256)) },
  };
}
