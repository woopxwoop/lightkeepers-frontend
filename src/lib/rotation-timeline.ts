/**
 * Client helpers for the rotation sample swimlane UI.
 * CDN events stay raw; collapse/abbrev happen at display time.
 */
import { matchScriptLoops, type ScriptLoopMatch } from "$lib/rotation-script";
import type {
  RotationAction,
  RotationSampleEvent,
} from "$lib/types/investment";

export const ROTATION_ACTION_ABBREV = {
  skill: "E",
  hold_skill: "hE",
  burst: "Q",
  attack: "N",
  charge: "C",
  aim: "Aimed",
  dash: "D",
  jump: "J",
  walk: "W",
  low_plunge: "lP",
  high_plunge: "hP",
  wait: "wait",
  delay: "delay",
  swap: "Swap",
  other: "·",
} as const satisfies Record<RotationAction, string>;

export type CollapsedRotationEvent = RotationSampleEvent & {
  /** Consecutive same-identity events merged into this marker. */
  count: number;
};

function eventIdentity(e: RotationSampleEvent): string {
  const label = e.action === "swap" ? (e.label ?? "") : "";
  return `${e.char}\0${e.action}\0${label}`;
}

function isOmittedRotationAction(action: RotationAction): boolean {
  return action === "wait" || action === "delay" || action === "other";
}

function hasActionsBefore(
  events: readonly RotationSampleEvent[],
  t: number,
): boolean {
  return events.some(
    (e) =>
      e.t < t - 1e-9 &&
      e.action !== "swap" &&
      !isOmittedRotationAction(e.action),
  );
}

/**
 * Merge consecutive events with the same char + action (+ swap label).
 * `t` is the start of the run. Order is preserved. Wait/delay stay in the
 * sample; the swimlane and plaintext skip them (and leftover `other`).
 */
export function collapseRotationEvents(
  events: readonly RotationSampleEvent[],
): CollapsedRotationEvent[] {
  const out: CollapsedRotationEvent[] = [];
  for (const event of events) {
    if (isOmittedRotationAction(event.action)) continue;
    const prev = out[out.length - 1];
    if (prev && eventIdentity(prev) === eventIdentity(event)) {
      prev.count += 1;
      continue;
    }
    out.push({ ...event, count: 1 });
  }
  return out;
}

/** Display label: `N`, `N4`, `E`, `Swap`, … Walk frame runs stay `W`. */
export function formatCollapsedActionLabel(
  action: RotationAction,
  count: number,
): string {
  const base = ROTATION_ACTION_ABBREV[action];
  if (action === "walk" || count <= 1) return base;
  return `${base}${count}`;
}

/**
 * Atomic KQM tokens for one collapsed event (before cancel-jamming /
 * repeat compression). Swaps are omitted — emitted as `>` between blocks.
 */
export function formatKqmActionTokens(
  event: CollapsedRotationEvent,
): string[] {
  const n = Math.max(1, event.count);
  switch (event.action) {
    case "attack":
      return [`N${n}`];
    case "charge":
      return Array.from({ length: n }, () => "C");
    case "skill":
      return Array.from({ length: n }, () => "E");
    case "hold_skill":
      return Array.from({ length: n }, () => "hE");
    case "burst":
      return Array.from({ length: n }, () => "Q");
    case "dash":
      return Array.from({ length: n }, () => "D");
    case "jump":
      return Array.from({ length: n }, () => "J");
    case "walk":
      return ["W"];
    case "aim":
      return Array.from({ length: n }, () => "Aimed");
    case "low_plunge":
      return Array.from({ length: n }, () => "lP");
    case "high_plunge":
      return Array.from({ length: n }, () => "hP");
    case "swap":
    case "wait":
    case "delay":
    case "other":
      return [];
  }
}

/** Jam cancel combos: N3+C → N3C, N4+D → N4D, E+Q → EQ. */
export function jamKqmTokens(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cur = tokens[i]!;
    const next = tokens[i + 1];
    if (next && /^N\d+$/.test(cur) && /^[CDJW]$/.test(next)) {
      out.push(`${cur}${next}`);
      i += 2;
      continue;
    }
    if ((cur === "E" || cur === "hE") && next === "Q") {
      out.push(`${cur}Q`);
      i += 2;
      continue;
    }
    out.push(cur);
    i += 1;
  }
  return out;
}

