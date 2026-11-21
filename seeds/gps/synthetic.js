// Seed 3: GPS-logger-style "true unknown" — synthetic proprietary-looking
// track format (design §10: the no-docs case; only roundtrip certifies).
// Structure WE built in (engine must rediscover it through observe+mock-LLM
// in tests; live device dump remains a follow-up):
//   magic "GPX1" · u16le recordCount · records: u32le ts + s32le lat*1e6 + s32le lon*1e6 + u16le distM
//   · trailing sum16le over the record area

export function generateTrack({ points = 12 } = {}) {
  const head = Buffer.alloc(6);
  head.write("GPX1", 0, "latin1");
  head.writeUInt16LE(points, 4);
  const recs = Buffer.alloc(points * 14);
  for (let i = 0; i < points; i++) {
    const at = i * 14;
    recs.writeUInt32LE(1600000000 + i * 60, at);
    recs.writeInt32LE(31120000 + i * 137, at + 4);
    recs.writeInt32LE(121480000 - i * 53, at + 8);
    recs.writeUInt16LE((i * 37) % 900, at + 12);
  }
  let sum = 0;
  for (const b of recs) sum += b;
  const trail = Buffer.alloc(2);
  trail.writeUInt16LE(sum & 0xffff, 0);
  return Buffer.concat([head, recs, trail]);
}

export const gpsSpec = {
  specVersion: "0.1",
  endianness: "little",
  regions: [
    { name: "header", offset: 0, length: 6, fields: [
      { name: "magic", type: "bytes", count: 4 },
      { name: "record_count", type: "u16" },
    ] },
    { name: "points", offset: 6, length: "$header.record_count * 14", repeat: { count: "$header.record_count" }, fields: [
      { name: "ts", type: "u32" },
      { name: "lat_e6", type: "s32" },
      { name: "lon_e6", type: "s32" },
      { name: "dist_m", type: "u16" },
    ] },
    { name: "trailer", offset: "6 + $header.record_count * 14", length: 2, fields: [{ name: "sum", type: "u16" }] },
  ],
  codec: {
    recompute: [
      { field: "trailer.sum", rule: "sum16le", range: ["6", "6 + $header.record_count * 14"] },
    ],
  },
};
