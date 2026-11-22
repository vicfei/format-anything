// Expression evaluator — the v0 whitelisted grammar (design §3).
// Numbers, $region.field / $region_len / $this.field references,
// + - * / % and parens; comparisons return booleans (guard contexts only).
// Anything outside the grammar throws ExprError — the LLM cannot smuggle code.

export class ExprError extends Error {}

const TOKEN = /\s*(\d+(?:\.\d+)?|\$[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?|[()+\-*/%]|[=!<>]=|[<>])/y;

export function tokenize(src) {
  const tokens = [];
  let i = 0;
  TOKEN.lastIndex = 0;
  while (i < src.length) {
    TOKEN.lastIndex = i;
    const m = TOKEN.exec(src);
    if (!m || m[0].trim() === "" && m[0].length === 0) {
      if (src[i] === undefined) break;
      throw new ExprError(`expr: illegal character ${JSON.stringify(src[i])} at ${i} in ${JSON.stringify(src)}`);
    }
    if (m[0].trim() !== "") tokens.push(m[0].trim());
    i = TOKEN.lastIndex;
    if (TOKEN.lastIndex === m.index) throw new ExprError(`expr: no progress at ${i}`);
  }
  return tokens;
}

// recursive-descent: cmp -> add (op add)? ; add -> mul ((+|-) mul)* ; mul -> unary ((*|/|%) unary)*
export function evaluate(src, vars = {}) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function resolve(tok) {
    if (!tok.startsWith("$")) return Number(tok);
    const path = tok.slice(1);
    if (path.includes(".")) {
      const [region, field] = path.split(".");
      if (region === "this") {
        if (!(field in (vars.this || {}))) throw new ExprError(`expr: unknown $this.${field}`);
        return vars.this[field];
      }
      const r = (vars.regions || {})[region];
      if (!r || !(field in r)) throw new ExprError(`expr: unknown $${path}`);
      return r[field];
    }
    if (path === "file_len") {
      if (vars.fileLen === undefined) throw new ExprError("expr: $file_len not available here");
      return vars.fileLen;
    }
    if (path.endsWith("_len")) {
      const region = path.slice(0, -4);
      const lens = vars.regionLens || {};
      if (!(region in lens)) throw new ExprError(`expr: unknown $${path}`);
      return lens[region];
    }
    throw new ExprError(`expr: bare reference $${path} not allowed`);
  }

  function unary() {
    const t = next();
    if (t === undefined) throw new ExprError("expr: unexpected end");
    if (t === "-") return -unary();
    if (t === "(") {
      const v = cmp();
      if (next() !== ")") throw new ExprError("expr: missing )");
      return v;
    }
    if (t.startsWith("$") || /^[\d.]/.test(t)) return resolve(t);
    throw new ExprError(`expr: unexpected token ${t}`);
  }
  function mul() {
    let v = unary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = next();
      const r = unary();
      v = op === "*" ? v * r : op === "/" ? Math.floor(v / r) : v % r;
    }
    return v;
  }
  function add() {
    let v = mul();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = mul();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  function cmp() {
    let v = add();
    while (["==", "!=", "<", "<=", ">", ">="].includes(peek())) {
      const op = next();
      const r = add();
      v = op === "==" ? v === r : op === "!=" ? v !== r : op === "<" ? v < r : op === "<=" ? v <= r : op === ">" ? v > r : v >= r;
    }
    return v;
  }
  const value = cmp();
  if (pos !== tokens.length) throw new ExprError(`expr: trailing tokens: ${tokens.slice(pos).join(" ")}`);
  return value;
}

// Static check used at spec-validation time: every $ref must resolve against
// the declared region/field topology (regions may only reference earlier
// regions — decode order).
export function checkRefs(src, knownRegions, currentRegion, fieldsOf) {
  const tokens = tokenize(src);
  for (const t of tokens) {
    if (!t.startsWith("$")) continue;
    const path = t.slice(1);
    if (path.includes(".")) {
      const [region, field] = path.split(".");
      const owner = region === "this" ? currentRegion : region;
      if (region !== "this" && !knownRegions.includes(region)) throw new ExprError(`spec: $${path} references unknown region`);
      if (!knownRegions.includes(owner)) throw new ExprError(`spec: $${path} references unknown region`);
      if (!fieldsOf(owner).includes(field)) throw new ExprError(`spec: $${path} references unknown field`);
    } else if (path === "file_len") {
      // allowed anywhere
    } else if (path.endsWith("_len")) {
      const region = path.slice(0, -4);
      if (!knownRegions.includes(region)) throw new ExprError(`spec: $${path} references unknown region`);
    } else {
      throw new ExprError(`spec: bare $${path} not allowed`);
    }
  }
  return true;
}
