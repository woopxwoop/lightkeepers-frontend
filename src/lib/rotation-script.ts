/**
 * Align a gcsim rotation script with an executed sample.
 *
 * The outer `for` is one rotation. `if`/`else` branches are alternatives;
 * matching picks the longest path that fits (even/odd, skill-ready, …).
 * Wait/delay/swap are ignored on both sides.
 */
import type {
  RotationAction,
  RotationSampleEvent,
} from "$lib/types/investment";

const MATCH_ACTIONS = new Set<RotationAction>([
  "skill",
  "hold_skill",
  "burst",
  "attack",
  "charge",
  "aim",
  "dash",
  "jump",
  "walk",
  "low_plunge",
  "high_plunge",
]);

const SKIP_CALLS = new Set(["wait", "delay", "sleep"]);

type Tok = { kind: "id" | "num" | "sym"; v: string };

export type ScriptPat =
  | { kind: "act"; char: string; action: RotationAction; count: number }
  | { kind: "seq"; items: ScriptPat[] }
  | { kind: "alt"; items: ScriptPat[] }
  | { kind: "star"; item: ScriptPat }
  | { kind: "repeat"; n: number; item: ScriptPat }
  | { kind: "repeatParam"; param: string; item: ScriptPat };

type FnDef = { params: string[]; body: ScriptPat };

export type ParsedRotationScript = {
  setup: ScriptPat;
  body: ScriptPat;
};

function stripComments(src: string): string {
  return src.replace(/\/\/[^\n]*/g, "").replace(/#[^\n]*/g, "");
}

function lex(src: string): Tok[] {
  const s = stripComments(src);
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j]!)) j += 1;
      out.push({ kind: "id", v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j]!)) j += 1;
      out.push({ kind: "num", v: s.slice(i, j) });
      i = j;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||", "++", "--"].includes(two)) {
      out.push({ kind: "sym", v: two });
      i += 2;
      continue;
    }
    out.push({ kind: "sym", v: c });
    i += 1;
  }
  return out;
}

class Parser {
  readonly toks: Tok[];
  readonly fns: Map<string, FnDef>;
  paramNames: Set<string>;
  i = 0;

  constructor(
    src: string,
    fns: Map<string, FnDef> = new Map(),
    paramNames: Set<string> = new Set(),
  ) {
    this.toks = lex(src);
    this.fns = fns;
    this.paramNames = paramNames;
  }

  peek(): Tok | undefined {
    return this.toks[this.i];
  }

  at(kind: Tok["kind"], v?: string): boolean {
    const t = this.peek();
    return Boolean(t && t.kind === kind && (v == null || t.v === v));
  }

  eat(kind: Tok["kind"], v?: string): Tok | null {
    if (!this.at(kind, v)) return null;
    return this.toks[this.i++]!;
  }

  eatId(v?: string): string | null {
    return this.eat("id", v)?.v ?? null;
  }

  skipBalanced(open: string, close: string): boolean {
    if (!this.eat("sym", open)) return false;
    let depth = 1;
    while (this.i < this.toks.length && depth > 0) {
      const t = this.toks[this.i++]!;
      if (t.kind === "sym" && t.v === open) depth += 1;
      else if (t.kind === "sym" && t.v === close) depth -= 1;
    }
    return depth === 0;
  }

  skipUntil(sym: string): void {
    while (this.i < this.toks.length) {
      const t = this.peek()!;
      if (t.kind === "sym" && (t.v === "}" || t.v === sym)) return;
      if (t.kind === "sym" && t.v === "(") {
        this.skipBalanced("(", ")");
        continue;
      }
      if (t.kind === "sym" && t.v === "[") {
        this.skipBalanced("[", "]");
        continue;
      }
      this.i += 1;
    }
  }

  skipStmtTail(): void {
    this.skipUntil(";");
    this.eat("sym", ";");
  }

  parseBlock(): ScriptPat {
    if (!this.eat("sym", "{")) return { kind: "seq", items: [] };
    const items = this.parseStmts();
    this.eat("sym", "}");
    return seqOf(items);
  }

  parseStmts(): ScriptPat[] {
    const items: ScriptPat[] = [];
    while (this.i < this.toks.length && !this.at("sym", "}")) {
      const stmt = this.parseStmt();
      if (stmt) items.push(stmt);
    }
    return items;
  }

