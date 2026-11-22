// Hermetic suites (design §10). Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert";
import { evaluate, tokenize, ExprError } from "../src/spec/expr.js";
import { validateSpec, SpecError } from "../src/spec/validate.js";
import { decode } from "../src/codec/decode.js";
import { encode } from "../src/codec/encode.js";
import { runGate, bytewiseDiff, diagnosticsFor } from "../src/gate/roundtrip.js";
import { observe } from "../src/observe.js";
import { hypothesize } from "../src/hypothesize.js";
import { writeFormatMd } from "../src/report/writer.js";
import { generateRegion, mcaSpec } from "../seeds/mca/generator.js";
import { generateSave, gb1Spec } from "../seeds/gb1/fixture.js";
import { generateTrack, gpsSpec } from "../seeds/gps/synthetic.js";

// ---- expression evaluator ------------------------------------------------
test("expr: arithmetic and precedence", () => {
  assert.equal(evaluate("2 + 3 * 4"), 14);
  assert.equal(evaluate("(2 + 3) * 4"), 20);
  assert.equal(evaluate("7 % 3"), 1);
  assert.equal(evaluate("-5 + 8"), 3);
});
test("expr: field references resolve", () => {
  const vars = { regions: { hdr: { count: 5 } }, regionLens: { pts: 70 } };
  assert.equal(evaluate("$hdr.count * 14", vars), 70);
  assert.equal(evaluate("$pts_len + 2", vars), 72);
  assert.equal(evaluate("$this.x == 3", { this: { x: 3 } }), true);
});
test("expr: smuggled code is rejected", () => {
  assert.throws(() => evaluate("process.exit(1)"), ExprError);
  assert.throws(() => evaluate("require('fs')"), ExprError);
  assert.throws(() => evaluate("$x; $y"), ExprError);
  assert.throws(() => tokenize("1 2 $$"), ExprError);
});

// ---- spec validation -----------------------------------------------------
const okSpec = { specVersion: "0.1", endianness: "little", regions: [
  { name: "h", offset: 0, length: 4, fields: [{ name: "n", type: "u16" }] },
] };
test("spec: accepts minimal valid spec", () => assert.equal(validateSpec(okSpec), true));
test("spec: rejects unknown type / keys / bad refs", () => {
  assert.throws(() => validateSpec({ ...okSpec, regions: [{ name: "h", offset: 0, length: 1, fields: [{ name: "x", type: "u256" }] }] }), SpecError);
  assert.throws(() => validateSpec({ ...okSpec, bogus: 1 }), SpecError);
  assert.throws(() => validateSpec({ ...okSpec, regions: [{ name: "a", offset: 0, length: 1, fields: [{ name: "x", type: "u8", count: "$later.f" }] }] }), SpecError);
  assert.throws(() => validateSpec({ ...okSpec, tolerances: [{ field: "h.nonexistent", reason: "x" }] }), SpecError);
});

// ---- codec losslessness --------------------------------------------------
test("codec: lossless on mca (raw gap capture + verbatim writeback)", () => {
  const buf = generateRegion();
  const tree = decode(mcaSpec, buf);
  assert.ok(tree.raws.length >= 1, "chunk area captured as raw");
  const { bytes } = encode(mcaSpec, buf, tree);
  assert.deepEqual(bytewiseDiff(buf, bytes), []);
});
test("codec: repeat.until and expression offsets", () => {
  const gps = generateTrack();
  const tree = decode(gpsSpec, gps);
  assert.equal(tree.regions.find((r) => r.name === "points").records.length, 12);
  const vals = tree.values.points.map((p) => p.dist_m);
  assert.equal(vals[0], 0);
  assert.deepEqual(tree.raws, []);
});

