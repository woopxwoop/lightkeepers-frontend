/**
 * Client bootstrap after layout SSR.
 *
 * seedClientStores — sync, safe during SSR/hydration (versions + local roster).
 * bootstrapClient — onMount only: warm /api/static, sync /api/roster if logged in.
 * Owned teams stay lazy (Abyss / Stygian / Pulls call ensureTeamsOwned).
 *
 * Roster sync on login:
 * - no cloud row → upload local
 * - cloud differs from local → confirm use-cloud vs upload-local
 * - same → no-op
 */

import { get } from "svelte/store";
import type { Character, CharacterOwned } from "$lib/definitions";
import { authClient } from "$lib/auth-client";
import {
  charactersOwned,
  charactersHydrated,
  initHasSavedRoster,
  setHasSavedRoster,
  setVersionNumbers,
  invalidateTeamsOwned,
  invalidateNearMissTeams,
  ensureStaticBoards,
} from "$lib/stores";
import { isNewCharacter } from "$lib/is-new-character";
import { isBetaCharacter } from "$lib/is-beta-character";
import { parseRosterProgress } from "$lib/roster-progress";
import {
  postRoster,
  rostersDifferForSync,
  writeRosterLocal,
} from "$lib/roster-snapshot";
import { promptRosterSyncConflict } from "$lib/app/roster-sync-conflict";

type LayoutHydration = {
  characters: Character[];
  abyssVersionNumber: number;
  stygianVersionNumber: number;
};

type CachedOwnedEntry = {
  name_id?: unknown;
  id?: unknown;
  isOwned?: unknown;
  progress?: unknown;
};

type CloudRosterFetch =
  | { status: "guest" }
  | { status: "error" }
  | { status: "missing"; userId: string }
  | { status: "ok"; userId: string; roster: CharacterOwned[] };

const ROSTER_FETCH_TIMEOUT_MS = 15_000;

/**
 * Reads and validates the cached roster from localStorage.
 *
 * Things that can go wrong (and how we handle them):
 * - localStorage unavailable (privacy mode / blocked / SecurityError): return undefined
 * - missing key: return undefined
 * - invalid JSON: return undefined
 * - schema drift (old shape, missing fields, different id types): ignore invalid entries
 * - partial/corrupted writes or manual edits: ignore invalid entries
 *
 * Fallback behavior: if anything is off, we default to "owned" for all characters
 * to preserve the pre-cache UX.
 */
function readOwnedCache(): CachedOwnedEntry[] | undefined {
  let cachedJSON: string | null = null;
  try {
    cachedJSON = localStorage.getItem("charactersOwned");
  } catch {
    return undefined;
  }

  if (!cachedJSON) return undefined;

  try {
    const parsed = JSON.parse(cachedJSON);
    if (!Array.isArray(parsed)) return undefined;
    return parsed.filter(
      (v): v is CachedOwnedEntry =>
        typeof v === "object" && v !== null && ("name_id" in v || "id" in v),
    );
  } catch {
    return undefined;
  }
}

function mergeOwnedFlags(
  characters: Character[],
  cachedOwned: CachedOwnedEntry[] | undefined,
): CharacterOwned[] {
  const defaultOwned = (c: Character): boolean => {
    // Recent releases and CB/unreleased rows default to not owned — the user
    // likely doesn't have them yet. Prevents auto-assigning owned for every
    // new/beta character that lands in the DB.
    if (isNewCharacter(c.released_at)) return false;
    if (isBetaCharacter(c.name_id, c.released_at)) return false;
    return true;
  };

  if (!cachedOwned) {
    return characters.map((c) => ({
      ...c,
      isOwned: defaultOwned(c),
      progress: null,
    }));
  }

  const normalized = cachedOwned.map((v) => ({
    name_id: "name_id" in v && v.name_id != null ? v.name_id : v.id,
    isOwned: v.isOwned,
    progress: parseRosterProgress(v.progress),
  }));

  return characters.map((c) => {
    const cached = normalized.find((x) => x.name_id === c.name_id);
    const isOwned =
      typeof cached?.isOwned === "boolean" ? cached.isOwned : defaultOwned(c);
    return {
      ...c,
      isOwned,
      progress: cached?.progress ?? null,
    };
  });
}

async function activeSessionUserId(): Promise<
  { status: "ok"; userId: string | null } | { status: "error" }
> {
  try {
    const { data: session } = await authClient.getSession();
    return { status: "ok", userId: session?.user?.id ?? null };
  } catch {
    return { status: "error" };
  }
}