  parseStmt(): ScriptPat | null {
    if (this.eatId("fn")) {
      this.skipUntil("{");
      this.skipBalanced("{", "}");
      return null;
    }
    if (this.eatId("active")) {
      this.eat("id");
      this.eat("sym", ";");
      return null;
    }
    if (this.eatId("let")) {
      this.skipStmtTail();
      return null;
    }
    if (this.eatId("for")) {
      return this.parseFor();
    }
    if (this.eatId("while")) {
      this.skipUntil("{");
      const body = this.parseBlock();
      return { kind: "star", item: body };
    }
    if (this.eatId("if")) {
      return this.parseIf();
    }
    const id = this.eat("id");
    if (!id) {
      this.i += 1;
      return null;
    }
    if (SKIP_CALLS.has(id.v.toLowerCase()) && this.at("sym", "(")) {
      this.skipBalanced("(", ")");
      this.eat("sym", ";");
      return null;
    }
    if (this.at("sym", "(")) {
      const fn = this.fns.get(id.v.toLowerCase());
      if (fn) {
        const args = this.parseCallArgs();
        this.eat("sym", ";");
        const env: Record<string, number> = {};
        fn.params.forEach((param, idx) => {
          const arg = args[idx];
          if (arg != null) env[param] = arg;
        });
        return bindPat(fn.body, env);
      }
      this.skipBalanced("(", ")");
      this.eat("sym", ";");
      return null;
    }
    return this.parseActionLine(id.v);
  }

  parseCallArgs(): number[] {
    const args: number[] = [];
    if (!this.eat("sym", "(")) return args;
    while (this.i < this.toks.length && !this.at("sym", ")")) {
      if (this.eat("sym", ",")) continue;
      const n = this.eat("num");
      if (n && Number.isFinite(Number(n.v))) {
        args.push(Number(n.v));
        continue;
      }
      this.i += 1;
    }
    this.eat("sym", ")");
    return args;
  }

  parseFor(): ScriptPat {
    const n = this.parseForCount();
    this.skipUntil("{");
    const body = this.parseBlock();
    if (typeof n === "number" && n > 0) return { kind: "repeat", n, item: body };
    if (typeof n === "string" && n) {
      return { kind: "repeatParam", param: n, item: body };
    }
    return { kind: "star", item: body };
  }

  parseForCount(): number | string | null {
    this.eatId("let");
    const name = this.eatId();
    this.eat("sym", "=");
    const startTok = this.eat("num");
    this.eat("sym", ";");
    const lhs = this.eatId();
    const op = this.eat("sym")?.v;
    const boundNum = this.eat("num");
    const boundId = boundNum ? null : this.eatId();
    const start = startTok ? Number(startTok.v) : NaN;
    const bound = boundNum ? Number(boundNum.v) : NaN;
    if (name && lhs === name && Number.isFinite(start)) {
      if (Number.isFinite(bound)) {
        if (op === "<") return Math.max(0, Math.floor(bound - start));
        if (op === "<=") return Math.max(0, Math.floor(bound - start) + 1);
        if (op === ">") return Math.max(0, Math.floor(start - bound));
        if (op === ">=") return Math.max(0, Math.floor(start - bound) + 1);
      }
      if (
        boundId &&
        this.paramNames.has(boundId) &&
        start === 0 &&
        op === "<"
      ) {
        return boundId;
      }
    }
    return null;
  }

  parseIf(): ScriptPat {
    this.skipUntil("{");
    const branches: ScriptPat[] = [this.parseBlock()];
    let hadPlainElse = false;
    while (this.eatId("else")) {
      if (this.eatId("if")) {
        this.skipUntil("{");
        branches.push(this.parseBlock());
        continue;
      }
      branches.push(this.parseBlock());
      hadPlainElse = true;
      break;
    }
    if (!hadPlainElse) branches.push({ kind: "seq", items: [] });
    return { kind: "alt", items: branches };
  }

    parseBracketParams(): Record<string, number> {
    const out: Record<string, number> = {};
    if (!this.eat("sym", "[")) return out;
    while (this.i < this.toks.length && !this.at("sym", "]")) {
      if (this.eat("sym", ",")) continue;
      const key = this.eatId();
      if (!key) {
        this.i += 1;
        continue;
      }
      let val = 1;
      if (this.eat("sym", "=")) {
        const n = this.eat("num");
        if (n && Number.isFinite(Number(n.v))) val = Number(n.v);
        else this.eatId();
      }
      if (Number.isFinite(val)) out[key.toLowerCase()] = val;
    }
    this.eat("sym", "]");
    return out;
  }

