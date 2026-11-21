# FORMAT.md — open format for file-format knowledge documents

> **Spec v0.1 — the flag before the engine.** A FORMAT.md document is a
> machine-readable, evidence-linked, **roundtrip-verified** description of
> a binary file format. It is to file formats what VIDEO.md is to video
> breakdowns: an open, agent-consumable knowledge artifact any tool can
> read, contribute to, and cite. Comments welcome via issues; stability
> promise: v0 fields will not be renamed, only added.
>
> Why open, why now: the 2026 reverse-engineering wave returns analysis
> that is ephemeral and unverified. FORMAT.md makes format knowledge
> **capital** — durable, cited, and proven. License of each document is
> declared per-document (default CC-BY-4.0 for the document; sample files
> remain their owners').

## 1. Document structure

A FORMAT.md is Markdown for humans **with embedded machine blocks** in
fenced `format-spec` code fences (JSON, schema below).

```markdown
---
format: <slug>                    # e.g. gbpokemon-save-gen1
name: <human name>
versions: [<covered format versions>]
category: <game-save|document|media|database|firmware|sensor|other>
status: verified-byte-equal | verified-semantic-equal | partial | hypothesis
verified: <YYYY-MM-DD or null>
license: CC-BY-4.0
provenance:
  discovered-by: <agent/tool + version>
  samples: [{name, sha256, size, source-note}]   # evidence anchors
references: [<urls to prior art / docs>]
---

## Identity
magic / extensions / MIME / detection hints …

## Layout
Regions described in prose, each tied to spec fields …

## Fields
Per-region field notes, semantics, gotchas …

## Roundtrip proof
Verdict, tool+version, tolerance table applied, hashes …
```

The `format-spec` fence (the executable part):

```json
{
  "specVersion": "0.1",
  "endianness": "little|big|mixed",
  "regions": [
    {
      "name": "header",
      "offset": 0,                       // number or expression string
      "length": 32,                      // number or expression string
      "repeat": null,                    // null | {"until": "<expr>"} | {"count": "<expr>"}
      "fields": [
        {
          "name": "magic",
          "type": "u8[4]",
          "evidence": {"sample": 0, "offset": 0, "hex": "50 4F 4B 45"}
        },
        { "name": "saveCount", "type": "u16", "constraint": "< 3" }
      ]
    }
  ],
  "tolerances": [
    // fields that legitimately differ on re-serialize — the honesty section
    { "field": "header.checksum", "reason": "recomputed on encode" },
    { "field": "trailer.timestamp", "reason": "device clock at save time" }
  ],
  "codec": {
    "recompute": ["header.checksum"],    // encoder recomputes these
    "padding": "zero|preserve|fixed:<hex>"
  }
}
```

## 2. The verdict scale (never fake certainty)

| status | meaning | proof required |
|---|---|---|
| `verified-byte-equal` | decode(sample) → re-encode == sample, byte-for-byte | sha256 in + out equal, tolerance table empty or all-recomputed |
| `verified-semantic-equal` | byte differences are exactly the declared tolerances | normalized-diff report listing every differing byte mapped to a tolerance entry |
| `partial` | some regions roundtrip; others are hypotheses | per-region verdicts |
| `hypothesis` | structure proposal only, no roundtrip attempted/passed | none — MUST be visibly marked; never presented as knowledge |

A document claiming `verified-*` without its proof block is invalid by
spec. Verification is reproducible: the proof names the tool and version,
and the sample sha256 anchors the evidence.

## 3. Rules

1. **Evidence-linked**: every field claim SHOULD carry an evidence pointer
   (sample + offset + observed bytes) — unevidenced claims must say so.
2. **No invention**: unknown bytes are declared unknown (`"type":
   "raw"`), never guessed into meaning.
3. **Tolerances are first-class**: what cannot byte-roundtrip is either a
   declared tolerance (with reason) or downgrades the verdict. There is no
   third option.
4. **Machine-checkable**: a conforming verifier must be able to re-run the
   roundtrip from the spec + a sample and reproduce the verdict.
5. **Provenance is mandatory**: who/what discovered it, when, from which
   samples.

## 4. Relationship to prior art

- **Kaitai Struct** (`.ksy`, 4.7K★): the declarative spec language for
  *known* formats, human-authored. FORMAT.md is the *discovery + proof*
  layer for *unknown* formats; the `format-spec` block is designed for
  `.ksy` import/export (V1.x of our tooling emits both). No conflict —
  Kaitai is a target, not a rival.
- VIDEO.md (rea-video): the open-format-land-grab precedent this spec
  mirrors for the format domain.

## 5. Conformance

A tool is FORMAT.md-conformant if it (a) reads the `format-spec` block,
(b) re-runs the declared roundtrip, and (c) reproduces the stated verdict
on the anchored samples. The reference implementation is
[`format-anything`](https://github.com/vicfei/format-anything).