/** Collapse consecutive identical tokens: N3D N3D N3D → 3[N3D]. Walk stays `W`. */
export function compressKqmRepeats(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let j = i + 1;
    while (j < tokens.length && tokens[j] === tokens[i]) j += 1;
    const n = j - i;
    const tok = tokens[i]!;
    out.push(n >= 2 && tok !== "W" ? `${n}[${tok}]` : tok);
    i = j;
  }
  return out;
}

/**
 * One wrapping KQM-style line per rotation, e.g.
 * `Arlecchino E > Bennett E > Xilonen E N2 > Yelan EQ > Bennett Q N1 > Arlecchino N3C 5[N3D] N1`
 *
 * When `loopEndsS` is set, each period is its own string (setup is in the
 * first). The UI draws a horizontal rule between them.
 */
export function formatRotationPlaintext(
  collapsed: readonly CollapsedRotationEvent[],
  opts: {
    resolveName?: (key: string) => string;
    loopEndsS?: readonly number[] | null;
  } = {},
): string[] {
  const resolveName = opts.resolveName ?? ((key: string) => key);
  const cuts = (opts.loopEndsS ?? [])
    .filter((t) => t > 0)
    .slice()
    .sort((a, b) => a - b);

  const blocks: { t: number; text: string }[] = [];
  let i = 0;
  while (i < collapsed.length) {
    while (i < collapsed.length && collapsed[i]!.action === "swap") i += 1;
    if (i >= collapsed.length) break;

    const first = collapsed[i]!;
    const char = first.char;
    const raw: string[] = [];
    while (i < collapsed.length && collapsed[i]!.char === char) {
      const event = collapsed[i]!;
      if (event.action !== "swap") {
        raw.push(...formatKqmActionTokens(event));
      }
      i += 1;
    }
    const actions = compressKqmRepeats(jamKqmTokens(raw));
    if (actions.length === 0) continue;
    blocks.push({
      t: first.t,
      text: `${resolveName(char)} ${actions.join(" ")}`,
    });
  }

  if (blocks.length === 0) return [];
  if (cuts.length === 0) {
    return [blocks.map((b) => b.text).join(" > ")];
  }

  const segments: string[][] = [[]];
  let cut = 0;
  for (const block of blocks) {
    while (cut < cuts.length && block.t >= cuts[cut]! - 1e-9) {
      segments.push([]);
      cut += 1;
    }
    segments[segments.length - 1]!.push(block.text);
  }
  return segments
    .filter((seg) => seg.length > 0)
    .map((seg) => seg.join(" > "));
}

/** True when the first cut is setup → loop, not loop → loop. */
export function rotationHasSetupPrefix(
  loopEndS: number | null,
  loopEndsS: readonly number[],
): boolean {
  const first = loopEndsS[0];
  return first != null && loopEndS != null && first < loopEndS - 1e-9;
}

/** `setup`, `rotation 1`, `rotation 2`, … for plaintext / divider labels. */
export function rotationSegmentLabel(
  index: number,
  hasSetup: boolean,
): string {
  if (hasSetup) {
    return index <= 0 ? "setup" : `rotation ${index}`;
  }
  return `rotation ${index + 1}`;
}

/** Events for one swimlane row, already collapsed, time-ordered. */
export function eventsForCharacter(
  collapsed: readonly CollapsedRotationEvent[],
  charKey: string,
): CollapsedRotationEvent[] {
  return collapsed.filter((e) => e.char === charKey);
}

/** Clamp marker position to [0, 1] of the timeline. */
export function rotationTimeFrac(t: number, durationS: number): number {
  if (!(durationS > 0) || !Number.isFinite(t)) return 0;
  if (t <= 0) return 0;
  if (t >= durationS) return 1;
  return t / durationS;
}

/** Fallback when swap-pattern detection cannot find a repeating cycle. */
export const DEFAULT_ROTATION_WINDOW_S = 20;

/** Soft bounds for a detected cycle length (seconds). */
const MIN_DETECTED_WINDOW_S = 4;
const MAX_DETECTED_WINDOW_S = 45;
/** Swaps after this time cannot end the first glance loop. */
const MAX_GLANCE_LOOP_END_S = 60;

function swapTargetId(e: RotationSampleEvent): string {
  const raw = (e.label || e.char || "").trim().toLowerCase();
  return raw;
}