  parseRepeatCount(): number {
    if (!this.eat("sym", ":")) return 1;
    const n = this.eat("num");
    const parsed = n ? Number(n.v) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }

  parseActionLine(char: string): ScriptPat | null {
    const acts: ScriptPat[] = [];
    while (this.i < this.toks.length && !this.at("sym", ";")) {
      if (this.at("sym", ",")) {
        this.i += 1;
        continue;
      }
      const name = this.eatId();
      if (!name) {
        if (this.at("sym", "[") || this.at("sym", "(")) {
          const open = this.peek()!.v;
          this.skipBalanced(open, open === "[" ? "]" : ")");
          continue;
        }
        this.i += 1;
        continue;
      }
      // gcsim: `skill[hold=1]:2` or `attack:4` (count before or after params)
      let count = this.parseRepeatCount();
      const params = this.parseBracketParams();
      if (count === 1) count = this.parseRepeatCount();
      const action = actionFromCall(name, params);
      if (!action) continue;
      acts.push({ kind: "act", char, action, count });
    }
    this.eat("sym", ";");
    return acts.length ? seqOf(acts) : null;
  }
}

function seqOf(items: ScriptPat[]): ScriptPat {
  const flat = items.flatMap((p) => (p.kind === "seq" ? p.items : [p]));
  if (flat.length === 1) return flat[0]!;
  return { kind: "seq", items: flat };
}

function actionFromCall(
  name: string,
  params: Record<string, number>,
): RotationAction | null {
  const base = name.toLowerCase();
  if (base === "swap" || SKIP_CALLS.has(base)) return null;
  if (base === "skill" && params.hold != null && params.hold !== 0) {
    return "hold_skill";
  }
  if (!MATCH_ACTIONS.has(base as RotationAction)) return null;
  return base as RotationAction;
}

function actionsMatch(
  scriptAction: RotationAction,
  sampleAction: RotationAction,
): boolean {
  if (scriptAction === sampleAction) return true;
  // Older samples stored hold E as `skill` — script hold_skill may match that.
  return scriptAction === "hold_skill" && sampleAction === "skill";
}

function bindPat(pat: ScriptPat, env: Record<string, number>): ScriptPat {
  switch (pat.kind) {
    case "act":
      return pat;
    case "seq":
      return seqOf(pat.items.map((item) => bindPat(item, env)));
    case "alt":
      return { kind: "alt", items: pat.items.map((item) => bindPat(item, env)) };
    case "star":
      return { kind: "star", item: bindPat(pat.item, env) };
    case "repeat":
      return { kind: "repeat", n: pat.n, item: bindPat(pat.item, env) };
    case "repeatParam": {
      const n = env[pat.param];
      const item = bindPat(pat.item, env);
      if (typeof n === "number" && n > 0) {
        return { kind: "repeat", n: Math.floor(n), item };
      }
      return { kind: "star", item };
    }
  }
}

function patHasAct(pat: ScriptPat): boolean {
  switch (pat.kind) {
    case "act":
      return true;
    case "seq":
      return pat.items.some(patHasAct);
    case "alt":
      return pat.items.some(patHasAct);
    case "star":
    case "repeat":
    case "repeatParam":
      return patHasAct(pat.item);
  }
}

function parseFnDefs(src: string): Map<string, FnDef> {
  const fns = new Map<string, FnDef>();
  const p = new Parser(src, fns);
  while (p.i < p.toks.length) {
    if (!p.at("id", "fn")) {
      p.i += 1;
      continue;
    }
    p.eatId("fn");
    const name = p.eatId();
    if (!name || !p.eat("sym", "(")) continue;
    const params: string[] = [];
    while (p.i < p.toks.length && !p.at("sym", ")")) {
      if (p.eat("sym", ",")) continue;
      const param = p.eatId();
      if (param) params.push(param);
      else p.i += 1;
    }
    p.eat("sym", ")");
    p.paramNames = new Set(params);
    const body = p.parseBlock();
    p.paramNames = new Set();
    fns.set(name.toLowerCase(), { params, body });
  }
  return fns;
}

