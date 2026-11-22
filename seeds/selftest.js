// Selftest: the seed corpus (design §10). All three seeds must roundtrip
// to their expected verdict through the REAL gate. GPS additionally runs
// the full pipeline with a mock hypothesizer (the true-unknown path).

import { generateRegion, mcaSpec } from "./mca/generator.js";
import { generateSave, gb1Spec } from "./gb1/fixture.js";
import { generateTrack, gpsSpec } from "./gps/synthetic.js";
import { runGate } from "../src/gate/roundtrip.js";
import { analyze } from "../src/pipeline.js";

export async function runSelfTest({ log = console.log } = {}) {
  let ok = true;
  const check = (name, cond, detail = "") => {
    log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
    if (!cond) ok = false;
  };

  // 1. .mca — spec with header tables; chunk area = captured raw gaps; byte-equal
  const mca = generateRegion();
  const mcaGate = runGate(mcaSpec, mca);
  check("mca roundtrip", mcaGate.verdict.status === "verified-byte-equal", mcaGate.verdict.status);

  // 2. GB gen-1 style — sum8 recompute: corrupted stored checksum → semantic-equal + restored
  const gb = generateSave();
  const trueSum = gb[0x352d];
  gb[0x352d] ^= 0xff;                       // corrupt the stored value
  const gbGate = runGate(gb1Spec, gb);
  check("gb1 recompute roundtrip", gbGate.verdict.status === "verified-semantic-equal", gbGate.verdict.status);
  check("gb1 checksum restored", gbGate.out[0x352d] === trueSum);

  // 3. GPS "true unknown" — spec uses expr-driven repeat + sum16le recompute
  const gps = generateTrack();
  const trueTrailer = gps.readUInt16LE(gps.length - 2);
  gps.writeUInt16LE(0, gps.length - 2);     // corrupt trailer sum
  const gpsGate = runGate(gpsSpec, gps);
  check("gps recompute roundtrip", gpsGate.verdict.status === "verified-semantic-equal", gpsGate.verdict.status);
  check("gps trailer restored", gpsGate.out.readUInt16LE(gps.length - 2) === trueTrailer);

  // 4. full pipeline on GPS with a mock hypothesizer that rediscovers the spec
  //    (hermetic stand-in for the live device run: observe real, LLM mocked)
  const gps2 = generateTrack({ points: 7 });
  const result = await analyze({ sample: gps2, sampleName: "track.bin", context: "GPS logger track", callLLM: async () => JSON.stringify({ spec: gpsSpec, notes: "mock" }) });
  check("gps pipeline (mock LLM)", result.status === "verified-byte-equal", `${result.status} in ${result.iterations} iterations`);

  return ok;
}
