/**
 * Client fetch for character usage/top-team analytics.
 */

import type {
  CharacterAnalyticsMode,
  CharacterAnalyticsPayload,
} from "$lib/definitions";

const FETCH_TIMEOUT_MS = 15_000;

/** Last successful payload per mode+id — for instant paint only, not a fetch short-circuit. */
const analyticsCache = new Map<string, CharacterAnalyticsPayload>();

export function analyticsCacheKey(
  mode: CharacterAnalyticsMode,
  nameId: string,
): string {
  return `${mode}:${nameId}`;
}

/** Resolved payload if already loaded for this mode+id; otherwise null. */
export function getCharacterAnalyticsCached(
  key: string,
): CharacterAnalyticsPayload | null {
  return analyticsCache.get(key) ?? null;
}

function setCharacterAnalyticsCached(
  key: string,
  payload: CharacterAnalyticsPayload,
): void {
  analyticsCache.set(key, payload);
}

/** Caller-initiated abort (`AbortController.abort`), not timeout. */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/** `AbortSignal.timeout` reason — keep distinct from caller aborts. */
export function isTimeoutError(err: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    err instanceof DOMException &&
    err.name === "TimeoutError"
  );
}

/** Always hits the network; updates the seed cache on success. */
export async function fetchCharacterAnalytics(
  nameId: string,
  mode: CharacterAnalyticsMode,
  signal?: AbortSignal,
): Promise<CharacterAnalyticsPayload> {
  const key = analyticsCacheKey(mode, nameId);
  const params = new URLSearchParams({ nameId, mode });
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const combined =
    signal !== undefined ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await fetch(`/api/character-analytics?${params}`, {
    signal: combined,
  });
  if (!res.ok) {
    throw new Error(`character-analytics HTTP ${res.status}`);
  }
  const payload = (await res.json()) as CharacterAnalyticsPayload;
  setCharacterAnalyticsCached(key, payload);
  return payload;
}
