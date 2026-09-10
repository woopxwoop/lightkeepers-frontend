/**
 * Client stores + fetch helpers for roster-scoped data.
 *
 * The browser never talks to Supabase directly — everything goes through
 * `/api/*` so the service role key and caches stay on the server.
 *
 * Heavy meta boards: ensureStaticBoards() → GET /api/static
 * Owned teams:       ensureTeamsOwned()  → POST /api/teams
 * Pull suggestions:  ensureNearMissTeams() → POST /api/nearmiss
 * Stygian tier list: ensureTierList() → GET /api/tierlist
 *
 * Abyss/Stygian solution pager helpers: `$lib/board-solutions`
 * (not this file). Solver: `$lib/solver`.
 */

import { writable, derived, get, readable, type Writable } from "svelte/store";
import type {
  CharacterOwned,
  AbyssTeam,
  StygianTeam,
  AbyssEnemies,
  StygianEnemies,
  StygianSchedule,
  TierListPayload,
  StygianSolverMode,
  StygianClearDifficulty,
} from "$lib/definitions";
import {
  isStygianSolverMode,
  isStygianClearDifficulty,
  STYGIAN_CHEAP_CLEARS_DIFFICULTY,
  STYGIAN_SOLVER_MODE_DEFAULT,
} from "$lib/definitions";
import type {
  NearMissStygianTeam,
  NearMissPairTeam,
} from "$lib/pullSuggestions";
import { postJson } from "$lib/api/http";

// ── Version numbers ────────────────────────────────────────────────────────
// Populated from layout server data — no client-side fetch needed.
export let abyssVersionNumber = -1;
export let stygianVersionNumber = -1;

export function setVersionNumbers(abyss: number, stygian: number) {
  abyssVersionNumber = abyss;
  stygianVersionNumber = stygian;
}

export type IconStyle = "coop" | "enka" | "tcg";

export type ColorTheme = "dark" | "light";

/** CSS variable names that can be customized via the color picker. */
export const THEME_COLOR_KEYS = [
  "background-color",
  "foreground-color",
  "background-mid",
  "foreground-mid",
  "accent-1",
  "accent-2",
  "accent-3",
] as const;

export const DEFAULT_DARK_COLORS: Record<ThemeColorKey, string> = {
  "background-color": "#02060b",
  "foreground-color": "#f4f1e8",
  "background-mid": "#040d17",
  "foreground-mid": "#f3e6c9",
  "accent-1": "#d79a3e",
  "accent-2": "#f6d68a",
  "accent-3": "#ead7b0",
};

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

/**
 * Normalize a hex color to exactly 6-digit `#rrggbb`.
 * Handles 3-, 4-, 6-, and 8-digit formats. Drops alpha channels (4th/8th pair).
 * Returns the input unchanged if it doesn't look like hex.
 */
