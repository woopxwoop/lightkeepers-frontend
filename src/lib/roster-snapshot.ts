/**
 * Roster save snapshots.
 *
 * Capture a frozen clone + JSON *before* any await so a successful response
 * commits exactly what was sent, while later editor edits stay unsaved.
 */

import type {
  CharacterOwned,
  CharacterPortraitRef,
  InventoryArtifact,
  InventoryWeapon,
  RosterProgress,
} from "$lib/definitions";
import { cloneRosterProgress } from "$lib/roster-progress";
import {
  cloneInventoryArtifact,
  cloneInventoryWeapon,
} from "$lib/roster-inventory";

export const ROSTER_STORAGE_KEY = "charactersOwned";

export type RosterCapture = {
  /** Cloned roster frozen at capture time (including progress). */
  roster: CharacterOwned[];
  /** Stable JSON of `roster` for comparison / localStorage. */
  json: string;
  /** True when `current` no longer matches this capture. */
  differsFrom(current: CharacterOwned[]): boolean;
};

/** Clone the editor roster and freeze it for a pending save. */
export function captureRoster(roster: CharacterOwned[]): RosterCapture {
  const cloned = roster.map((c) => ({
    ...c,
    progress: cloneRosterProgress(c.progress),
  }));
  const json = JSON.stringify(cloned);
  return {
    roster: cloned,
    json,
    differsFrom(current) {
      return JSON.stringify(current) !== json;
    },
  };
}

/** Whether the editor differs from a previously saved JSON snapshot. */
export function rosterDiffersFromSnapshot(
  roster: CharacterOwned[],
  savedJson: string,
): boolean {
  return JSON.stringify(roster) !== savedJson;
}

/** Sync-relevant fields only — catalog metadata is ignored for local↔cloud compare. */
export type RosterSyncEntry = {
  name_id: string;
  isOwned: boolean;
  progress: RosterProgress | null;
};

/** Shared name_id ordering for sync entry projections. */
function compareNameId(a: { name_id: string }, b: { name_id: string }): number {
  return a.name_id < b.name_id ? -1 : a.name_id > b.name_id ? 1 : 0;
}

/** Normalize a hydrated roster for stable local↔cloud equality checks. */
export function toRosterSyncEntries(
  roster: CharacterOwned[],
): RosterSyncEntry[] {
  return roster
    .map((c) => ({
      name_id: c.name_id,
      isOwned: c.isOwned,
      progress: cloneRosterProgress(c.progress) ?? null,
    }))
    .sort(compareNameId);
}

/** True when owned flags or visible progress fields differ between two rosters. */
export function rostersDifferForSync(
  a: CharacterOwned[],
  b: CharacterOwned[],
): boolean {
  return diffRostersForSync(a, b).length > 0;
}

export type RosterSyncWeaponBits = {
  key: string;
  level: number;
  ascension: number;
  refinement: number;
};

export type RosterSyncProgressBits = {
  level: number;
  ascension: number;
  constellation: number;
  talents: string;
  weapon: RosterSyncWeaponBits | null;
};

export type RosterSyncDiff = {
  name_id: string;
  /** Display name from either side (prefers local). */
  name: string;
  /** Enough for CharacterIcon (prefers local row). */
  portrait: CharacterPortraitRef;
  ownedChanged: boolean;
  localOwned: boolean;
  cloudOwned: boolean;
  progressChanged: boolean;
  localProgress: RosterSyncProgressBits | null;
  cloudProgress: RosterSyncProgressBits | null;
};

function progressBits(
  progress: RosterProgress | null | undefined,
): RosterSyncProgressBits | null {
  if (!progress) return null;
  return {
    level: progress.level,
    ascension: progress.ascension,
    constellation: progress.constellation,
    talents: `${progress.talents.normal}/${progress.talents.skill}/${progress.talents.burst}`,
    weapon: progress.weapon
      ? {
          key: progress.weapon.key,
          level: progress.weapon.level,
          ascension: progress.weapon.ascension,
          refinement: progress.weapon.refinement,
        }
      : null,
  };
}

function sameWeaponBits(
  a: RosterSyncWeaponBits | null,
  b: RosterSyncWeaponBits | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.key === b.key &&
    a.level === b.level &&
    a.ascension === b.ascension &&
    a.refinement === b.refinement
  );
}

