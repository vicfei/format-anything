# format-anything V1 — design

> Decision-complete design; companion to [plan-v1.md](plan-v1.md) and the
> [FORMAT.md spec v0.1](FORMAT.md). Stack: TypeScript, Node ≥ 22, ESM,
> zero runtime deps for the deterministic core (family rule). Date:
> 2026-11-22.

## 1. Goal / non-goals

**Goal**: the V1 engine — `analyze` a sample to a **roundtrip-verified
FORMAT.md**, with honest verdicts and teach-first diagnostics; three seed
formats verified end-to-end as acceptance.

**Non-goals (V1)**: KB/priors (V2) · `.ksy` interop (V1.x) · encrypted or
compressed-inner formats beyond pluggable codec hints (V1 ships
zlib/gzip/lz4 as evidence tags, decode hooks V1.x) · GUI · cloud
anything. The LLM is only ever the *hypothesizer* — every shipped claim
passes the deterministic gate.

## 2. Module layout

```
src/
  cli.ts          analyze | verify | search(stub) | selftest
  observe.ts      deterministic recon: entropy, magic, strings, repeats, hex windows
  hypothesize.ts  LLM contract (any OpenAI-compatible endpoint), strict draft
                  validation, bounded self-heal loop
  spec/
    types.ts      format-spec v0.1 schema (zod-free hand validation — zero-dep)
    expr.ts       the v0 expression evaluator (tiny, whitelisted)
  codec/
    decode.ts     spec → value tree (+ raw capture of unmodeled spans)
    encode.ts     value tree → bytes (verbatim writeback, recompute rules)
  gate/
    roundtrip.ts  decode→encode→compare pipeline, diff attribution
    verdict.ts    verdict classification (byte/semantic/partial/hypothesis)
    diagnostics.ts per-byte diff → field-attributed, teach-first messages
  report.ts       FORMAT.md writer (auto evidence pointers from decode pass)
  config.ts       env + flags
seeds/            three acceptance formats + generators/fixtures
tests/            hermetic suites
```

## 3. The spec language, pinned (v0.1 executable core)

Field types (closed set): `u8|u16|u32|u64|s8…s64|f32|f64` (each with
optional `le/be` override of document endianness) · `bytes[n]` ·
`zstr` · `str[n]` · `u8[n]`-style fixed arrays · `raw` (explicit unknown
span). Compressed/encrypted regions carry `codec: zlib|gzip|lz4|none`
(V1: recognized in observe + preserved in decode via raw; inner decode
V1.x).

**Expressions** (the only accepted grammar — whitelisted in `expr.ts`):
numeric literals, `$region.field` refs, `$region_len`, `+ - * / %`,
parentheses, comparison ops inside `repeat.until` / `constraint` only.
No loops, no functions, no property access beyond field refs. Anything
else is a validation error — the LLM cannot smuggle code in.

`repeat`: `{"count": "<expr>"}` | `{"until": "<expr>"}` (evaluated per
record; `$this.<field>` refs inside the record). `offset`/`length` of
regions: literal or expr. Evidence pointers are **generated**, never
hand-written (see §7).

## 4. Codec: lossless by construction (the load-bearing insight)

The decoder produces a **value tree that also captures every byte**:

- every field stores its decoded value AND its source span;
- **unmodeled gaps are captured as `raw` spans automatically** (the spec
  needs not cover 100% of the file);
- the encoder writes field values back **verbatim** (it does not
  re-derive representations), emits captured raw spans as-is, and applies
  only the `codec.recompute` rules (declared re-encodings, e.g.
  checksums, length prefixes).

Consequence: **byte-equality is the default outcome for any complete
spec** — timestamps roundtrip because the decoded value is written back;
unknown padding roundtrips because it is captured raw. `semantic-equal`
exists for specs that deliberately abstract (e.g., normalize field
order), not as an excuse. This inverts the usual "RE never reproduces
bytes exactly" expectation and is the product's sharpest demonstrable
claim.

## 5. Roundtrip gate — exact algorithm

```
1. tree  = decode(spec, sample)
2. out   = encode(tree)                      # recompute rules applied
3. diff  = bytewise(sample, out)
4. if diff empty → VERIFIED_BYTE_EQUAL
5. else attribute every differing byte:
     a. inside a `recompute` field        → expected class (proof lists it)
     b. inside a declared `tolerances` field → tolerance-matched
     c. inside a `raw` span               → spec bug (raw must be verbatim) → FAIL
     d. inside a modeled field             → encode/decode bug → FAIL with
                                             field-level diagnostics
6. verdict: all (a) → VERIFIED_SEMANTIC_EQUAL (proof = normalized report:
   every differing byte listed and mapped)
   any (c)/(d) → fail → diagnostics feed hypothesize self-heal
   partial regions → PARTIAL with per-region verdicts
```

Diff diagnostics format (teach-first, family guard pattern):
`offset 0x2F3 (header.checksum): expected 9A got 8B — this field is
declared recompute; if the algorithm guess is wrong, fix the rule, not
the value`.

## 6. Obverse — the observe stage (deterministic recon)