const HEX_COLOR_RE =
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function normalizeHexColor(hex: string): string {
  const match = HEX_COLOR_RE.exec(hex);
  if (!match) return hex;
  const digits = match[1];
  // Expand shorthand: "abc" → "aabbcc", "abcd" → "aabbcc" (drop alpha)
  if (digits.length === 3 || digits.length === 4) {
    const rgb = digits.slice(0, 3);
    return `#${rgb
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  // Drop alpha channel from 8-digit hex, pad short 6-digit
  return `#${digits.slice(0, 6).padEnd(6, "0")}`;
}

export type DisplayPreferences = {
  animationsEnabled: boolean;
  iconStyle: IconStyle;
  /** Lighthouse background on non-home pages (and home when apply-to-home is on). */
  backgroundEnabled: boolean;
  /**
   * When false (default), home always shows the lighthouse. When true, home
   * uses `backgroundEnabled` like every other page.
   */
  backgroundApplyToHome: boolean;
  colorTheme: ColorTheme;
  /** Overrides for individual CSS custom properties. Keyed without the `--` prefix. */
  themeColors: Partial<Record<ThemeColorKey, string>> | null;
  /** Stygian board seating: usage solver vs Fearless video clears. */
  stygianSolverMode: StygianSolverMode;
  /** Dire / Fearless filter for hybrid + video-clear seating. */
  stygianClearDifficulty: StygianClearDifficulty;
};

const defaultDisplayPreferences: DisplayPreferences = {
  animationsEnabled: true,
  iconStyle: "tcg",
  backgroundEnabled: false,
  backgroundApplyToHome: false,
  colorTheme: "dark",
  themeColors: null,
  stygianSolverMode: STYGIAN_SOLVER_MODE_DEFAULT,
  stygianClearDifficulty: STYGIAN_CHEAP_CLEARS_DIFFICULTY,
};

export const displayPreferences = writable<DisplayPreferences>({
  ...defaultDisplayPreferences,
});

export function initDisplayPreferences(): void {
  try {
    const saved = localStorage.getItem("displayPreferences");
    if (!saved) return;

    const parsed = JSON.parse(saved) as Partial<DisplayPreferences>;
    displayPreferences.set({
      animationsEnabled:
        typeof parsed.animationsEnabled === "boolean"
          ? parsed.animationsEnabled
          : defaultDisplayPreferences.animationsEnabled,
      iconStyle:
        parsed.iconStyle === "enka" ||
        parsed.iconStyle === "coop" ||
        parsed.iconStyle === "tcg"
          ? parsed.iconStyle
          : defaultDisplayPreferences.iconStyle,
      backgroundEnabled:
        typeof parsed.backgroundEnabled === "boolean"
          ? parsed.backgroundEnabled
          : defaultDisplayPreferences.backgroundEnabled,
      backgroundApplyToHome:
        typeof parsed.backgroundApplyToHome === "boolean"
          ? parsed.backgroundApplyToHome
          : defaultDisplayPreferences.backgroundApplyToHome,
      colorTheme:
        parsed.colorTheme === "dark" || parsed.colorTheme === "light"
          ? parsed.colorTheme
          : defaultDisplayPreferences.colorTheme,
      themeColors:
        typeof parsed.themeColors === "object" && parsed.themeColors !== null
          ? (Object.fromEntries(
              Object.entries(parsed.themeColors)
                .filter(
                  ([k, v]) =>
                    (THEME_COLOR_KEYS as readonly string[]).includes(k) &&
                    typeof v === "string" &&
                    HEX_COLOR_RE.test(v),
                )
                .map(([k, v]) => [k, normalizeHexColor(v as string)]),
            ) as Partial<Record<ThemeColorKey, string>>)
          : defaultDisplayPreferences.themeColors,
      stygianSolverMode: isStygianSolverMode(parsed.stygianSolverMode)
        ? parsed.stygianSolverMode
        : // Migrate former experimental boolean → video clears (scrape-labeled).
          (parsed as { stygianCheapClears?: unknown }).stygianCheapClears ===
            true
          ? "video"
          : defaultDisplayPreferences.stygianSolverMode,
      stygianClearDifficulty: isStygianClearDifficulty(
        parsed.stygianClearDifficulty,
      )
        ? parsed.stygianClearDifficulty
        : defaultDisplayPreferences.stygianClearDifficulty,
    });
  } catch {
    displayPreferences.set({ ...defaultDisplayPreferences });
  }
}

export function setDisplayPreferences(next: Partial<DisplayPreferences>): void {
  displayPreferences.update((current) => {
    const updated = { ...current, ...next };
    try {
      localStorage.setItem("displayPreferences", JSON.stringify(updated));
    } catch {
      // Ignore storage failures; the in-memory preference still applies.
    }
    return updated;
  });
}

/** Live background visibility for the current route. */
export const backgroundVisible = writable(true);

export function resolveBackgroundVisible(
  pathname: string,
  prefs: DisplayPreferences,
): boolean {
  if (pathname === "/" && !prefs.backgroundApplyToHome) return true;
  return prefs.backgroundEnabled;
}

export function syncBackgroundToPath(pathname: string): void {
  backgroundVisible.set(
    resolveBackgroundVisible(pathname, get(displayPreferences)),
  );
}

export function toggleBackgroundVisible(pathname: string): void {
  const prefs = get(displayPreferences);
  const next = !resolveBackgroundVisible(pathname, prefs);
  setDisplayPreferences({
    backgroundEnabled: next,
    ...(pathname === "/" ? { backgroundApplyToHome: true } : {}),
  });
  syncBackgroundToPath(pathname);
}

export function setBackgroundVisible(on: boolean, pathname: string): void {
  setDisplayPreferences({ backgroundEnabled: on });
  syncBackgroundToPath(pathname);
}

export function setBackgroundApplyToHome(
  apply: boolean,
  pathname: string,
): void {
  setDisplayPreferences({ backgroundApplyToHome: apply });
  syncBackgroundToPath(pathname);
}

export const isIconCompact = derived(
  displayPreferences,
  ($preferences) => $preferences.iconStyle === "enka",
);

export function setIconCompact(compact: boolean) {
  setDisplayPreferences({ iconStyle: compact ? "enka" : "coop" });
}

/** OS reduced-motion preference. Stays false during SSR. */
export const prefersReducedMotion = readable(false, (set) => {
  if (typeof window === "undefined" || !window.matchMedia) return;
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  set(query.matches);
  const onChange = (e: MediaQueryListEvent) => set(e.matches);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
});

/**
 * Whether animations actually run. `app.css` collapses every duration under
 * reduced motion, so JS timings must honour it too or they'll wait on
 * animations that already finished.
 */
export const animationsEnabled = derived(
  [displayPreferences, prefersReducedMotion],
  ([$preferences, $reduced]) => $preferences.animationsEnabled && !$reduced,
);

export function areAnimationsEnabled(): boolean {
  return get(animationsEnabled);
}

/** Designed lighthouse mark — same asset as the navbar logo. */
export const faviconDataUri = readable("/lightkeepers-mark.png");

// ── Character store ────────────────────────────────────────────────────────
export const charactersOwned = writable<CharacterOwned[]>([]);
export const charactersHydrated = writable<boolean>(false);

/** Whether the user has ever saved a roster. Persisted in localStorage. */
export const hasSavedRoster = writable<boolean>(false);

export function initHasSavedRoster(): void {
  try {
    if (localStorage.getItem("hasSavedRoster") === "true") {
      hasSavedRoster.set(true);
      return;
    }
    // Persisted roster without the flag (cloud apply, older clients).
    // Presence of `charactersOwned` means the user already configured ownership.
    if (localStorage.getItem("charactersOwned")) {
      setHasSavedRoster();
      return;
    }
    hasSavedRoster.set(false);
  } catch {
    // localStorage unavailable — assume not saved
  }
}

export function setHasSavedRoster(): void {
  hasSavedRoster.set(true);
  try {
    localStorage.setItem("hasSavedRoster", "true");
  } catch {}
}

// ── Abyss stores ──────────────────────────────────────────────────────────
export const teamsOwned = writable<AbyssTeam[]>([]);
export const teamsOwnedTop = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) =>
    $teamsOwned.filter(
      (team) =>
        (team.field_1_rate ?? 0) > 40 && (team.members ?? []).length === 4,
    ),
);
export const teamsOwnedBottom = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) =>
    $teamsOwned.filter(
      (team) =>
        (team.field_2_rate ?? 0) > 40 && (team.members ?? []).length === 4,
    ),
);

