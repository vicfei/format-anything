// The analyze pipeline (design §3): observe -> hypothesize (bounded
// self-heal through the gate) -> report. Status is stamped by the gate only.

import { observe } from "./observe.js";
import { hypothesize, llmEnabled } from "./hypothesize.js";
import { runGate } from "./gate/roundtrip.js";
import { writeFormatMd } from "./report/writer.js";

export const TOOL_VERSION = "0.1.0";

export async function analyze({ sample, sampleName = "sample.bin", context = "", callLLM, maxGateIterations = 3, meta = {} }) {
  const observeReport = observe(sample);
  if (!llmEnabled() && !callLLM) {
    return { status: "hypothesis", observeReport, formatMd: null, reason: "FORMAT_LLM=off — observe-only run" };
  }
  let hyp = await hypothesize({ observeReport, context, callLLM });
  if (!hyp.ok) return { status: "hypothesis", observeReport, formatMd: null, reason: `hypothesize failed: ${hyp.error}` };

  let spec = hyp.spec;
  let gate = null;
  let iterations = 0;
  for (; iterations < maxGateIterations; iterations++) {
    try { gate = runGate(spec, sample); }
    catch (e) { // decode crash = spec bug: one repair chance per crash, else honest give-up
      hyp = await hypothesize({ observeReport, context: `${context}\nPrevious draft crashed during decode: ${e.message}`, callLLM });
      if (!hyp.ok) return { status: "hypothesis", observeReport, formatMd: null, reason: `decode crash: ${e.message}` };
      spec = hyp.spec;
      continue;
    }
    if (gate.verdict.status.startsWith("verified")) break;
    if (iterations === maxGateIterations - 1) break;
    // gate diagnostics feed the next draft (self-heal loop)
    hyp = await hypothesize({
      observeReport,
      context: `${context}\nRoundtrip failed:\n${JSON.stringify(gate.verdict.failures?.slice(0, 8) ?? [])}\nRevise the spec.`,
      callLLM,
    });
    if (!hyp.ok) break;
    spec = hyp.spec;
  }

  const formatMd = writeFormatMd({
    spec, meta: { slug: meta.slug || sampleName.replace(/\W+/g, "-"), name: meta.name || sampleName, category: meta.category, versions: meta.versions, sampleName, references: meta.references },
    tree: gate.tree, sample, gateResult: gate, toolVersion: TOOL_VERSION,
  });
  return { status: gate.verdict.status, gate, formatMd, observeReport, iterations: iterations + 1, spec };
}