export type SwapCycleMatch = {
  /** Index of the first swap in the repeating block. */
  startIndex: number;
  /** Number of swaps in one period. */
  period: number;
  /** How many consecutive full periods match from startIndex. */
  periods: number;
};

/**
 * Count how many consecutive period-length blocks match `targets[s..s+p)`
 * starting at `s`.
 */
export function countSwapPeriodsAt(
  swapTargets: readonly string[],
  startIndex: number,
  period: number,
): number {
  const n = swapTargets.length;
  if (period < 1 || startIndex < 0 || n < startIndex + 2 * period) return 0;
  let periods = 0;
  while (startIndex + (periods + 1) * period <= n) {
    for (let i = 0; i < period; i++) {
      if (
        swapTargets[startIndex + periods * period + i] !==
        swapTargets[startIndex + i]
      ) {
        return periods;
      }
    }
    periods += 1;
  }
  return periods;
}

function cycleDurationS(
  swapTimes: readonly number[],
  startIndex: number,
  period: number,
): number {
  const a = swapTimes[startIndex];
  const b = swapTimes[startIndex + period];
  if (a == null || b == null) return 0;
  return b - a;
}

/** Near-equal cycle lengths (same loop, different phase) count as a tie. */
const CYCLE_DURATION_EPS_S = 0.35;

/**
 * Best repeating swap-target cycle anywhere in the sequence.
 *
 * With swap timestamps: prefer *shorter* period first (avoid mistaking two
 * loops for one), then longer one-cycle duration (so a setup swap onto the
 * same carry is not treated as the loop end), then more periods, then
 * earlier start. Durations within {@link CYCLE_DURATION_EPS_S} are ties so
 * the first loop wins over a later phase of the same cycle.
 *
 * Without timestamps: prefer more periods, then shorter period, then earlier
 * start (legacy / unit tests).
 */
export function findBestSwapCycle(
  swapTargets: readonly string[],
  swapTimes?: readonly number[],
): SwapCycleMatch | null {
  const n = swapTargets.length;
  if (n < 4) return null;

  const hasTimes = Boolean(swapTimes && swapTimes.length === n);
  let best: SwapCycleMatch | null = null;
  let bestDur = -1;
  for (let s = 0; s < n - 1; s++) {
    const maxP = Math.floor((n - s) / 2);
    for (let p = 1; p <= maxP; p++) {
      const periods = countSwapPeriodsAt(swapTargets, s, p);
      if (periods < 2) continue;
      const dur = hasTimes ? cycleDurationS(swapTimes!, s, p) : 0;
      const cand: SwapCycleMatch = {
        startIndex: s,
        period: p,
        periods,
      };
      let better = !best;
      if (best && hasTimes) {
        if (cand.period < best.period) better = true;
        else if (cand.period === best.period) {
          if (dur > bestDur + CYCLE_DURATION_EPS_S) better = true;
          else if (Math.abs(dur - bestDur) <= CYCLE_DURATION_EPS_S) {
            better =
              cand.periods > best.periods ||
              (cand.periods === best.periods &&
                cand.startIndex < best.startIndex);
          }
        }
      } else if (best) {
        better =
          cand.periods > best.periods ||
          (cand.periods === best.periods && cand.period < best.period) ||
          (cand.periods === best.periods &&
            cand.period === best.period &&
            cand.startIndex < best.startIndex);
      }
      if (better) {
        best = cand;
        bestDur = dur;
      }
    }
  }
  return best;
}

export type RotationWindow = {
  /** Inclusive start time (seconds). Setup is included when this is 0. */
  startS: number;
  /**
   * Inclusive end time (seconds) — includes the swap that opens the next
   * loop so the glance view peeks past the period boundary.
   */
  endS: number;
  /**
   * Time of the completed-loop boundary (next-cycle swap). Used for the
   * first divider; null when falling back to a fixed window.
   */
  loopEndS: number | null;
  /** Setup→loop and each later loop-start swap time (includes `loopEndS`). */
  loopEndsS: number[];
  period: number | null;
};

function fallbackWindow(fallbackEndS: number): RotationWindow {
  return {
    startS: 0,
    endS: fallbackEndS,
    loopEndS: null,
    loopEndsS: [],
    period: null,
  };
}