async function fetchCloudRoster(
  characters: Character[],
): Promise<CloudRosterFetch> {
  try {
    const { data: session } = await authClient.getSession();
    const userId = session?.user?.id;
    if (!userId) return { status: "guest" };

    const res = await fetch("/api/roster", {
      signal: AbortSignal.timeout(ROSTER_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { status: "error" };
    const body: unknown = await res.json();
    if (body === null || typeof body !== "object" || !("roster" in body)) {
      return { status: "error" };
    }
    const roster = (body as { roster: unknown }).roster;
    if (roster === null) return { status: "missing", userId };
    if (!Array.isArray(roster)) return { status: "error" };
    if (roster.length === 0) return { status: "missing", userId };
    return {
      status: "ok",
      userId,
      roster: mergeOwnedFlags(characters, roster),
    };
  } catch {
    return { status: "error" };
  }
}

function applyCloudRoster(roster: CharacterOwned[]): void {
  charactersOwned.set(roster);
  writeRosterLocal(JSON.stringify(roster));
  setHasSavedRoster();
  invalidateTeamsOwned();
  invalidateNearMissTeams();
}

async function uploadLocalRoster(
  roster: CharacterOwned[],
): Promise<
  | { ok: true; inventoryOmitted?: boolean }
  | { ok: false; status: number; message?: string }
> {
  const result = await postRoster(roster);
  if (!result.ok) {
    console.error("[roster sync] upload failed", {
      status: result.status,
      message: result.message,
    });
  }
  return result;
}

function uploadFailureMessage(result: {
  status: number;
  message?: string;
}): string {
  return result.message
    ? `Upload failed (${result.status}): ${result.message}`
    : `Upload failed (${result.status}). Try again.`;
}

/**
 * Conflict popup → revalidate session → apply/upload.
 * Upload failures reopen the popup with an error so the user can retry.
 * `uploadRetry` is for missing-cloud upload failures (no “Use cloud” side).
 */
async function resolveRosterConflict(args: {
  userId: string;
  local: CharacterOwned[];
  cloud: CharacterOwned[];
  error?: string | null;
  uploadRetry?: boolean;
}): Promise<void> {
  let error: string | null = args.error ?? null;
  const uploadRetry = args.uploadRetry === true;

  for (;;) {
    const choice = await promptRosterSyncConflict(
      args.local,
      args.cloud,
      error,
      { uploadRetry },
    );

    // Dismiss needs no session revalidation — leave both sides unchanged.
    if (choice === "dismiss") return;

    error = null;

    const session = await activeSessionUserId();
    if (session.status === "error") {
      error = "Could not verify signed-in account. Try again.";
      continue;
    }
    if (session.userId !== args.userId) {
      return;
    }

    if (choice === "use-cloud") {
      if (uploadRetry) continue;
      applyCloudRoster(args.cloud);
      return;
    }

    const result = await uploadLocalRoster(args.local);
    if (result.ok) return;
    error = uploadFailureMessage(result);
  }
}

/**
 * Client-side hydration from root layout SSR data.
 * Full allTeams* lists are warmed via ensureStaticBoards (not layout HTML).
 */
export function seedClientStores(data: LayoutHydration): void {
  setVersionNumbers(data.abyssVersionNumber, data.stygianVersionNumber);

  initHasSavedRoster();

  const cachedOwned = readOwnedCache();
  const localRoster = mergeOwnedFlags(data.characters, cachedOwned);
  charactersOwned.set(localRoster);
  charactersHydrated.set(true);
}

/**
 * Seeds layout stores, syncs DB roster if logged in.
 * Owned teams + near-miss load lazily on Abyss / Stygian / Pulls.
 * Meta team boards warm in the background so home → /tools/abyss|stygian nav is snappy.
 */
export async function bootstrapClient(data: LayoutHydration): Promise<void> {
  seedClientStores(data);

  // Fire early — do not await; home stays interactive while boards warm.
  // Failures land in staticBoardsError for Abyss/Stygian retry UI.
  // Investment JSON is loaded on Teams / character routes (not every visit).
  void ensureStaticBoards();

  const cloud = await fetchCloudRoster(data.characters);
  if (cloud.status === "guest" || cloud.status === "error") return;

  const localRoster = get(charactersOwned);

  if (cloud.status === "missing") {
    const result = await uploadLocalRoster(localRoster);
    if (result.ok) {
      setHasSavedRoster();
      return;
    }
    await resolveRosterConflict({
      userId: cloud.userId,
      local: localRoster,
      cloud: [],
      error: uploadFailureMessage(result),
      uploadRetry: true,
    });
    return;
  }

  if (!rostersDifferForSync(localRoster, cloud.roster)) return;

  await resolveRosterConflict({
    userId: cloud.userId,
    local: localRoster,
    cloud: cloud.roster,
  });
}