// ---- roundtrip gate classes ---------------------------------------------
test("gate: byte-equal when nothing recomputed", () => {
  const r = runGate(mcaSpec, generateRegion());
  assert.equal(r.verdict.status, "verified-byte-equal");
});
test("gate: corrupted sample checksum = semantic-equal with recompute attribution, value restored (gb1)", () => {
  const gb = generateSave();
  const stored = gb[0x352d];
  gb[0x352d] ^= 0xff;                            // corrupt the stored checksum
  const r = runGate(gb1Spec, gb);
  assert.equal(r.verdict.status, "verified-semantic-equal"); // honest: sample ≠ its own rule
  assert.equal(r.out[0x352d], stored);           // engine restored the true sum
});
test("gate: wrong recompute range = semantic-equal with attribution, not silent pass", () => {
  const gps = generateTrack();
  gps.writeUInt16LE(0, gps.length - 2);
  const badSpec = structuredClone(gpsSpec);
  badSpec.codec.recompute[0].range = ["6", "8"];   // wrong range: rule writes wrong sum
  const r = runGate(badSpec, gps);
  assert.equal(r.verdict.status, "verified-semantic-equal");
  assert.ok(r.verdict.proof.normalizedReport.length > 0);
  assert.match(r.verdict.proof.normalizedReport[0].hint, /rule/);
});
test("gate: verbatim losslessness — corrupted bytes roundtrip untouched without a recompute rule", () => {
  const gps = generateTrack();
  gps.writeUInt16LE(0, gps.length - 2);           // no recompute declared → verbatim wins
  const noRecompute = { ...structuredClone(gpsSpec), codec: {} };
  const r = runGate(noRecompute, gps);
  assert.equal(r.verdict.status, "verified-byte-equal"); // lossless-by-construction (design D2)
});
test("gate: decode crash on spec running past EOF is the engine-bug path", () => {
  const gps = generateTrack();
  const bad = structuredClone(gpsSpec);
  bad.regions[2].offset = gps.length + 10;        // trailer past EOF
  assert.throws(() => runGate(bad, gps), /starts past end of file/);
});
test("gate: diagnostics are teach-first", () => {
  const d = diagnosticsFor([{ off: 5, expected: 1, got: 2, cls: "recompute", owner: "trailer.sum" }]);
  assert.equal(d[0].field, "trailer.sum");
  assert.ok(d[0].hint.includes("rule"));
});

// ---- observe -------------------------------------------------------------
test("observe: magic, entropy, strings, fingerprint", () => {
  const gps = generateTrack();
  const rep = observe(gps);
  assert.equal(rep.size, gps.length);
  assert.ok(rep.strings.some((s) => s.text.startsWith("GPX")));
  assert.ok(rep.fingerprint.head.length === 64);
  const png = Buffer.concat([Buffer.from("89504E47", "hex"), Buffer.alloc(64)]);
  assert.equal(observe(png).magic[0], "png");
});

// ---- hypothesize contract ------------------------------------------------
const goodLLM = async () => JSON.stringify({ spec: gpsSpec, notes: "m" });
test("hypothesize: valid draft accepted first round", async () => {
  const rep = observe(generateTrack());
  const r = await hypothesize({ observeReport: rep, callLLM: goodLLM });
  assert.equal(r.ok, true);
  assert.equal(r.rounds, 0);
});
test("hypothesize: invalid draft gets one repair, then honest give-up", async () => {
  const rep = observe(generateTrack());
  let calls = 0;
  const badThenBad = async () => { calls++; return JSON.stringify({ spec: { specVersion: "9.9" } }); };
  const r = await hypothesize({ observeReport: rep, callLLM: badThenBad });
  assert.equal(r.ok, false);
  assert.equal(calls, 2); // 1 initial + 1 repair
});
test("hypothesize: fenced JSON tolerated", async () => {
  const r = await hypothesize({ observeReport: {}, callLLM: async () => "```json\n" + JSON.stringify({ spec: okSpec }) + "\n```" });
  assert.equal(r.ok, true);
});

// ---- report writer -------------------------------------------------------
test("writer: verified doc carries proof block; hypothesis doc cannot claim verified", async () => {
  const gps = generateTrack();
  const result = await (await import("../src/pipeline.js")).analyze({
    sample: gps, sampleName: "track.bin", callLLM: goodLLM,
  });
  assert.equal(result.status, "verified-byte-equal");
  assert.match(result.formatMd, /status: verified-byte-equal/);
  assert.match(result.formatMd, /```format-spec/);
  assert.match(result.formatMd, /sha256/);
  assert.match(result.formatMd, /evidence/);
});
test("writer: failing gate stamps hypothesis honestly", () => {
  const gps = generateTrack();
  const spec = { ...structuredClone(gpsSpec), codec: {} };
  const fabricated = { // verdict a crashing/broken analysis would produce (unit-level fixture)
    verdict: { status: "hypothesis", failures: [{ offset: "0x44", field: "trailer.sum", class: "modeled", expected: "AB", got: "CD", hint: "a modeled field wrote back differently — this is an engine/spec bug, please report it with the sample" }] },
    out: gps,
  };
  const md = writeFormatMd({
    spec, meta: { slug: "t", name: "t" },
    tree: decode(spec, gps), sample: gps,
    gateResult: fabricated, toolVersion: "test",
  });
  assert.match(md, /status: hypothesis/);
  assert.match(md, /NOT verified knowledge/);
});
