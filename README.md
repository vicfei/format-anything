# format-anything — reverse engineer any file format, verified by roundtrip

Every "what's inside this file?" tool returns analysis you have to trust.
**format-anything returns a parser you can prove**: an agent studies your
sample, drafts an executable schema, and the engine runs the only ground
truth that matters — **decode the sample, re-encode it, compare
byte-for-byte**. What roundtrips is `verified-byte-equal` knowledge; what
almost does declares its exact tolerances; what doesn't is visibly stamped
`hypothesis` and never dressed up as fact.

**A format is only reverse-engineered when it roundtrips.**

- 📐 **FORMAT.md** — the open format for file-format knowledge documents
  (spec v0, planted before the engine):
  [docs/FORMAT.md](docs/FORMAT.md)
- 🗺️ Project plan (entry vehicle of the 2026 reverse-engineering wave,
  differentiated by verification): [docs/plan-v1.md](docs/plan-v1.md)
- 🧭 Decision-complete design (lossless-by-construction codec, roundtrip
  gate algorithm, LLM contract): [docs/design-v1.md](docs/design-v1.md)

English | [简体中文](README.zh-CN.md)

## Pipeline

```
sample + context → observe → hypothesize (any LLM, local-friendly)
  → draft spec → compile codec → ROUNDTRIP GATE → FORMAT.md report
                                    ├─ byte-equal   → verified knowledge
                                    ├─ tolerances   → semantic-equal, declared exactly
                                    └─ mismatch     → diagnostics → agent self-heals
```

## Status

S1 complete (charter + FORMAT.md spec v0 + name lock). V1 engine in
planning — see [ROADMAP.md](ROADMAP.md).

Complementary to [Kaitai Struct](https://github.com/kaitai-io/kaitai_struct)
(known formats, human-authored) — we discover unknown ones and prove them;
`.ksy` interop planned. Inspired by the wave (rea / craft-anything /
rea-video) and standing on the roundtrip discipline of the
[factor-auth](https://github.com/vicfei/dsh-factor-auth) lineage. MIT.