// ── Stygian stores ─────────────────────────────────────────────────────────
export const teamsOwnedStygian = writable<StygianTeam[]>([]);
export const teamsOwnedStygianTop = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($t) =>
  $t.filter(
    (team) =>
      (team.field_1_rate ?? 0) > 40 && (team.members ?? []).length === 4,
  ),
);
export const teamsOwnedStygianMiddle = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($t) =>
  $t.filter(
    (team) =>
      (team.field_3_rate ?? 0) > 40 && (team.members ?? []).length === 4,
  ),
);
export const teamsOwnedStygianBottom = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($t) =>
  $t.filter(
    (team) =>
      (team.field_2_rate ?? 0) > 40 && (team.members ?? []).length === 4,
  ),
);

// ── All-teams stores (warmed from /api/static; not shipped in page __data.json) ─
export const allTeamsAbyss = writable<AbyssTeam[]>([]);
export const allTeamsStygian = writable<StygianTeam[]>([]);

const emptyAbyssEnemies: AbyssEnemies = {
  top: [],
  bottom: [],
  buffName: null,
  openTime: null,
};
const emptyStygianEnemies: StygianEnemies = {
  top: null,
  middle: null,
  bottom: null,
};

export const abyssEnemiesBoard = writable<AbyssEnemies>(emptyAbyssEnemies);
export const stygianEnemiesBoard =
  writable<StygianEnemies>(emptyStygianEnemies);
export const stygianScheduleBoard = writable<StygianSchedule>(null);

/** True after a successful /api/static boards fetch (or empty payload). */
export const staticBoardsLoaded = writable(false);

/** Last warm-up failure; cleared on success or a new attempt. */
export const staticBoardsError = writable<string | null>(null);

/** True after a successful /api/teams fetch (or empty owned roster short-circuit). */
export const teamsOwnedLoaded = writable(false);