/** Structural equality for progressBits projections (null-safe). */
function sameProgressBits(
  a: RosterSyncProgressBits | null,
  b: RosterSyncProgressBits | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.level === b.level &&
    a.ascension === b.ascension &&
    a.constellation === b.constellation &&
    a.talents === b.talents &&
    sameWeaponBits(a.weapon, b.weapon)
  );
}

/** Per-character owned/progress deltas between local and cloud (unchanged omitted). */
export function diffRostersForSync(
  local: CharacterOwned[],
  cloud: CharacterOwned[],
): RosterSyncDiff[] {
  const localById = new Map(local.map((c) => [c.name_id, c]));
  const cloudById = new Map(cloud.map((c) => [c.name_id, c]));
  const nameIds = new Set([...localById.keys(), ...cloudById.keys()]);
  const diffs: RosterSyncDiff[] = [];

  for (const name_id of nameIds) {
    const localRow = localById.get(name_id);
    const cloudRow = cloudById.get(name_id);
    const localOwned = localRow?.isOwned ?? false;
    const cloudOwned = cloudRow?.isOwned ?? false;
    const localProgress = progressBits(localRow?.progress);
    const cloudProgress = progressBits(cloudRow?.progress);
    const ownedChanged = localOwned !== cloudOwned;
    const progressChanged = !sameProgressBits(localProgress, cloudProgress);
    if (!ownedChanged && !progressChanged) continue;
    const name = localRow?.name || cloudRow?.name || name_id;
    diffs.push({
      name_id,
      name,
      portrait: {
        name_id,
        name,
        element: localRow?.element ?? cloudRow?.element ?? null,
      },
      ownedChanged,
      localOwned,
      cloudOwned,
      progressChanged,
      localProgress,
      cloudProgress,
    });
  }

  diffs.sort((a, b) => {
    // Ownership-only first, then mixed, then progress-only — then name.
    const rank = (d: RosterSyncDiff) =>
      d.ownedChanged && !d.progressChanged
        ? 0
        : d.ownedChanged && d.progressChanged
          ? 1
          : 2;
    const byKind = rank(a) - rank(b);
    if (byKind !== 0) return byKind;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
  return diffs;
}

/** Persist roster JSON to localStorage. Returns false if storage is unavailable. */
export function writeRosterLocal(json: string): boolean {
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

/** POST a captured roster to `/api/roster`. Optional inventory slices ride along on GOOD import. */
export async function postRoster(
  roster: CharacterOwned[],
  inventory?: {
    weapons?: InventoryWeapon[];
    artifacts?: InventoryArtifact[];
  },
): Promise<
  | { ok: true; inventoryOmitted?: boolean }
  | { ok: false; status: number; message?: string }
> {
  const entries = roster.map((c) => {
    const entry: {
      name_id: string;
      isOwned: boolean;
      progress?: RosterProgress | null;
    } = {
      name_id: c.name_id,
      isOwned: c.isOwned,
    };
    if (c.progress !== undefined) {
      entry.progress = cloneRosterProgress(c.progress);
    }
    return entry;
  });
  const body: {
    roster: typeof entries;
    weapons?: InventoryWeapon[];
    artifacts?: InventoryArtifact[];
  } = { roster: entries };
  if (inventory?.weapons) {
    body.weapons = inventory.weapons.map(cloneInventoryWeapon);
  }
  if (inventory?.artifacts) {
    body.artifacts = inventory.artifacts.map(cloneInventoryArtifact);
  }
  const res = await fetch("/api/roster", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    let inventoryOmitted = false;
    try {
      const parsed = (await res.json()) as { inventoryOmitted?: unknown };
      inventoryOmitted = parsed.inventoryOmitted === true;
    } catch {
      /* ignore parse failures */
    }
    return inventoryOmitted
      ? { ok: true, inventoryOmitted: true }
      : { ok: true };
  }

  let message: string | undefined;
  try {
    const text = await res.text();
    if (text) {
      try {
        const parsed = JSON.parse(text) as { message?: unknown };
        message =
          typeof parsed.message === "string" && parsed.message
            ? parsed.message
            : text;
      } catch {
        message = text;
      }
    }
  } catch {
    /* ignore body read failures */
  }

  if (res.status === 400) {
    const sample = entries[0];
    console.error("[roster sync] 400 Bad Request", {
      message: message ?? "(no body)",
      count: entries.length,
      weapons: body.weapons?.length ?? 0,
      artifacts: body.artifacts?.length ?? 0,
      sampleKeys: sample ? Object.keys(sample) : [],
      sample,
    });
  }

  return { ok: false, status: res.status, message };
}