export type RotationWindowOpts = {
  /** gcsim config text — outer `for` body is matched against the sample. */
  script?: string | null;
  /** Party keys used to resolve script aliases (`bina` → Columbina). */
  characters?: readonly string[];
  /**
   * When provided, skips {@link matchScriptLoops} (reuse one alignment pass).
   * Pass `null` when alignment already ran and found no script loop.
   */
  scriptMatch?: ScriptLoopMatch | null;
};

function windowFromScript(
  events: readonly RotationSampleEvent[],
  opts: RotationWindowOpts | undefined,
): RotationWindow | null {
  const match =
    opts && "scriptMatch" in opts
      ? opts.scriptMatch
      : (() => {
          const script = opts?.script?.trim();
          const party = opts?.characters;
          if (!script || !party?.length) return null;
          return matchScriptLoops(events, script, party);
        })();
  if (!match) return null;
  const loopStart = match.starts[0];
  const nextStart = match.starts[1];
  if (loopStart == null || nextStart == null) return null;
  const cycleLen = nextStart - loopStart;
  if (
    cycleLen < MIN_DETECTED_WINDOW_S ||
    cycleLen > MAX_DETECTED_WINDOW_S ||
    nextStart > MAX_GLANCE_LOOP_END_S
  ) {
    return null;
  }
  const loopEndsS = match.hasSetup ? match.starts : match.starts.slice(1);
  return {
    startS: 0,
    endS: nextStart,
    loopEndS: nextStart,
    loopEndsS,
    period: null,
  };
}

/**
 * Detect one glanceable rotation window:
 * prefer aligning the gcsim `for` body to the sample, else infer from
 * swap-target cycles (setup through the first full loop, peeking the
 * swap that opens the next iteration).
 */
export function detectRotationWindow(
  events: readonly RotationSampleEvent[],
  fallbackEndS: number = DEFAULT_ROTATION_WINDOW_S,
  opts?: RotationWindowOpts,
): RotationWindow {
  const fromScript = windowFromScript(events, opts);
  if (fromScript) return fromScript;

  const swaps = events
    .filter((e) => e.action === "swap" && e.t <= MAX_GLANCE_LOOP_END_S)
    .slice()
    .sort((a, b) => a.t - b.t || 0);

  const targets = swaps.map(swapTargetId).filter(Boolean);
  const times = swaps.map((s) => s.t);
  if (targets.length !== swaps.length) {
    return fallbackWindow(fallbackEndS);
  }

  const best = findBestSwapCycle(targets, times);
  if (!best) {
    return fallbackWindow(fallbackEndS);
  }

  const endSwap = swaps[best.startIndex + best.period];
  if (!endSwap || !(endSwap.t > 0)) {
    return fallbackWindow(fallbackEndS);
  }

  const loopEndS = endSwap.t;
  const cycleLen = cycleDurationS(times, best.startIndex, best.period);
  // Soft-bound the loop length; hard-cap setup+loop so multi-iter samples
  // do not paint the whole fight.
  if (
    cycleLen < MIN_DETECTED_WINDOW_S ||
    cycleLen > MAX_DETECTED_WINDOW_S ||
    loopEndS < MIN_DETECTED_WINDOW_S ||
    loopEndS > MAX_GLANCE_LOOP_END_S
  ) {
    return fallbackWindow(fallbackEndS);
  }

  const loopEndsS: number[] = [];
  // Setup cut: a swap-target prefix (startIndex > 0), or on-field actions
  // before the first loop swap (active char does E/lP/… then the loop).
  const firstLoopSwap = swaps[best.startIndex]!;
  const setupBeforeLoop =
    best.startIndex > 0 ||
    (firstLoopSwap.t > 0 && hasActionsBefore(events, firstLoopSwap.t));
  const k0 = setupBeforeLoop ? 0 : 1;
  for (let k = k0; k <= best.periods; k++) {
    const sw = swaps[best.startIndex + k * best.period];
    if (sw && sw.t > 0) loopEndsS.push(sw.t);
  }
  // Setup + first loop, inclusive of the next-cycle swap at loopEndS.
  return { startS: 0, endS: loopEndS, loopEndS, loopEndsS, period: best.period };
}

/**
 * Keep events in the glance window.
 * - number → `[0, endS)` (legacy / fallback)
 * - `{ startS, endS }` → `[startS, endS]` inclusive so the next-loop swap peek is kept
 */
