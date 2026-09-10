/**
 * Weapon / artifact static tables.
 *
 * JSON is loaded via dynamic import so layout / home chunks do not pay for
 * ~400KB of weapons data. Call `ensureEquipmentData()` (or rely on the
 * auto-start when this module is first imported) before reading the maps.
 * `equipmentVersion` bumps after load so Svelte dependents can re-derive.
 */
import { writable } from "svelte/store";
import { weaponIconUrl } from "$lib/asset-urls";
import { buildGoodKeyMap } from "$lib/utils";

export interface WeaponData {
  id: number;
  name: string;
  stars: number;
  weaponType: string;
  icon: string;
  awakenIcon: string;
  splashIcon: string;
  /** Ascended base ATK at level 90. */
  baseAtk: number;
  /** Secondary stat at level 90, or null. */
  subStat: {
    propType: string;
    label: string;
    value: number;
    isPercent: boolean;
  } | null;
  /** Text refinements R1–R5 (empty when none). */
  refinements: { rank: number; description: string }[];
}

export interface ArtifactSetData {
  id: number;
  name: string;
  icon: string;
  bonuses: { needCount: number; description: string }[];
}

/** Populated in place after `ensureEquipmentData()` resolves. */
export const weaponByKey = new Map<string, WeaponData>();

/** Same rows as `weaponByKey`, keyed by numeric game id. */
export const weaponById = new Map<number, WeaponData>();

/** Populated in place after `ensureEquipmentData()` resolves. */
export const artifactSetByKey = new Map<string, ArtifactSetData>();

/** Bumps when maps finish loading — subscribe in $derived for reactivity. */
export const equipmentVersion = writable(0);

let weaponKeysByLength: string[] = [];
let loadPromise: Promise<void> | null = null;

/**
 * Load weapons + artifact JSON into the shared maps (idempotent / coalesced).
 */
export function ensureEquipmentData(): Promise<void> {
  if (weaponByKey.size > 0 && artifactSetByKey.size > 0) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const [weaponsMod, artifactsMod] = await Promise.all([
      import("$lib/data/weapons.json"),
      // Descriptions are copied from game files (Hoyoverse wording as-is,
      // including awkward clauses like Scarlet Proof’s Stellar Swirl 4pc).
      import("$lib/data/artifact-sets.json"),
    ]);
    const weaponsRaw =
      (weaponsMod as { default?: WeaponData[] }).default ??
      (weaponsMod as unknown as WeaponData[]);
    const artifactSetsRaw =
      (artifactsMod as { default?: ArtifactSetData[] }).default ??
      (artifactsMod as unknown as ArtifactSetData[]);

    weaponByKey.clear();
    weaponById.clear();
    for (const [key, value] of buildGoodKeyMap(weaponsRaw)) {
      weaponByKey.set(key, value);
      weaponById.set(value.id, value);
    }
    artifactSetByKey.clear();
    for (const [key, value] of buildGoodKeyMap(artifactSetsRaw)) {
      artifactSetByKey.set(key, value);
    }
    weaponKeysByLength = [...weaponByKey.keys()].sort(
      (a, b) => b.length - a.length,
    );
    equipmentVersion.update((n) => n + 1);
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

// Start loading as soon as any consumer imports this module (code-split JSON).
void ensureEquipmentData().catch(() => {
  /* page / tooltip will retry via ensureEquipmentData() */
});

/**
 * Displayable icon URL for a GOOD weapon key.
 * Null while the tables are still loading, for unknown keys, and for weapons
 * without an awaken icon — the single source of truth for "icon is shown".
 */
export function weaponIconSrc(weaponKey: string): string | null {
  const weapon = weaponByKey.get(weaponKey);
  if (!weapon?.awakenIcon) return null;
  return weaponIconUrl(weapon.awakenIcon);
}

/**
 * True only for known 5★ weapons. Missing keys are treated as not-5★.
 */
export function isFiveStarWeapon(weaponKey: string): boolean {
  const weapon = weaponByKey.get(weaponKey);
  return weapon?.stars === 5;
}

/**
 * Refinement rank to show in UI.
 * When the weapon icon is visible, use the sim's actual refinement.
 * When it isn't, any non-5★ weapon falls back to R0 (community baseline).
 */
export function displayWeaponRefinement(
  weaponKey: string,
  refinement: number,
  opts?: { weaponShown?: boolean },
): number {
  if (opts?.weaponShown) return refinement;
  return isFiveStarWeapon(weaponKey) ? refinement : 0;
}

/**
 * Format constellation + refinement when the weapon itself isn't shown.
 * Non-5★ weapons use R0 in that case.
 */
export function formatInvestmentCR(
  cons: number,
  refinement: number,
  weaponKey: string,
): string {
  return `C${cons}R${displayWeaponRefinement(weaponKey, refinement)}`;
}

/**
 * Replace GOOD weapon keys in an investment sim label with display names.
 * When `characterByKey` is provided, character GOOD keys are replaced too
 * (longest-first so compound keys win).
 *
 * ``fiveStarWeaponsAs: "R1"`` — limited/signature 5★ keys become ``R1``
 * instead of the weapon name (vertical upgrades; non-sig 5★s live under
 * ``owned`` and should keep ``"name"``).
 */
export function humanizeInvestmentLabel(
  label: string,
  characterByKey?: Map<string, string>,
  opts?: { fiveStarWeaponsAs?: "name" | "R1" },
): string {
  if (!label) return label;
  const fiveStarAs = opts?.fiveStarWeaponsAs ?? "name";
  let out = label;
  for (const key of weaponKeysByLength) {
    if (!out.includes(key)) continue;
    if (fiveStarAs === "R1" && isFiveStarWeapon(key)) {
      out = out.split(key).join("R1");
      continue;
    }
    const name = weaponByKey.get(key)?.name;
    if (!name) continue;
    out = out.split(key).join(name);
  }
  if (characterByKey?.size) {
    const keys = [...characterByKey.keys()].sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (!out.includes(key)) continue;
      const name = characterByKey.get(key);
      if (!name) continue;
      out = out.split(key).join(name);
    }
  }
  return out;
}
