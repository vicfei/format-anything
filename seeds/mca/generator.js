// Seed 1: Minecraft region file (.mca) — ground truth BY CONSTRUCTION
// (design §10): we synthesize region files, so the gate is tested end-to-end
// with zero external truth. Structure per the documented region format:
//   0x0000: 4096B location table (1024 × 4B: 3B sector offset + 1B sector count)
//   0x1000: 4096B timestamp table (1024 × u32be)
//   0x2000: chunk data packed in 4096B sectors: u32be length + u8 compression(2=zlib) + zlib payload

import { deflateSync } from "node:zlib";
import { randomBytes } from "node:crypto";

export const SECTOR = 4096;

export function generateRegion({ chunks = [0, 1, 512, 513, 300] } = {}) {
  const loc = Buffer.alloc(SECTOR);
  const ts = Buffer.alloc(SECTOR);
  const payloads = [];
  let sector = 2;
  for (const idx of chunks) {
    const raw = randomBytes(512 + (idx * 37) % 2048);           // deterministic-ish sizes
    const comp = deflateSync(raw);
    const sectors = Math.ceil((5 + comp.length) / SECTOR);
    loc.writeUIntBE(sector, idx * 4, 3);
    loc.writeUInt8(sectors, idx * 4 + 3);
    ts.writeUInt32BE(1700000000 + idx * 86400, idx * 4);
    payloads.push({ sector, comp });
    sector += sectors;
  }
  const total = sector * SECTOR;
  const body = Buffer.alloc(total);
  loc.copy(body, 0);
  ts.copy(body, SECTOR);
  for (const { sector: s, comp } of payloads) {
    const at = s * SECTOR;
    body.writeUInt32BE(comp.length + 1, at);
    body.writeUInt8(2, at + 4);
    comp.copy(body, at + 5);
  }
  return body;
}

// The spec our engine SHOULD be able to express and roundtrip for this format
// (used by selftest + as the hypothesize mock's target draft).
export const mcaSpec = {
  specVersion: "0.1",
  endianness: "big",
  regions: [
    {
      name: "location_table",
      offset: 0,
      length: 4096,
      repeat: { count: 1024 },
      fields: [
        { name: "sector_offset", type: "u8", count: 3 },
        { name: "sector_count", type: "u8" },
      ].map((f) => (f.name === "sector_offset" ? { name: f.name, type: "bytes", count: 3 } : f)),
    },
    {
      name: "timestamps",
      offset: 4096,
      length: 4096,
      repeat: { count: 1024 },
      fields: [{ name: "stamp", type: "u32" }],
    },
  ],
};