/** Last `active …;` through EOF — the rotation region of a full gcsim config. */
export function rotationScriptRegion(src: string): string {
  const stripped = stripComments(src);
  const matches = [...stripped.matchAll(/\bactive\s+[A-Za-z_][A-Za-z0-9_]*/gi)];
  const last = matches.at(-1);
  if (!last || last.index == null) return stripped;
  return stripped.slice(last.index);
}

export function parseRotationScript(src: string): ParsedRotationScript | null {
  const fns = parseFnDefs(src);
  const region = rotationScriptRegion(src);
  const p = new Parser(region, fns);
  p.eatId("active");
  p.eat("id");
  p.eat("sym", ";");
  const setupItems: ScriptPat[] = [];
  while (p.i < p.toks.length) {
    if (p.at("id", "for")) {
      p.eatId("for");
      p.parseForCount();
      p.skipUntil("{");
      if (!p.eat("sym", "{")) return null;
      const bodyItems = p.parseStmts();
      p.eat("sym", "}");
      const body = seqOf(bodyItems);
      if (!patHasAct(body)) return null;
      return { setup: seqOf(setupItems), body };
    }
    const stmt = p.parseStmt();
    if (stmt) setupItems.push(stmt);
  }
  return null;
}

export function resolveScriptChar(
  alias: string,
  party: readonly string[],
): string | null {
  const t = alias.toLowerCase();
  const exact = party.find((k) => k.toLowerCase() === t);
  if (exact) return exact;
  const hits = party.filter((k) => {
    const low = k.toLowerCase();
    return low.includes(t) || t.includes(low);
  });
  return hits.length === 1 ? hits[0]! : null;
}

type MatchTok = {
  char: string;
  action: RotationAction;
  t: number;
  eventIndex: number;
};

type ActionOverlay = (RotationAction | null)[];

function matchableEvents(
  events: readonly RotationSampleEvent[],
): MatchTok[] {
  const out: MatchTok[] = [];
  events.forEach((e, eventIndex) => {
    if (
      e.action === "swap" ||
      e.action === "wait" ||
      e.action === "delay" ||
      e.action === "other" ||
      !MATCH_ACTIONS.has(e.action)
    ) {
      return;
    }
    out.push({ char: e.char, action: e.action, t: e.t, eventIndex });
  });
  return out;
}

function restoreOverlay(overlay: ActionOverlay | null, snap: ActionOverlay) {
  if (!overlay) return;
  overlay.splice(0, overlay.length, ...snap);
}

function matchPat(
  pat: ScriptPat,
  toks: readonly MatchTok[],
  i: number,
  party: readonly string[],
  overlay: ActionOverlay | null,
): number {
  switch (pat.kind) {
    case "act": {
      const key = resolveScriptChar(pat.char, party);
      if (!key) return -1;
      let pos = i;
      for (let n = 0; n < pat.count; n++) {
        const tok = toks[pos];
        if (!tok || tok.char !== key || !actionsMatch(pat.action, tok.action)) {
          return -1;
        }
        if (overlay) {
          // Never downgrade a sampled hold_skill to script `skill`.
          overlay[pos] =
            tok.action === "hold_skill" ? "hold_skill" : pat.action;
        }
        pos += 1;
      }
      return pos;
    }
    case "seq": {
      const snap = overlay?.slice() ?? [];
      let pos = i;
      for (const item of pat.items) {
        pos = matchPat(item, toks, pos, party, overlay);
        if (pos < 0) {
          restoreOverlay(overlay, snap);
          return -1;
        }
      }
      return pos;
    }
    case "alt": {
      let best = -1;
      let bestCopy: ActionOverlay | null = null;
      const snapshot = overlay?.slice() ?? [];
      for (const item of pat.items) {
        restoreOverlay(overlay, snapshot);
        const end = matchPat(item, toks, i, party, overlay);
        if (end > best) {
          best = end;
          bestCopy = overlay?.slice() ?? null;
        }
      }
      if (best >= 0 && overlay && bestCopy) restoreOverlay(overlay, bestCopy);
      else restoreOverlay(overlay, snapshot);
      return best;
    }
    case "star": {
      let pos = i;
      while (true) {
        const snap = overlay?.slice() ?? [];
        const end = matchPat(pat.item, toks, pos, party, overlay);
        if (end < 0 || end <= pos) {
          restoreOverlay(overlay, snap);
          break;
        }
        pos = end;
      }
      return pos;
    }
    case "repeat": {
      const snap = overlay?.slice() ?? [];
      let pos = i;
      for (let n = 0; n < pat.n; n++) {
        pos = matchPat(pat.item, toks, pos, party, overlay);
        if (pos < 0) {
          restoreOverlay(overlay, snap);
          return -1;
        }
      }
      return pos;
    }
    case "repeatParam": {
      // Unbound fn param — greedy like `while`.
      let pos = i;
      while (true) {
        const snap = overlay?.slice() ?? [];
        const end = matchPat(pat.item, toks, pos, party, overlay);
        if (end < 0 || end <= pos) {
          restoreOverlay(overlay, snap);
          break;
        }
        pos = end;
      }
      return pos;
    }
  }
}

