// Seed 2: GB gen-1-style save — synthetic fixture following the
// community-documented structure (design §10): 32 KiB, duplicated 0x2000
// banks, additive checksum byte over a declared range. Synthetic = we own
// the bytes; structure facts mirror the documented format (pret lineage).

import { createHash } from "node:crypto";

export const CHECKSUM_AT = 0x352d;
export const CHECK_FROM = 0x2598;
export const CHECK_TO = 0x352c;

export function generateSave({ seed = 0x42 } = {}) {
  const buf = Buffer.alloc(0x8000);
  // deterministic filler with structure: trainer name + pseudo-random-ish body
  buf.write("ASH", 0x2598 + 0x10, "latin1");
  let x = seed;
  for (let i = CHECK_FROM; i <= CHECK_TO; i++) {
    if (buf[i] === 0) { x = (x * 1103515245 + 12345) & 0xff; buf[i] = x; }
  }
  buf[0x2598 + 0x10] = 0x41; buf[0x2599 + 0x10] = 0x53; buf[0x259a + 0x10] = 0x48; buf[0x259b + 0x10] = 0x00; // "ASH\0" zstr-ish
  // duplicate bank copy (documented redundancy)
  buf.copy(buf, 0x2000, 0, 0x2000);
  // checksum LAST, over the declared range, bank 2 semantics simplified to single range
  let sum = 0;
  for (let i = CHECK_FROM; i <= CHECK_TO; i++) sum += buf[i];
  buf[CHECKSUM_AT] = sum & 0xff;
  return buf;
}

export const gb1Spec = {
  specVersion: "0.1",
  endianness: "big",
  regions: [
    { name: "bank1", offset: 0, length: 0x2000, fields: [{ name: "data", type: "bytes", count: 0x2000 }] },
    { name: "bank2_pre", offset: 0x2000, length: 0x598, fields: [{ name: "data", type: "bytes", count: 0x598 }] },
    { name: "trainer", offset: 0x2598, length: 16, fields: [{ name: "name", type: "zstr" }] },
    { name: "body", offset: 0x259c, length: 0x352d - 0x259c, fields: [{ name: "data", type: "bytes", count: 0x352d - 0x259c }] },
    { name: "checksum", offset: 0x352d, length: 1, fields: [{ name: "sum", type: "u8" }] },
    { name: "tail", offset: 0x352e, length: 0x8000 - 0x352e, fields: [{ name: "data", type: "bytes", count: 0x8000 - 0x352e }] },
  ],
  codec: {
    recompute: [
      { field: "checksum.sum", rule: "sum8", range: [CHECK_FROM, CHECK_TO + 1] },
    ],
  },
};