let staticBoardsInFlight: Promise<void> | null = null;
/** Versions the current allTeams* stores were fetched for. */
let staticBoardsAbyssVersion = -1;
let staticBoardsStygianVersion = -1;
/** Don't hammer /api/static while CDN/L1 is still on the previous cycle. */
let staticBoardsRetryAfterMs = 0;
let staticBoardsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let staticBoardsRetryAttempt = 0;
const STATIC_BOARDS_RETRY_BASE_MS = 30_000;
const STATIC_BOARDS_RETRY_MAX_MS = 5 * 60_000;

function staticBoardsMatchCurrentVersions(): boolean {
  return (
    get(staticBoardsLoaded) &&
    staticBoardsAbyssVersion === abyssVersionNumber &&
    staticBoardsStygianVersion === stygianVersionNumber
  );
}

function clearStaticBoardsRetry(): void {
  staticBoardsRetryAfterMs = 0;
  staticBoardsRetryAttempt = 0;
  if (staticBoardsRetryTimer != null) {
    clearTimeout(staticBoardsRetryTimer);
    staticBoardsRetryTimer = null;
  }
}

function scheduleStaticBoardsRetry(): void {
  if (staticBoardsRetryTimer != null) return;
  const base = Math.min(
    STATIC_BOARDS_RETRY_MAX_MS,
    STATIC_BOARDS_RETRY_BASE_MS * 2 ** staticBoardsRetryAttempt,
  );
  // Full jitter in [0, base] so clients don't retry in lockstep after a rollover.
  const delay = Math.floor(Math.random() * (base + 1));
  staticBoardsRetryAttempt += 1;
  staticBoardsRetryAfterMs = Date.now() + delay;
  staticBoardsRetryTimer = setTimeout(() => {
    staticBoardsRetryTimer = null;
    // Clear before invoke so a slightly-early timer isn't blocked by the gate.
    staticBoardsRetryAfterMs = 0;
    void ensureStaticBoards().catch(() => {});
  }, delay);
}

/**
 * Fetches the full meta team lists via /api/static and seeds the stores.
 * Kept out of abyss/stygian page loads so client navigations stay lean.
 * Coalesces concurrent callers; skips the network when boards already match
 * the current Abyss/Stygian version numbers.
 *
 * If CDN/L1 is still on the previous cycle after one cache-bust, seeds with
 * the payload's own version stamps (never pretends layout versions matched)
 * and retries on a backoff until current. While a retry is scheduled,
 * further callers return early until the backoff elapses — pass `{ force: true }`
 * (Retry UI) to clear backoff and fetch immediately.
 */
export async function ensureStaticBoards(opts?: {
  force?: boolean;
}): Promise<void> {
  if (opts?.force) {
    clearStaticBoardsRetry();
  }
  if (staticBoardsMatchCurrentVersions()) return;
  // Backoff after a stale/failed fetch — skip whether boards loaded or not.
  if (Date.now() < staticBoardsRetryAfterMs) return;
  if (staticBoardsInFlight) return staticBoardsInFlight;

  staticBoardsError.set(null);

  const pending = (async () => {
    try {
      const data = await fetchStaticBoardsPayload(false);
      if (applyStaticBoardsIfCurrent(data)) return;

      // Edge/CDN may still be serving the previous cycle — bust once.
      const fresh = await fetchStaticBoardsPayload(true);
      if (applyStaticBoardsIfCurrent(fresh)) return;

      // Still behind — show last cycle with honest stamps; match stays false.
      const abyssVer = fresh.latestAbyssVersion?.version_number;
      const stygianVer = fresh.latestStygianVersion?.version_number;
      if (typeof abyssVer === "number" && typeof stygianVer === "number") {
        applyStaticBoardsPayload(fresh, abyssVer, stygianVer);
      }
      scheduleStaticBoardsRetry();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load team boards";
      staticBoardsError.set(message);
      scheduleStaticBoardsRetry();
      throw err;
    }
  })();

  staticBoardsInFlight = pending;
  void pending
    .finally(() => {
      if (staticBoardsInFlight === pending) staticBoardsInFlight = null;
    })
    .catch(() => {});
  return pending;
}

type StaticBoardsPayload = {
  allTeamsAbyss?: AbyssTeam[];
  allTeamsStygian?: StygianTeam[];
  latestAbyssVersion?: { version_number?: number };
  latestStygianVersion?: { version_number?: number };
  abyssEnemies?: AbyssEnemies;
  stygianEnemies?: StygianEnemies;
  stygianSchedule?: StygianSchedule;
};

