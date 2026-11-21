# format-anything — project plan (V1, founded 2026-11-22)

> The RE-wave entry vehicle per the
> [battle plan](https://github.com/vicfei/dsh-gap-radar/blob/main/docs/re-entry-battle-plan-2026-11.md)
> (owner directive 2026-11-22: enter the wave, fight the high-star
> projects head-on). Positioning line: **"Reverse engineer any file format
> — verified by roundtrip."**

## 1. Thesis (all terrain data in the battle plan)

- The generic slot is dead ground (rea 472K★ king + clone swarm); the
  **file-format vertical is verified vacant** — and it has the wave's best
  combo: universal consumer pain (mystery files), TikTok-grade demo hooks
  ("what's inside"), and a uniquely crisp ground truth (byte equality).
- The wave's unsolved problem is **trust**; our answer is the roundtrip
  gate — the factor-auth gate discipline transplanted into RE. "A format
  is only reverse-engineered when it roundtrips."
- Findings become **capital**: verified formats land in a knowledge base
  (WeKnora lineage) with evidence and citations — the wave's outputs are
  ephemeral; ours compound.
- **FORMAT.md** (spec v0 shipped in this very commit —
  [docs/FORMAT.md](FORMAT.md)) is the open-format flag planted before the
  engine exists. VIDEO.md validated the play.
- Kaitai Struct (4.7K★) is the *known*-formats incumbent — complementary;
  `.ksy` interop is a V1.x feature, not a rivalry.

## 2. Product layers

- **V1 — engine + proof**: CLI that takes a sample (plus optional context)
  through observe → hypothesize (agent, any LLM, local-friendly) → draft
  `format-spec` → deterministic codec compile → **roundtrip gate**
  (byte-equal / semantic-equal with tolerance table / fail-with-diagnostics
  feeding agent self-heal — the family guard pattern) → FORMAT.md report.
- **V1.x — interop**: `.ksy` import/export; consume Kaitai's format
  library as priors.
- **V2 — knowledge loop**: fingerprint search (magic + entropy + structure
  hash) over a growing KB; verified specs feed WeKnora-backed knowledge
  base with evidence links; prior-informed analysis (second user with the
  same format gets instant cited answers).
- **V3 — distribution full stack**: agent self-install one-liner · MCP
  server · Claude Code plugin · **dsh-plugin channel** (the wave ships
  none) · bilingual "what's inside" demo series.

## 3. Engine pipeline (V1 scope)

```
sample(s) + context
  → observe      entropy profile · magic · strings · repeat-structure hints · KB fingerprint lookup
  → hypothesize  agent proposes regions/fields/types (cheap — only verified truth ships)
  → draft spec   format-spec JSON (FORMAT.md §1)
  → compile      deterministic codec (TS stdlib; decode+encode from one spec)
  → ROUNDTRIP GATE   decode(sample) → re-encode → compare
                      byte-equal ✓ | semantic-equal (tolerances matched exactly) ✓ | fail → diagnostics → self-heal loop
  → report      FORMAT.md (status stamped honestly) + spec + proof
```

Fail-closed everywhere: unverifiable claims are visibly stamped, never
silently promoted. The verdict scale is the product's honesty contract
(FORMAT.md §2).

## 4. Seed demo formats (V1 acceptance = 3 verified end-to-end)

Selection criteria: **legal-clean** (own data / community-documented /
documented-but-fun — never proprietary-data extraction playbooks),
reproducible (sample in repo or fetchable), wow-factor.

1. **Game Boy Generation-1 save file** (Pokémon) — heavily
   community-documented = ground truth to score the engine against.
2. **Minecraft region file (`.mca`)** — documented, chunked, wow.
3. **A proprietary GPS-logger track format** (own device dump) — the true
   "unknown format" case: no docs exist; only roundtrip can certify.

(V3's Chinese demo series — legacy domestic-app saves, car head-unit
dumps, own-device backups — follows the same legal-clean bar.)

## 5. Milestones

- **S1 ✅ (this commit)**: repo + npm name locked (0.0.1) + FORMAT.md
  spec v0 published (the flag precedes the engine).
- **V1.0**: engine pipeline (hermetic tests per verdict class; seed
  formats 1–3 verified; diagnostics quality bar: every failure message
  teaches) + `format-anything analyze|verify|search` CLI.
- **V1.x**: `.ksy` interop; tolerance-rule library growth
  (checksums/padding/timestamps recompute rules).
- **V2.0**: KB loop (fingerprint search, WeKnora landing, priors).
- **V3.0**: full distribution stack + bilingual demo series + awesome
  channel submission.

## 6. Risks (battle plan + engine-specific)

| risk | counter |
|---|---|
| rea lateral expansion into formats | speed: spec flag already planted; first verified formats are the beachhead |
| clone swarm (1.3K★ clone exists) | moat = roundtrip gate + KB compounding, not the idea |
| formats that resist byte-equality | the verdict scale + tolerances are first-class — honesty IS the differentiator |
| agent hallucination at hypothesize stage | cheap by design: hypotheses are free, only roundtrip-verified truth ships |
| demo legal exposure | hard criteria in §4; no proprietary-data extraction content |

## 7. Family coordination

factor-auth gate lineage (verify-before-trust) · WeKnora fork (V2 KB) ·
dsh-uigen V3 spec habit (FORMAT.md mirrors VIDEO.md lesson) ·
awesome-channel + npm publishing rails · dsh-research internals notes for
the dsh-plugin channel.
