// Hypothesize (design §7): the LLM contract. Sees ONLY the observe report;
// strict validation; one repair round; honest give-up. Injectable callLLM
// for hermetic tests.

import { validateSpec, SpecError } from "./spec/validate.js";
import { evaluate, ExprError } from "./spec/expr.js";

const SCHEMA_BRIEF = `You draft a "format-spec" JSON v0.1 describing the binary structure.
Rules:
- top-level keys exactly: specVersion:"0.1", endianness:"little"|"big"|"mixed", regions:[], tolerances?:[], codec?:{recompute?:[], padding?}
- region keys: name(snake_case), offset(number|expr), length(number|expr), repeat?:{count|until}, fields:[]
- field types (closed set): u8 u16 u32 u64 s8 s16 s32 s64 f32 f64 bytes str zstr raw
- "bytes"/"str" need count; expressions may reference earlier regions as $region.field, $region_len, and the whole file as $file_len; ops + - * / % and comparisons; NOTHING else
- codec.recompute entries: {field:"region.field", rule:"sum8"|"sum16le"|"sum16be", range:[fromExpr, toExpr)}
- tolerances: {field:"region.field", reason:"..."} for bytes that legitimately differ on re-encode
- model ONLY what the evidence supports; leave the rest to raw gaps (captured automatically)
Respond with JSON: {"spec": {...}, "notes": "..."}`;

export async function hypothesize({ observeReport, context = "", callLLM = defaultCallLLM, maxRepairRounds = 1 }) {
  const user = `Observe report:\n${JSON.stringify(observeReport)}\n\nUser context: ${context || "(none)"}\n\n${SCHEMA_BRIEF}`;
  let lastError = null;
  let draft = null;
  for (let round = 0; round <= maxRepairRounds; round++) {
    const prompt = round === 0 ? user : `${user}\n\nYour previous draft was rejected:\n${lastError}\nReturn a corrected JSON.`;
    const raw = await callLLM(prompt);
    draft = parseDraft(raw);
    if (!draft.ok) { lastError = draft.error; continue; }
    const check = validateDraft(draft.spec);
    if (check.ok) return { ok: true, spec: draft.spec, notes: draft.notes, rounds: round };
    lastError = check.error;
  }
  return { ok: false, error: lastError, rounds: maxRepairRounds + 1 };
}

function parseDraft(raw) {
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== "object") return { ok: false, error: "draft is not an object" };
    if (!obj.spec) return { ok: false, error: "draft missing .spec" };
    return { ok: true, spec: obj.spec, notes: obj.notes ?? "" };
  } catch (e) {
    // tolerate ```json fences from chatty models
    const m = typeof raw === "string" ? raw.match(/```(?:json)?\s*([\s\S]*?)```/) : null;
    if (m) return parseDraft(m[1]);
    return { ok: false, error: `not valid JSON: ${e.message}` };
  }
}

function validateDraft(spec) {
  try {
    validateSpec(spec);
    return { ok: true };
  } catch (e) {
    if (e instanceof SpecError) return { ok: false, error: e.message };
    return { ok: false, error: `validation crashed: ${e.message}` };
  }
}

async function defaultCallLLM(prompt) {
  const base = (process.env.FORMAT_LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.FORMAT_LLM_MODEL || "deepseek-chat";
  const key = process.env.FORMAT_LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("no FORMAT_LLM_API_KEY (or FORMAT_LLM=off for the no-LLM path)");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

export function llmEnabled() {
  return process.env.FORMAT_LLM !== "off";
}
