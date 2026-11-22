# Live smoke — real-LLM discovery (2026-11-22)

**The end-to-end thesis, executed**: a real LLM (deepseek-chat via the
default FORMAT_LLM_* path) received ONLY the observe report of a
148-byte "unknown" binary (GPS-logger-style synthetic; the model has
never seen it), drafted a format-spec in one round, and the deterministic
gate verified it:

```
$ format-anything analyze track.bin --context "binary track file from a GPS logger; structure unknown"
track.bin: verified-byte-equal (1 gate iterations)      # exit 0
```

- Proof: sample sha256 == re-encoded output sha256
  (`f49d4a6f…b09e6b9`, see the report).
- The full knowledge document produced by the run:
  [gps-track-deepseek.FORMAT.md](gps-track-deepseek.FORMAT.md)
  — evidence pointers auto-filled from decode spans.

Bugs this live run caught (and fixed same day):

1. CLI `--context <value>` was parsed as a positional file (flag parser
   now consumes `--flag value` pairs properly).
2. The LLM naturally referenced `$file_len` — a legitimate derivation the
   grammar lacked. `$file_len` is now first-class in the expression
   grammar (documented in the hypothesizer brief).
3. Provenance line mislabeled live runs as "no LLM" — the pipeline now
   stamps the actual model identity.

Hermetic suites stay 19/19 green after the fixes.
