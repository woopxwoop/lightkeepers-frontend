/** Client fetch for research → /api/research proxy. */

import type {
  InventoryArtifact,
  InventoryWeapon,
  RosterProgress,
} from "$lib/definitions";
import type {
  ResearchArtifactOption,
  ResearchOwnedCharacter,
  ResearchOwnedWeapon,
  ResearchRankItem,
  ResearchRequest,
  ResearchResponse,
  ResearchLlmProvider,
} from "$lib/research-types";

/**
 * Match server research-agent budget. Two LLM passes (corpus + personalize)
 * routinely land in 15–40s; retries can push higher.
 */
const RESEARCH_FETCH_TIMEOUT_MS = 180_000;

/** Soft caps aligned with agent ResearchRequest max_length (after weapon dedupe). */
const MAX_OWNED_CHARACTERS = 200;
const MAX_OWNED_WEAPONS = 300;

/** Minimal roster row for research personalization mapping. */
export type ResearchRosterCharacter = {
  isOwned: boolean;
  name_id: string;
  progress?: RosterProgress | null;
};

export type ResearchPersonalizationFields = Pick<
  ResearchRequest,
  "roster_name_ids" | "owned_characters" | "owned_weapons" | "personalize"
>;

/** Owned GOOD keys for client-side Build panel inventory join. */
export type ResearchOwnedGearKeys = {
  weapons: Set<string>;
  artifactSets: Set<string>;
};

export type ResearchOwnedRankRow<T extends { key: string }> = T & {
  owned: boolean;
  /** Highest-rank owned key in this list (first owned by ascending rank). */
  bestOwned: boolean;
};

function mapOwnedWeapon(
  weapon: Pick<InventoryWeapon, "key" | "level" | "ascension" | "refinement">,
  copies = 1,
): ResearchOwnedWeapon {
  const row: ResearchOwnedWeapon = {
    key: weapon.key,
    refinement: weapon.refinement,
    level: weapon.level,
    ascension: weapon.ascension,
  };
  if (copies > 1) row.copies = copies;
  return row;
}

function mapOwnedCharacter(
  character: ResearchRosterCharacter,
  weaponCopiesByKey?: ReadonlyMap<string, number>,
): ResearchOwnedCharacter {
  const row: ResearchOwnedCharacter = { name_id: character.name_id };
  const progress = character.progress;
  if (!progress) return row;
  row.constellation = progress.constellation;
  row.level = progress.level;
  row.ascension = progress.ascension;
  row.talents = { ...progress.talents };
  if (progress.weapon) {
    const copies = weaponCopiesByKey?.get(progress.weapon.key) ?? 1;
    row.weapon = mapOwnedWeapon(progress.weapon, copies);
  } else {
    row.weapon = null;
  }
  return row;
}

/**
 * Build agent personalization fields from local roster (+ optional inventory).
 * Empty owned roster → `{ personalize: false }` with no owned payloads.
 * Inventory is deduped by GOOD key (best R + copy count). Keys equipped on a
 * character are omitted from `owned_weapons` but their total copies are attached
 * to that character's weapon.
 *
 * @deprecated Agent ignores personalize / owned_* — prefer
 * {@link collectOwnedResearchGearKeys} + {@link annotateOwnedRankRows} on the client.
 */