async function fetchStaticBoardsPayload(
  cacheBust: boolean,
): Promise<StaticBoardsPayload> {
  const url = cacheBust ? `/api/static?_=${Date.now()}` : "/api/static";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`static boards fetch failed: ${res.status}`);
  return (await res.json()) as StaticBoardsPayload;
}

/**
 * Apply boards only when the payload is not behind the *current* layout
 * version globals (re-read after each await). Returns false when versions
 * are present but stale so the caller can retry / reject.
 */
function applyStaticBoardsIfCurrent(data: StaticBoardsPayload): boolean {
  const currentAbyss = abyssVersionNumber;
  const currentStygian = stygianVersionNumber;
  const abyssVer = data.latestAbyssVersion?.version_number;
  const stygianVer = data.latestStygianVersion?.version_number;

  if (typeof abyssVer === "number" && typeof stygianVer === "number") {
    if (abyssVer < currentAbyss || stygianVer < currentStygian) {
      return false;
    }
    applyStaticBoardsPayload(data, abyssVer, stygianVer);
    return true;
  }

  // No version payload — keep whatever layout has now, still seed boards.
  applyStaticBoardsPayload(data, currentAbyss, currentStygian);
  return true;
}

function applyStaticBoardsPayload(
  data: StaticBoardsPayload,
  abyssVer: number,
  stygianVer: number,
): void {
  allTeamsAbyss.set(data.allTeamsAbyss ?? []);
  allTeamsStygian.set(data.allTeamsStygian ?? []);
  abyssEnemiesBoard.set(data.abyssEnemies ?? emptyAbyssEnemies);
  stygianEnemiesBoard.set(data.stygianEnemies ?? emptyStygianEnemies);
  stygianScheduleBoard.set(data.stygianSchedule ?? null);
  staticBoardsAbyssVersion = abyssVer;
  staticBoardsStygianVersion = stygianVer;
  // Never move layout versions backwards if something else advanced them.
  setVersionNumbers(
    Math.max(abyssVer, abyssVersionNumber),
    Math.max(stygianVer, stygianVersionNumber),
  );
  staticBoardsError.set(null);
  staticBoardsLoaded.set(true);
  if (
    staticBoardsAbyssVersion === abyssVersionNumber &&
    staticBoardsStygianVersion === stygianVersionNumber
  ) {
    clearStaticBoardsRetry();
  }
}

// ── Near-miss stores ───────────────────────────────────────────────────────
export const nearMissStygianTeams = writable<NearMissStygianTeam[]>([]);
export const nearMissStygianLoaded = writable(false);
export const nearMissPairTeams = writable<NearMissPairTeam[]>([]);
export const nearMissPairLoaded = writable(false);

// ── Request ID counters ────────────────────────────────────────────────────
// Discard responses from superseded requests (fast roster changes).
let teamsRequestId = 0;
let nearMissRequestId = 0;
let teamsInFlight: Promise<void> | null = null;

// ── Write functions ────────────────────────────────────────────────────────

/**
 * Clears owned-team stores so the next Abyss / Stygian / Pulls visit refetches.
 */
export function invalidateTeamsOwned(): void {
  teamsRequestId++;
  teamsInFlight = null;
  teamsOwnedLoaded.set(false);
  teamsOwned.set([]);
  teamsOwnedStygian.set([]);
}

/**
 * Fetches both abyss and stygian owned-team lists in a single server round-trip.
 * The server caches results by character list so rapid re-calls are cheap.
 */
export async function writeTeamsOwned(owned: CharacterOwned[]): Promise<void> {
  const id = ++teamsRequestId;
  const characters = owned.filter((c) => c.isOwned).map((c) => c.name_id);

  teamsOwnedLoaded.set(false);

  try {
    const { abyssTeams, stygianTeams } = await postJson<{
      abyssTeams: AbyssTeam[];
      stygianTeams: StygianTeam[];
    }>("/api/teams", {
      characters,
      abyssVersion: abyssVersionNumber,
      stygianVersion: stygianVersionNumber,
    });

    if (id !== teamsRequestId) return; // superseded
    teamsOwned.set(abyssTeams);
    teamsOwnedStygian.set(stygianTeams);
    teamsOwnedLoaded.set(true);
  } catch (err) {
    console.error("[stores] writeTeamsOwned failed:", err);
    if (id !== teamsRequestId) return;
    // Don't leave Abyss/Stygian on an infinite Loading gate — empty owned
    // lists let the solver fall through to allTeams / pull CTA.
    teamsOwned.set([]);
    teamsOwnedStygian.set([]);
    teamsOwnedLoaded.set(true);
    throw err;
  }
}