type ScriptAlign = {
  starts: number[];
  hasSetup: boolean;
  toks: MatchTok[];
  overlay: ActionOverlay;
};

export type ScriptSampleAlignment = {
  events: readonly RotationSampleEvent[];
  loopMatch: ScriptLoopMatch | null;
};

function annotateEventsFromAlign(
  events: readonly RotationSampleEvent[],
  aligned: ScriptAlign,
): readonly RotationSampleEvent[] {
  const byEvent = new Map<number, RotationAction>();
  aligned.toks.forEach((tok, i) => {
    const action = aligned.overlay[i];
    if (action) byEvent.set(tok.eventIndex, action);
  });
  if (byEvent.size === 0) return events;
  let changed = false;
  const next = events.map((event, i) => {
    const action = byEvent.get(i);
    if (!action || action === event.action) return event;
    changed = true;
    return { ...event, action };
  });
  return changed ? next : events;
}

/** One script lex/parse/match pass for display annotations and loop detection. */
export function resolveScriptSampleAlignment(
  events: readonly RotationSampleEvent[],
  script: string | null | undefined,
  party: readonly string[],
): ScriptSampleAlignment {
  if (!script?.trim() || party.length === 0) {
    return { events, loopMatch: null };
  }
  const aligned = alignScript(events, script, party);
  if (!aligned) return { events, loopMatch: null };
  const loopMatch: ScriptLoopMatch | null =
    aligned.starts.length >= 2
      ? { starts: aligned.starts, hasSetup: aligned.hasSetup }
      : null;
  return {
    events: annotateEventsFromAlign(events, aligned),
    loopMatch,
  };
}

function alignScript(
  events: readonly RotationSampleEvent[],
  script: string,
  party: readonly string[],
): ScriptAlign | null {
  const parsed = parseRotationScript(script);
  if (!parsed || party.length === 0) return null;
  const toks = matchableEvents(events);
  if (toks.length < 4) return null;
  const overlay: ActionOverlay = toks.map(() => null);

  let pos = 0;
  let hasSetup = false;
  if (patHasAct(parsed.setup)) {
    const end = matchPat(parsed.setup, toks, 0, party, overlay);
    if (end < 0) return null;
    hasSetup = end > 0;
    pos = end;
  }

  const starts: number[] = [];
  while (pos < toks.length) {
    const end = matchPat(parsed.body, toks, pos, party, overlay);
    if (end < 0 || end <= pos) break;
    const t = toks[pos]?.t;
    if (t == null) break;
    starts.push(t);
    pos = end;
  }
  if (!hasSetup && starts.length === 0) return null;
  return { starts, hasSetup, toks, overlay };
}

export type ScriptLoopMatch = {
  /** Timestamp of each matched `for` iteration start. */
  starts: number[];
  /** True when the script had a matched prefix before the `for`. */
  hasSetup: boolean;
};

/**
 * Walk the sample by matching setup (if any) then the `for` body repeatedly.
 * Returns null when the script cannot be aligned.
 */
export function matchScriptLoops(
  events: readonly RotationSampleEvent[],
  script: string,
  party: readonly string[],
): ScriptLoopMatch | null {
  return resolveScriptSampleAlignment(events, script, party).loopMatch;
}

/**
 * Copy matched script action kinds onto sample events (`skill[hold=1]` →
 * `hold_skill`) so display can show hE even when the sample only stored E.
 */
export function applyScriptEventActions(
  events: readonly RotationSampleEvent[],
  script: string | null | undefined,
  party: readonly string[],
): readonly RotationSampleEvent[] {
  return resolveScriptSampleAlignment(events, script, party).events;
}