export function sliceRotationWindow(
  events: readonly CollapsedRotationEvent[],
  window: number | { startS?: number; endS: number } = DEFAULT_ROTATION_WINDOW_S,
): CollapsedRotationEvent[] {
  if (typeof window === "number") {
    if (!(window > 0)) return [...events];
    return events.filter((e) => e.t >= 0 && e.t < window);
  }
  const startS = window.startS ?? 0;
  const endS = window.endS;
  if (!(endS >= startS)) return [...events];
  return events.filter((e) => e.t >= startS && e.t <= endS);
}

export type LaneMarkerLayout = {
  leftPx: number;
  widthPx: number;
  event: CollapsedRotationEvent;
  label: string;
};

const BOUNDARY_AFTER_GAP_PX = 3;
const LAYOUT_PAD_PX = 6;
const MIN_MARKER_GAP_PX = 6;
/** Invisible swap slots still reserve a handoff tick. */
const SWAP_SLOT_PX = 8;

function markerChipWidthPx(
  event: CollapsedRotationEvent,
  label: string,
): number {
  if (event.action === "swap") return SWAP_SLOT_PX;
  return Math.max(24, 16 + label.length * 8);
}

/**
 * X position for a vertical loop-boundary line: just after the last
 * in-period action chip, not through it.
 */
export function loopBoundaryLeftPx(
  markers: readonly LaneMarkerLayout[],
  loopEndS: number | null,
): number | null {
  if (loopEndS == null || !(loopEndS > 0) || markers.length === 0) return null;
  const peekIdx = markers.findIndex((m) => m.event.t >= loopEndS - 1e-9);
  if (peekIdx < 0) return null;
  if (peekIdx === 0) return Math.max(0, markers[0]!.leftPx);
  const prev = markers[peekIdx - 1]!;
  return prev.leftPx + prev.widthPx + BOUNDARY_AFTER_GAP_PX;
}

/** Divider X positions for every detected loop boundary. */
export function loopBoundaryLeftPxs(
  markers: readonly LaneMarkerLayout[],
  loopEndsS: readonly number[],
): number[] {
  const out: number[] = [];
  for (const t of loopEndsS) {
    const x = loopBoundaryLeftPx(markers, t);
    if (x != null) out.push(x);
  }
  return out;
}

export type RotationAxisBand = {
  leftPx: number;
  widthPx: number;
  label: string;
};

/**
 * Labeled regions on the swimlane axis: `[0, first cut)` setup (when
 * present), then `rotation 1`, `rotation 2`, … through track end.
 */
export function rotationAxisBands(
  boundaryLeftPxs: readonly number[],
  trackWidthPx: number,
  hasSetup: boolean,
): RotationAxisBand[] {
  const cuts = [...boundaryLeftPxs]
    .filter((x) => Number.isFinite(x) && x >= 0)
    .sort((a, b) => a - b);
  const end = Math.max(0, trackWidthPx);
  const edges = [0, ...cuts.filter((x) => x > 0 && x < end), end];
  const bands: RotationAxisBand[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const leftPx = edges[i]!;
    const rightPx = edges[i + 1]!;
    const widthPx = rightPx - leftPx;
    if (widthPx <= 0) continue;
    bands.push({
      leftPx,
      widthPx,
      label: rotationSegmentLabel(i, hasSetup),
    });
  }
  return bands;
}

/**
 * Shared timeline for collapsed events (all characters), chronological.
 *
 * Chips pack left-to-right with a minimum gap (readable, no overlap). When
 * that packed first rotation is narrower than the viewport, gaps stretch so
 * the glance window fills the panel — never compressed past one rotation.
 * Later loops keep the same gap and extend the track for scrolling.
 */