/**
 * Load owned teams only when needed (Abyss / Stygian / Pulls).
 * No-ops if already loaded; coalesces concurrent callers.
 */
export async function ensureTeamsOwned(owned: CharacterOwned[]): Promise<void> {
  if (get(teamsOwnedLoaded)) return;
  if (teamsInFlight) return teamsInFlight;
  const pending = writeTeamsOwned(owned);
  teamsInFlight = pending;
  // Consume rejection on the finally-derived promise so cleanup cannot
  // surface as an unhandled rejection; callers still await `pending`.
  void pending
    .finally(() => {
      if (teamsInFlight === pending) teamsInFlight = null;
    })
    .catch(() => {});
  return pending;
}

/**
 * Clears near-miss stores so the next /tools/pulls visit refetches.
 * Call after roster changes instead of eagerly hitting /api/nearmiss.
 */
export function invalidateNearMissTeams(): void {
  nearMissRequestId++;
  nearMissInFlight = null;
  nearMissStygianLoaded.set(false);
  nearMissPairLoaded.set(false);
  nearMissStygianTeams.set([]);
  nearMissPairTeams.set([]);
}

/**
 * Fetches near-miss data for the Pulls page.
 * Combines single + pair into one server call.
 */
export async function writeNearMissTeams(
  owned: CharacterOwned[],
): Promise<void> {
  const id = ++nearMissRequestId;
  const characters = owned.filter((c) => c.isOwned).map((c) => c.name_id);

  nearMissStygianLoaded.set(false);
  nearMissPairLoaded.set(false);

  try {
    const { nearMissTeams, nearMissPairs } = await postJson<{
      nearMissTeams: NearMissStygianTeam[];
      nearMissPairs: NearMissPairTeam[];
    }>("/api/nearmiss", {
      characters,
      stygianVersion: stygianVersionNumber,
      minPmi: 0.3,
    });

    if (id !== nearMissRequestId) return; // superseded
    nearMissStygianTeams.set(nearMissTeams);
    nearMissPairTeams.set(nearMissPairs);
    nearMissStygianLoaded.set(true);
    nearMissPairLoaded.set(true);
  } catch (err) {
    console.error("[stores] writeNearMissTeams failed:", err);
    // Leave loaded=false so ensureNearMissTeams can retry; rethrow for callers.
    throw err;
  }
}

/**
 * Load near-miss only when needed (Pulls page). No-ops if already loaded;
 * coalesces concurrent callers onto one in-flight request.
 */
let nearMissInFlight: Promise<void> | null = null;

export async function ensureNearMissTeams(
  owned: CharacterOwned[],
): Promise<void> {
  if (get(nearMissStygianLoaded) && get(nearMissPairLoaded)) return;
  if (nearMissInFlight) return nearMissInFlight;
  const pending = writeNearMissTeams(owned);
  nearMissInFlight = pending;
  void pending
    .finally(() => {
      if (nearMissInFlight === pending) nearMissInFlight = null;
    })
    .catch(() => {});
  return pending;
}

// ── Stygian tier list (roster-independent) ─────────────────────────────────
export const tierList = writable<TierListPayload | null>(null);
export const tierListLoaded = writable(false);
export const tierListError = writable<string | null>(null);

let tierListInFlight: Promise<void> | null = null;
let tierListRequestId = 0;

export function invalidateTierList(): void {
  tierListRequestId++;
  tierListInFlight = null;
  tierListLoaded.set(false);
  tierListError.set(null);
  tierList.set(null);
}

export async function ensureTierList(): Promise<void> {
  if (get(tierListLoaded)) return;
  if (tierListInFlight) return tierListInFlight;

  const id = ++tierListRequestId;
  tierListError.set(null);

  const pending = (async () => {
    try {
      const res = await fetch("/api/tierlist");
      if (!res.ok) throw new Error(`tierlist fetch failed: ${res.status}`);
      const data = (await res.json()) as TierListPayload;
      if (id !== tierListRequestId) return;
      tierList.set(data);
      tierListError.set(null);
      tierListLoaded.set(true);
    } catch (err) {
      if (id !== tierListRequestId) return;
      const message =
        err instanceof Error ? err.message : "Failed to load tier list";
      tierListError.set(message);
      console.error("[stores] ensureTierList failed:", err);
      throw err;
    }
  })();

  tierListInFlight = pending;
  void pending
    .finally(() => {
      if (tierListInFlight === pending) tierListInFlight = null;
    })
    .catch(() => {});
  return pending;
}
