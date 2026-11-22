// format-spec v0.1 validation — closed type set, expression grammar,
// topology-checked references (design §3). Strict: unknown keys/Types throw.

import { checkRefs, ExprError } from "./expr.js";

export const INT_TYPES = new Set(["u8", "u16", "u32", "u64", "s8", "s16", "s32", "s64"]);
export const FLOAT_TYPES = new Set(["f32", "f64"]);
export const FIELD_TYPES = new Set([...INT_TYPES, ...FLOAT_TYPES, "bytes", "str", "zstr", "raw"]);
export const ENDIANNESS = new Set(["little", "big", "mixed"]);
export const RECOMPUTE_RULES = new Set(["sum8", "sum16le", "sum16be"]);
const CMP_OPS = new Set(["<", "<=", ">", ">=", "==", "!="]);

export class SpecError extends Error {}

function fail(msg) { throw new SpecError(msg); }

function isExprOrNumber(v, what) {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return;
  if (typeof v === "string" && v.length > 0 && v.length < 200) return;
  fail(`${what} must be a non-negative number or a short expression string`);
}

export function validateSpec(spec) {
  if (!spec || typeof spec !== "object") fail("spec must be an object");
  const extra = Object.keys(spec).filter((k) => !["specVersion", "endianness", "regions", "tolerances", "codec"].includes(k));
  if (extra.length) fail(`spec: unknown keys ${extra.join(", ")}`);
  if (spec.specVersion !== "0.1") fail(`specVersion must be "0.1"`);
  if (!ENDIANNESS.has(spec.endianness)) fail(`endianness must be little|big|mixed`);
  if (!Array.isArray(spec.regions) || spec.regions.length === 0) fail("regions must be a non-empty array");

  const regionNames = new Set();
  const fieldsOf = (name) => {
    const r = spec.regions.find((x) => x.name === name);
    return r ? r.fields.map((f) => f.name) : [];
  };

  spec.regions.forEach((region, ri) => {
    const what = `regions[${ri}]`;
    const rk = Object.keys(region).filter((k) => !["name", "offset", "length", "repeat", "fields"].includes(k));
    if (rk.length) fail(`${what}: unknown keys ${rk.join(", ")}`);
    if (typeof region.name !== "string" || !/^[a-z][A-Za-z0-9_]*$/.test(region.name)) fail(`${what}.name must be snake_case`);
    if (regionNames.has(region.name)) fail(`${what}.name duplicate`);
    regionNames.add(region.name);
    isExprOrNumber(region.offset, `${what}.offset`);
    isExprOrNumber(region.length, `${what}.length`);
    if (region.repeat !== undefined && region.repeat !== null) {
      const rp = region.repeat;
      const keys = Object.keys(rp);
      if (!(keys.length === 1 && (keys[0] === "count" || keys[0] === "until"))) fail(`${what}.repeat must be {count|until}`);
      isExprOrNumber(rp.count ?? rp.until, `${what}.repeat.${keys[0]}`);
    }
    if (!Array.isArray(region.fields) || region.fields.length === 0) fail(`${what}.fields must be non-empty`);
    region.fields.forEach((f, fi) => {
      const fwhat = `${what}.fields[${fi}]`;
      const allowed = ["name", "type", "le", "be", "count", "constraint", "codec"];
      const fk = Object.keys(f).filter((k) => !allowed.includes(k));
      if (fk.length) fail(`${fwhat}: unknown keys ${fk.join(", ")}`);
      if (typeof f.name !== "string" || !/^[a-z][A-Za-z0-9_]*$/.test(f.name)) fail(`${fwhat}.name must be snake_case`);
      if (!FIELD_TYPES.has(f.type)) fail(`${fwhat}.type ${JSON.stringify(f.type)} not in closed set`);
      if (f.le && f.be) fail(`${fwhat}: le and be are exclusive`);
      if (f.le !== undefined && f.le !== true) fail(`${fwhat}.le must be true`);
      if (f.be !== undefined && f.be !== true) fail(`${fwhat}.be must be true`);
      if (f.type === "bytes" || f.type === "str") {
        isExprOrNumber(f.count, `${fwhat}.count (required for ${f.type})`);
        if (f.count === undefined) fail(`${fwhat}: ${f.type} requires count`);
      }
      if (f.constraint !== undefined) {
        if (typeof f.constraint !== "string") fail(`${fwhat}.constraint must be a string`);
        const m = f.constraint.match(/^\s*([\w$.\[\]]+)\s*(<=|>=|<|>|==|!=)\s*([^ ]+)\s*$/);
        if (!m) fail(`${fwhat}.constraint must be "<fieldref> <op> <number>"`);
      }
    });
  });

  // reference topology: regions see earlier regions + themselves
  const seen = [];
  for (const region of spec.regions) {
    const exprs = [
      typeof region.offset === "string" ? region.offset : null,
      typeof region.length === "string" ? region.length : null,
      region.repeat?.count, region.repeat?.until,
      ...region.fields.map((f) => (typeof f.count === "string" ? f.count : null)),
    ].filter(Boolean);
    for (const e of exprs) {
      try { checkRefs(e, [...seen, region.name], region.name, fieldsOf); }
      catch (err) { if (err instanceof ExprError) fail(`spec: region ${region.name}: ${err.message}`); throw err; }
    }
    seen.push(region.name);
  }

  // tolerances + codec
  const allFields = new Set(spec.regions.flatMap((r) => r.fields.map((f) => `${r.name}.${f.name}`)));
  if (spec.tolerances !== undefined) {
    if (!Array.isArray(spec.tolerances)) fail("tolerances must be an array");
    for (const t of spec.tolerances) {
      if (!t || typeof t.field !== "string" || typeof t.reason !== "string") fail("tolerances entries need {field, reason}");
      if (!allFields.has(t.field)) fail(`tolerances: unknown field ${t.field}`);
    }
  }
  if (spec.codec !== undefined) {
    const ck = Object.keys(spec.codec).filter((k) => !["recompute", "padding"].includes(k));
    if (ck.length) fail(`codec: unknown keys ${ck.join(", ")}`);
    for (const r of spec.codec.recompute || []) {
      if (!r || !allFields.has(r.field)) fail(`codec.recompute: unknown field ${r?.field}`);
      if (!RECOMPUTE_RULES.has(r.rule)) fail(`codec.recompute: rule must be one of ${[...RECOMPUTE_RULES]}`);
      if (!Array.isArray(r.range) || r.range.length !== 2) fail(`codec.recompute ${r.field}: range must be [from, to) expressions`);
      for (const e of r.range) isExprOrNumber(e, `codec.recompute ${r.field} range bound`);
    }
  }
  return true;
}