export function layoutRotationMarkers(
  collapsed: readonly CollapsedRotationEvent[],
  _durationS: number,
  opts: {
    /** Visible panel width to fit the glance window into. */
    viewportWidthPx?: number;
    /** Inclusive end time of the glance window (seconds). */
    fitThroughT?: number | null;
  } = {},
): { markers: LaneMarkerLayout[]; trackWidthPx: number } {
  const ordered = collapsed
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.t - b.event.t || a.index - b.index);

  const n = ordered.length;
  const viewport = Math.max(0, opts.viewportWidthPx ?? 640);
  const pad = LAYOUT_PAD_PX;

  const rows = ordered.map(({ event }) => {
    const label = formatCollapsedActionLabel(event.action, event.count);
    return {
      event,
      label,
      widthPx: markerChipWidthPx(event, label),
    };
  });

  const fitThroughT = opts.fitThroughT;
  let fitCount = n;
  if (fitThroughT != null && Number.isFinite(fitThroughT)) {
    fitCount = 0;
    for (const row of rows) {
      if (row.event.t <= fitThroughT + 1e-9) fitCount += 1;
      else break;
    }
    if (fitCount < 1) fitCount = Math.min(1, n);
  }

  const glanceWidthSum = rows
    .slice(0, fitCount)
    .reduce((sum, row) => sum + row.widthPx, 0);
  const glancePacked =
    pad * 2 + glanceWidthSum + MIN_MARKER_GAP_PX * Math.max(0, fitCount - 1);
  const gap =
    fitCount > 1 && viewport > glancePacked
      ? MIN_MARKER_GAP_PX + (viewport - glancePacked) / (fitCount - 1)
      : MIN_MARKER_GAP_PX;

  const markers: LaneMarkerLayout[] = [];
  let x = pad;
  for (const row of rows) {
    markers.push({
      leftPx: x,
      widthPx: row.widthPx,
      event: row.event,
      label: row.label,
    });
    x += row.widthPx + gap;
  }
  const lastRight =
    n === 0 ? pad : markers[n - 1]!.leftPx + markers[n - 1]!.widthPx;
  const contentW = Math.ceil(Math.max(viewport, lastRight + pad));
  return { markers, trackWidthPx: contentW };
}

/** Markers for one swimlane from a shared global layout. */
export function markersForCharacter(
  markers: readonly LaneMarkerLayout[],
  charKey: string,
): LaneMarkerLayout[] {
  return markers.filter((m) => m.event.char === charKey);
}

export function markerCenterX(marker: LaneMarkerLayout): number {
  return marker.leftPx + marker.widthPx / 2;
}

/** Incoming on-field character for a swap event; null for other actions. */
export function swapIncomingChar(
  event: Pick<RotationSampleEvent, "action" | "char" | "label">,
): string | null {
  if (event.action !== "swap") return null;
  const raw = (event.label || event.char || "").trim();
  return raw || null;
}

export type FieldSpanLayout = {
  char: string;
  leftPx: number;
  widthPx: number;
};

export type FieldHandoffLayout = {
  fromChar: string;
  toChar: string;
  xPx: number;
};

/**
 * On-field occupancy from the shared marker layout.
 *
 * Swaps change who is on field; off-field actions (Oz, burst snapshots, …)
 * do not. The first non-swap action paints from x=0; a leading swap starts
 * occupancy at that swap (unknown predecessor).
 */
export function layoutFieldOccupancy(
  markers: readonly LaneMarkerLayout[],
  trackWidthPx: number,
): { spans: FieldSpanLayout[]; handoffs: FieldHandoffLayout[] } {
  const spans: FieldSpanLayout[] = [];
  const handoffs: FieldHandoffLayout[] = [];
  const end = Math.max(0, trackWidthPx);
  if (markers.length === 0 || !(end > 0)) return { spans, handoffs };

  let current: string | null = null;
  let startPx = 0;
  let established = false;

  const closeSpan = (x: number) => {
    if (current == null) return;
    const widthPx = x - startPx;
    if (widthPx > 0.5) {
      spans.push({ char: current, leftPx: startPx, widthPx });
    }
  };

  for (const marker of markers) {
    const incoming = swapIncomingChar(marker.event);
    if (!established) {
      if (incoming) {
        current = incoming;
        startPx = markerCenterX(marker);
      } else {
        current = marker.event.char;
        startPx = 0;
      }
      established = true;
      continue;
    }
    if (incoming == null || incoming === current) continue;
    const x = markerCenterX(marker);
    closeSpan(x);
    if (current != null) {
      handoffs.push({ fromChar: current, toChar: incoming, xPx: x });
    }
    current = incoming;
    startPx = x;
  }
  closeSpan(end);
  return { spans, handoffs };
}

export function spansForCharacter(
  spans: readonly FieldSpanLayout[],
  charKey: string,
): FieldSpanLayout[] {
  return spans.filter((s) => s.char === charKey);
}

/** Vertical connector in a viewBox of width `trackWidthPx`, height `laneCount`. */
export function fieldHandoffPath(
  xPx: number,
  fromIndex: number,
  toIndex: number,
): string {
  return `M ${xPx} ${fromIndex + 0.5} L ${xPx} ${toIndex + 0.5}`;
}