export function buildResearchPersonalization(input: {
  characters: ReadonlyArray<ResearchRosterCharacter>;
  inventoryWeapons?: ReadonlyArray<InventoryWeapon> | null;
}): ResearchPersonalizationFields {
  const owned = input.characters.filter((c) => c.isOwned);
  if (owned.length === 0) {
    return { personalize: false };
  }

  // Total copies + best instance per GOOD key across the full bag.
  const copiesByKey = new Map<string, number>();
  const bestByKey = new Map<
    string,
    Pick<InventoryWeapon, "key" | "level" | "ascension" | "refinement">
  >();
  for (const weapon of input.inventoryWeapons ?? []) {
    if (!weapon.key) continue;
    copiesByKey.set(weapon.key, (copiesByKey.get(weapon.key) ?? 0) + 1);
    const prev = bestByKey.get(weapon.key);
    if (!prev || weapon.refinement > prev.refinement) {
      bestByKey.set(weapon.key, weapon);
    }
  }

  const owned_characters = owned
    .slice(0, MAX_OWNED_CHARACTERS)
    .map((c) => mapOwnedCharacter(c, copiesByKey));
  const roster_name_ids = owned_characters.map((c) => c.name_id);
  const equippedKeys = new Set(
    owned_characters
      .map((c) => c.weapon?.key)
      .filter((key): key is string => Boolean(key)),
  );

  const fields: ResearchPersonalizationFields = {
    personalize: true,
    roster_name_ids,
    owned_characters,
  };

  if (!input.inventoryWeapons?.length) return fields;

  const extras: ResearchOwnedWeapon[] = [];
  for (const [key, best] of [...bestByKey.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    if (equippedKeys.has(key)) continue;
    extras.push(mapOwnedWeapon(best, copiesByKey.get(key) ?? 1));
    if (extras.length >= MAX_OWNED_WEAPONS) break;
  }
  if (extras.length > 0) {
    fields.owned_weapons = extras;
  }
  return fields;
}

/** Case-fold helper for GOOD key membership (agent may return display-ish casing). */
function gearKeyFold(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

/**
 * Collect owned weapon GOOD keys + artifact set keys from local inventory
 * (and equipped weapons on roster progress). Used only for Build panel badges —
 * never sent to the research agent.
 */
export function collectOwnedResearchGearKeys(input: {
  inventoryWeapons?: ReadonlyArray<InventoryWeapon> | null;
  inventoryArtifacts?: ReadonlyArray<InventoryArtifact> | null;
  characters?: ReadonlyArray<{
    progress?: { weapon?: { key: string } | null } | null;
  } | null>;
}): ResearchOwnedGearKeys {
  const weapons = new Set<string>();
  const artifactSets = new Set<string>();
  for (const weapon of input.inventoryWeapons ?? []) {
    if (weapon.key) weapons.add(weapon.key);
  }
  for (const character of input.characters ?? []) {
    const key = character?.progress?.weapon?.key;
    if (key) weapons.add(key);
  }
  for (const artifact of input.inventoryArtifacts ?? []) {
    if (artifact.setKey) artifactSets.add(artifact.setKey);
  }
  return { weapons, artifactSets };
}

function ownedSetHas(owned: ReadonlySet<string>, key: string): boolean {
  if (owned.has(key)) return true;
  const fold = gearKeyFold(key);
  for (const candidate of owned) {
    if (gearKeyFold(candidate) === fold) return true;
  }
  return false;
}

/**
 * Annotate rank / option rows with owned vs unowned and mark the best owned
 * (lowest rank number among owned keys; for unranked options, first owned).
 */
export function annotateOwnedRankRows<
  T extends { key: string; rank?: number },
>(
  rows: ReadonlyArray<T>,
  ownedKeys: ReadonlySet<string>,
): ResearchOwnedRankRow<T>[] {
  let bestOwnedKey: string | null = null;
  for (const row of rows) {
    if (!ownedSetHas(ownedKeys, row.key)) continue;
    bestOwnedKey = row.key;
    break;
  }
  const bestFold = bestOwnedKey ? gearKeyFold(bestOwnedKey) : null;
  return rows.map((row) => {
    const owned = ownedSetHas(ownedKeys, row.key);
    return {
      ...row,
      owned,
      bestOwned: owned && bestFold !== null && gearKeyFold(row.key) === bestFold,
    };
  });
}

/** Convenience: annotate weapon ranks + artifact ranks/options for BuildPanel. */
export function joinBuildInventory(input: {
  weapon_ranks: ReadonlyArray<ResearchRankItem>;
  artifact_ranks: ReadonlyArray<ResearchRankItem>;
  artifact_options: ReadonlyArray<ResearchArtifactOption>;
  owned: ResearchOwnedGearKeys;
}): {
  weapons: ResearchOwnedRankRow<ResearchRankItem>[];
  artifacts: ResearchOwnedRankRow<ResearchRankItem>[];
  options: ResearchOwnedRankRow<ResearchArtifactOption>[];
} {
  return {
    weapons: annotateOwnedRankRows(input.weapon_ranks, input.owned.weapons),
    artifacts: annotateOwnedRankRows(
      input.artifact_ranks,
      input.owned.artifactSets,
    ),
    options: annotateOwnedRankRows(
      input.artifact_options,
      input.owned.artifactSets,
    ),
  };
}

function parseApiError(status: number, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return `HTTP ${status}`;
  try {
    const payload = JSON.parse(trimmed) as {
      message?: string;
      detail?: string | { msg?: string }[];
    };
    if (typeof payload.message === "string" && payload.message) {
      return payload.message;
    }
    if (typeof payload.detail === "string" && payload.detail) {
      return payload.detail;
    }
    if (Array.isArray(payload.detail)) {
      const msgs = payload.detail
        .map((d) => d?.msg)
        .filter((m): m is string => typeof m === "string" && Boolean(m));
      if (msgs.length > 0) return msgs.join("; ");
    }
  } catch {
    // plain text / html from upstream
  }
  return trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed;
}

function parseOkJson<T>(status: number, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(parseApiError(status, text));
  }
}

function rethrowResearchFetchError(err: unknown): never {
  if (
    (err instanceof Error && err.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "TimeoutError")
  ) {
    throw new Error("Research request timed out.");
  }
  throw err instanceof Error ? err : new Error("Research request failed");
}

export async function postResearchChat(
  body: ResearchRequest,
): Promise<ResearchResponse> {
  let res: Response;
  try {
    res = await fetch("/api/research", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RESEARCH_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    rethrowResearchFetchError(err);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(res.status, text));
  }

  return parseOkJson<ResearchResponse>(res.status, text);
}

/**
 * Character Build button → dedicated Build view. No inventory / personalize.
 * Agent fills the question when omitted.
 */
export async function postResearchBuild(
  focusNameId: string,
  opts?: { llm_provider?: ResearchLlmProvider },
): Promise<ResearchResponse> {
  return postResearchChat({
    topic: "build",
    focus_name_ids: [focusNameId],
    answer_style: "concise",
    llm_provider: opts?.llm_provider,
  });
}

export type ResearchProxyHealth = {
  configured: boolean;
  agentUrl: string | null;
  agent: {
    ok: boolean;
    body?: unknown;
    geminiConfigured?: boolean;
    deepseekConfigured?: boolean;
    defaultLlmProvider?: ResearchLlmProvider;
    error?: string;
  };
};

export async function fetchResearchProxyHealth(): Promise<ResearchProxyHealth> {
  let res: Response;
  try {
    res = await fetch("/api/research", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    rethrowResearchFetchError(err);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseApiError(res.status, text));
  }
  return parseOkJson<ResearchProxyHealth>(res.status, text);
}
