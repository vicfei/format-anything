# ROADMAP — format-anything

North star: make file-format reverse engineering **verifiable and
compounding** — every finding roundtrip-proven, every verified format a
citable knowledge asset. The wave returns analysis; we return proof.

## S1 · Charter + the flag ✅ (2026-11-22)
- [x] Repo + npm name locked (`format-anything` 0.0.1)
- [x] **FORMAT.md spec v0** published — open format for format-knowledge
      documents (verdict scale: byte-equal / semantic-equal / partial /
      hypothesis; evidence pointers; tolerances first-class; reproducible
      proofs) — the flag precedes the engine
→ [docs/FORMAT.md](docs/FORMAT.md) · [docs/plan-v1.md](docs/plan-v1.md)

## V1 · Engine + proof (in planning)
- [ ] observe: entropy profile · magic · strings · repeat-structure hints ·
      fingerprint stub
- [ ] hypothesize: agent-driven (any LLM endpoint, local-friendly;
      hypotheses are cheap — only verified truth ships)
- [ ] spec draft + deterministic codec compile (TS stdlib, decode+encode
      from one spec)
- [ ] **roundtrip gate**: verdict classes + tolerance matching + failure
      diagnostics that teach (self-heal loop)
- [ ] FORMAT.md report writer (status stamped honestly)
- [ ] hermetic tests per verdict class; **3 seed formats verified
      end-to-end** (GB gen-1 save w/ community ground truth · Minecraft
      .mca · a no-docs GPS logger track)
- [ ] CLI: `analyze | verify | search`

## V1.x · Interop
- [ ] `.ksy` (Kaitai) import/export; Kaitai format library as priors
- [ ] tolerance-rule library (checksums / padding / timestamps)

## V2 · Knowledge loop
- [ ] fingerprint search (magic + entropy + structure hash)
- [ ] verified specs → knowledge base (WeKnora lineage) with evidence links
- [ ] prior-informed analysis (second user with same format → instant
      cited answer)

## V3 · Distribution full stack
- [ ] agent self-install one-liner · MCP server · Claude Code plugin ·
      **dsh-plugin channel** (the wave ships none)
- [ ] bilingual "what's inside" demo series (legal-clean bar only)

## Discipline
- Verdict scale is the honesty contract — never promote an unverified
  claim; unknown bytes stay unknown.
- Evidence pointers on field claims wherever possible; no invention.
- Legal-clean demo criteria are hard (own data / community-documented /
  documented-but-fun); no proprietary-data extraction content.