Per sample: size · first/last 256B hex windows · magic scan against a
seeded table · **entropy profile** (256B windows, boundary detection —
the #1 structure hint) · printable-string runs (offset+length) · repeat
structure candidates (fixed-stride record detection via
autocorrelation of 16/32/64B strides) · zlib/gzip/lz4 signature scan ·
fingerprint stub (sha256 of first 4KiB + entropy vector). Output is a
compact JSON observe-report — the LLM's ONLY view of the binary (never
the raw file; context windows and cost both stay sane).

## 7. Hypothesize — the LLM contract

- Input: observe-report + user context + (V2: KB priors) + the spec
  schema description.
- Output: ONE `format-spec` draft JSON (+ free-text reasoning, kept out
  of the pipeline).
- Validation is strict (schema, expression grammar, type set) — invalid
  drafts return repair diagnostics to the model (same shape as gate
  diagnostics). One repair round, then give up honestly: status
  `hypothesis`.
- Endpoint: any OpenAI-compatible chat API — env `FORMAT_LLM_BASE_URL /
  FORMAT_LLM_MODEL / FORMAT_LLM_API_KEY` (the wrenai `WREN_LLM_*`
  convention, family-consistent); `FORMAT_LLM=off` runs observe+report
  only (status hypothesis — the no-LLM path stays useful).
- Evidence pointers: generated automatically by intersecting the decoded
  field spans with the sample (`evidence: {sample, offset, hex}` filled
  by the report writer) — the LLM never fabricates them, because it
  never sees bytes it didn't get from observe.

## 8. Report writer

Emits the FORMAT.md per spec v0.1: front matter (status stamped by the
gate, never by the LLM), prose sections rendered from the spec +
hypothesizer notes, the `format-spec` fence (evidence pointers filled
in), and the roundtrip proof block (verdict, tool version, sample
sha256, out sha256 or normalized-diff report). A document claiming
`verified-*` without this block is spec-invalid — the writer cannot
produce one.

## 9. CLI & config

```
format-anything analyze <files...> [--context "..."] [--out DIR] [--max-iterations 3]
format-anything verify  <FORMAT.md> <files...>     # re-run the proof, reproduce verdict
format-anything search  <file>                     # V2 stub (fingerprint)
format-anything selftest                           # seed corpus + verdict classes
```

Env: `FORMAT_LLM_*` as above; `FORMAT_STRICT=1` (warnings as failures,
CI mode). Exit codes: 0 verified · 1 hypothesis/partial · 2 invalid
input — CI-able like the wrenai check.

## 10. Seeds & test plan

| seed | ground truth source | role |
|---|---|---|
| Minecraft `.mca` | **by construction** — generator synthesizes region files (zlib chunks) we authored | proves the gate end-to-end with zero external truth |
| GB gen-1 save | community disassembly (pret lineage), fixtures encode documented facts | engine-vs-prior-art scoring; real-world quirks (banked duplicate saves, additive checksum) |
| GPS-logger track | none exists — own-device dump | the true unknown: only roundtrip certifies; live validation, recorded |

Hermetic suites: expression evaluator (grammar whitelist, rejects
smuggled code) · codec losslessness (every type, raw-span capture,
verbatim writeback) · verdict classification (synthetic byte/semantic/
fail/partial fixtures) · diagnostics attribution · FORMAT.md writer
conformance (spec §2 invalid-document rules) · hypothesize contract
(fake LLM: valid/invalid/repair paths) · `verify` reproduces `analyze`
verdicts on all seeds. `selftest` runs the corpus; CI gate exits
non-zero on any FAIL (the discipline that never touches a pipe).

## 11. Decisions register

| # | question | ruling | rationale |
|---|---|---|---|
| D1 | codec via codegen or interpreter? | interpreter | simpler, testable, zero-dep; perf is irrelevant at V1 sizes |
| D2 | how is byte-equality normally achievable? | **lossless-by-construction codec** (raw capture + verbatim writeback + recompute rules) | makes `verified-byte-equal` the default, not the miracle — the product's demonstrable edge |
| D3 | expression language | tiny whitelisted grammar (arith + refs + comparisons in guards) | LLM cannot smuggle code; spec stays auditable |
| D4 | LLM sees raw file? | never — observe-report only | cost, context hygiene, and evidence pointers stay honest by construction |
| D5 | encrypted/compressed inners | observe tags + raw preserve in V1; inner decode V1.x | don't block the spine on the long tail |
| D6 | LLM unreachable | `FORMAT_LLM=off` → observe+report, status hypothesis | the no-LLM path stays useful; honest stamp |
| D7 | self-heal bound | 1 repair round for draft validation, 3 gate iterations | bounded cost; failure gives up honestly |
| D8 | .mca ground truth | synthetic generator | ground truth by construction beats borrowed truth for gate tests |

## 12. PR breakdown (issues on approval)

1. **PR1** spec schema + expression evaluator + codec (decode/encode,
   lossless core) + hermetic codec suites — the deterministic foundation
2. **PR2** roundtrip gate + verdict + diagnostics + FORMAT.md writer +
   verdict-class fixtures
3. **PR3** observe + hypothesize contract + self-heal loop + CLI +
   config
4. **PR4** seeds (mca generator, GB fixtures, GPS live run) + `verify`
   reproducibility + `selftest` + CI gate
5. **PR5** docs polish (README run examples with real transcripts) +
   npm 0.1.0 train + awesome submission prep
