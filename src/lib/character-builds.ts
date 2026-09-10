/**
 * Character Builds-tab display transforms.
 *
 * Pure helpers so the character page stays props → $derived → markup.
 */

import {
  clampSubstatRolls,
  computeBuildSheetStats,
  isArtifactSubstatKey,
} from "$lib/build-stats";
import { translateStatKey } from "$lib/utils";
import {
  CONSTELLATION_UPGRADE,
  LEVEL_UPGRADE,
  SIGNATURE_UPGRADE,
  TALENT_UPGRADE,
  classifyUpgradeImpact,
  impactForTier,
  primaryUpgradePct,
  resolveUpgradeImpact,
  type UpgradeImpactLadder,
  type UpgradeTier,
} from "$lib/upgrade-priority";
import type {
  CharacterBuild,
  CharacterBuildExample,
  CharacterConsGain,
  CharacterGuidePriority,
  CharacterIndex,
  CharacterSigGain,
  CharacterTalentImportance,
  CharacterVerticalGain,
  CharacterWeaponRank,
  ImpactTierScale,
  TalentSlot,
} from "$lib/types/investment";

export const MAIN_STAT_SLOTS = [
  { key: "sands" as const, label: "Sands" },
  { key: "goblet" as const, label: "Goblet" },
  { key: "circlet" as const, label: "Circlet" },
];

export const TALENT_SLOT_LABELS: Record<TalentSlot, string> = {
  auto: "Normal",
  skill: "Skill",
  burst: "Burst",
};

/** Map investment talent slots → kit skill types for icons. */
export const TALENT_SLOT_TO_KIT: Record<TalentSlot, string> = {
  auto: "normal",
  skill: "skill",
  burst: "burst",
};

export type RecommendedSubstatSource =
  "guide" | "checklist" | "high" | "delta" | "mid" | "main";

export type RecommendedSubstat = {
  key: string;
  /** High liquid mean, mid→high delta, or 0 for main-only chips. */
  mean: number;
  matchesMain: boolean;
  mainSlots: string[];
  /** True when ``mean`` is a mid→high OptimFull allocation delta. */
  isDelta: boolean;
  /** Which Builds payload branch produced this chip. */
  source: RecommendedSubstatSource;
  /** Team count stamped with that source (for tooltips). */
  teams: number;
};

/** Tooltip phrase for a recommended-substat source. */
export function recommendedSubstatSourceLabel(
  source: RecommendedSubstatSource,
): string {
  if (source === "checklist" || source === "delta") {
    return "avg mid→high liquid";
  }
  if (source === "high") return "avg high liquid";
  return "avg liquid rolls";
}

function mainSlotsBySubstatKey(builds: CharacterIndex): Map<string, string[]> {
  const mainSlots = new Map<string, string[]>();
  for (const slot of MAIN_STAT_SLOTS) {
    for (const s of builds.main_stats?.[slot.key] ?? []) {
      if (!isArtifactSubstatKey(s.key)) continue;
      const list = mainSlots.get(s.key) ?? [];
      list.push(slot.label);
      mainSlots.set(s.key, list);
    }
  }
  return mainSlots;
}

function sortRecommendedSubstats(
  rows: Iterable<RecommendedSubstat>,
): RecommendedSubstat[] {
  return [...rows].sort((a, b) => {
    if (a.matchesMain !== b.matchesMain) return a.matchesMain ? -1 : 1;
    if (a.mean !== b.mean) return b.mean - a.mean;
    return a.key.localeCompare(b.key);
  });
}

function putRecommended(
  byKey: Map<string, RecommendedSubstat>,
  key: string,
  mean: number,
  slots: string[],
  source: RecommendedSubstatSource,
  teams: number,
) {
  byKey.set(key, {
    key,
    mean,
    matchesMain: slots.length > 0,
    mainSlots: slots,
    isDelta: source === "checklist" || source === "delta",
    source,
    teams,
  });
}

/**
 * Recommended substats:
 * - Non-negligible: absolute high OptimFull liquids
 *   (``high_substat_rolls_liquid``)
 * - Negligible (``stat_recommendations.mode === "checklist"``): mid→high
 *   liquid movers only (``delta_stats`` — same rule as Stat-goal
 *   ``goal_substats``)
 * - Plus mains that can also roll as substats
 *
 * Guide merges may fill mid ``ranked`` with mean 0 when there are no measured
 * teams — keep those editorial ranks. Older CDN rows fall back to mid liquid
 * ranks above the 0.5 noise floor.
 */
export function recommendedSubstatsFromBuilds(
  builds: CharacterIndex | null | undefined,
): RecommendedSubstat[] {
  if (!builds) return [];
  const mainSlots = mainSlotsBySubstatKey(builds);
  const byKey = new Map<string, RecommendedSubstat>();
  const rec = builds.stat_recommendations;
  const high = builds.high_substat_rolls_liquid;
  const liquid = builds.substat_rolls_liquid;
  const ranked = liquid?.ranked ?? [];
  const midTeams = liquid?.teams ?? 0;
  // Guide merges stamp mid ranks with teams=0; only take that path when ranks exist.
  // Empty/missing liquid must not block checklist delta_stats.
  const guideAuthoredSubs = midTeams <= 0 && ranked.length > 0;
  const negligible = rec?.mode === "checklist";

  if (guideAuthoredSubs) {
    for (const r of ranked) {
      if (!isArtifactSubstatKey(r.key)) continue;
      putRecommended(
        byKey,
        r.key,
        r.mean,
        mainSlots.get(r.key) ?? [],
        "guide",
        midTeams,
      );
    }
  } else if (negligible && rec) {
    for (const row of rec.delta_stats) {
      if (!isArtifactSubstatKey(row.key)) continue;
      if (!(row.mean_delta > 0)) continue;
      putRecommended(
        byKey,
        row.key,
        row.mean_delta,
        mainSlots.get(row.key) ?? [],
        "checklist",
        rec.teams,
      );
    }
  } else if (high && high.teams > 0) {
    for (const r of high.ranked) {
      if (!isArtifactSubstatKey(r.key)) continue;
      if (r.mean <= 0.5 && !mainSlots.has(r.key)) continue;
      putRecommended(
        byKey,
        r.key,
        r.mean,
        mainSlots.get(r.key) ?? [],
        "high",
        high.teams,
      );
    }
  } else if (rec?.mode === "delta") {
    // High liquid missing (older CDN): fall back to stamped deltas.
    for (const row of rec.delta_stats) {
      if (!isArtifactSubstatKey(row.key)) continue;
      if (!(row.mean_delta > 0)) continue;
      putRecommended(
        byKey,
        row.key,
        row.mean_delta,
        mainSlots.get(row.key) ?? [],
        "delta",
        rec.teams,
      );
    }
  } else {
    for (const r of ranked) {
      if (!isArtifactSubstatKey(r.key)) continue;
      if (r.mean <= 0.5 && !mainSlots.has(r.key)) continue;
      putRecommended(
        byKey,
        r.key,
        r.mean,
        mainSlots.get(r.key) ?? [],
        "mid",
        midTeams,
      );
    }
  }

  for (const [key, slots] of mainSlots) {
    if (byKey.has(key)) continue;
    putRecommended(byKey, key, 0, slots, "main", 0);
  }

  return sortRecommendedSubstats(byKey.values());
}

/** Weapons: BT strength → teams → measured sigs → rarity → name. */
export function rankWeaponsByRarityAndTeams(
  weapons: CharacterWeaponRank[] | null | undefined,
  getStars: (key: string) => number,
  preferredKeys?: ReadonlySet<string> | readonly string[] | null,
): CharacterWeaponRank[] {
  if (!weapons?.length) return [];
  const preferred =
    preferredKeys instanceof Set ? preferredKeys : new Set(preferredKeys ?? []);
  return [...weapons].sort((a, b) => {
    const sa = a.strength;
    const sb = b.strength;
    const aHasStrength = sa != null;
    const bHasStrength = sb != null;
    if (aHasStrength !== bHasStrength) return aHasStrength ? -1 : 1;
    if (aHasStrength && bHasStrength && sa !== sb) return sb - sa;
    if (a.teams !== b.teams) return b.teams - a.teams;
    const pa = preferred.has(a.key) ? 0 : 1;
    const pb = preferred.has(b.key) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const ra = getStars(a.key);
    const rb = getStars(b.key);
    if (ra !== rb) return rb - ra;
    return a.key.localeCompare(b.key);
  });
}

export type VerticalImpactRow<T> = T & {
  pct: number;
  priority: UpgradeTier;
  priorityLabel: string;
};

/** Add the primary pct and its resolved impact to a vertical gain row. */
function attachImpact<T extends CharacterVerticalGain>(
  row: T,
  ladder: UpgradeImpactLadder,
  scale?: ImpactTierScale | null,
): VerticalImpactRow<T> {
  const pct = primaryUpgradePct(row.mean_pct_gain, row.median_pct_gain);
  const impact = resolveUpgradeImpact(row.tier, pct, ladder, scale);
  return {
    ...row,
    pct,
    priority: impact.tier,
    priorityLabel: impact.label,
  };
}

/**
 * Descending impact, with non-finite pct treated as last place. Subtracting
 * raw values would yield NaN and leave those rows in arbitrary positions.
 */
function compareByImpact(a: { pct: number }, b: { pct: number }): number {
  const aOk = Number.isFinite(a.pct);
  const bOk = Number.isFinite(b.pct);
  if (!aOk || !bOk) return aOk === bOk ? 0 : aOk ? -1 : 1;
  return b.pct - a.pct;
}

function impactScale(
  builds: CharacterIndex | null | undefined,
  key: "talents" | "constellations" | "sig_weapons",
): ImpactTierScale | null | undefined {
  return builds?.impact_tiers?.[key];
}

/** Constellations in source order with their display-ready impact. */
export function constellationImpactRows(
  constellations: CharacterConsGain[] | null | undefined,
  scale?: ImpactTierScale | null,
): VerticalImpactRow<CharacterConsGain>[] {
  if (!constellations?.length) return [];
  return constellations.map((row) =>
    attachImpact(row, CONSTELLATION_UPGRADE, scale),
  );
}

/** Signature weapons ranked by primary gain, with display-ready impact. */
export function rankSigWeaponsByGain(
  sigWeapons: CharacterSigGain[] | null | undefined,
  scale?: ImpactTierScale | null,
): VerticalImpactRow<CharacterSigGain>[] {
  if (!sigWeapons?.length) return [];
  return sigWeapons
    .map((row) => attachImpact(row, SIGNATURE_UPGRADE, scale))
    .sort((a, b) => compareByImpact(a, b) || a.key.localeCompare(b.key));
}

export type TalentImportanceRow = {
  slot: TalentSlot;
  label: string;
  icon: string | null;
  priority: UpgradeTier;
  priorityLabel: string;
  pct: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  teams: number;
};

/**
 * Talent priority rows from measured simulation data. Prefer merge-stamped
 * impact tiers; fall back to the talent ladder when `tier` is absent.
 */
export function talentImportanceRows(
  talentImportance: CharacterTalentImportance | null | undefined,
  resolveSkillIcon: (kitType: string) => string | null,
  scale?: ImpactTierScale | null,
): TalentImportanceRow[] {
  if (!talentImportance || talentImportance.teams <= 0) return [];

  const slots = ["auto", "skill", "burst"] as const;
  const rows = slots.flatMap((slot) => {
    const stats = talentImportance[slot];
    if (!stats) return [];
    const pct = primaryUpgradePct(stats.mean_pct_drop, stats.median_pct_drop);
    const impact = resolveUpgradeImpact(stats.tier, pct, TALENT_UPGRADE, scale);
    return [
      {
        slot,
        label: TALENT_SLOT_LABELS[slot],
        icon: resolveSkillIcon(TALENT_SLOT_TO_KIT[slot]),
        priority: impact.tier,
        priorityLabel: impact.label,
        pct,
        mean: stats.mean_pct_drop,
        median: stats.median_pct_drop,
        min: stats.min_pct_drop,
        max: stats.max_pct_drop,
        teams: talentImportance.teams,
      },
    ];
  });

  return rows.sort(
    (a, b) => compareByImpact(a, b) || a.slot.localeCompare(b.slot),
  );
}

export type LevelImportanceRow = {
  priority: UpgradeTier;
  priorityLabel: string;
  teams: number;
  mean: number;
  median: number;
  min: number;
  max: number;
};

/** Character level 90 importance from measured simulation data (90→80/90). */
export function levelImportanceFromBuilds(
  builds: CharacterIndex | null | undefined,
): LevelImportanceRow | null {
  return importanceRowFromSlot(builds?.level_importance);
}

/** Final-ascension importance from measured data (80/90→80/80). */
export function ascensionImportanceFromBuilds(
  builds: CharacterIndex | null | undefined,
): LevelImportanceRow | null {
  return importanceRowFromSlot(builds?.ascension_importance);
}

function importanceRowFromSlot(
  li: CharacterIndex["level_importance"] | undefined,
): LevelImportanceRow | null {
  if (!li || li.teams <= 0) return null;
  const pct = primaryUpgradePct(li.mean_pct_drop, li.median_pct_drop);
  const impact = classifyUpgradeImpact(pct, LEVEL_UPGRADE);
  return {
    priority: impact.tier,
    priorityLabel: impact.label,
    teams: li.teams,
    mean: li.mean_pct_drop,
    median: li.median_pct_drop,
    min: li.min_pct_drop,
    max: li.max_pct_drop,
  };
}

// ── Guide vs sim section selection ──────────────────────────────────────────

export type BuildsSectionSource = "sim" | "guide";

export type GuideTalentRow = {
  slot: TalentSlot;
  label: string;
  icon: string | null;
};

export type GuideConsRow = {
  cons: number;
  priority: UpgradeTier;
  priorityLabel: string;
};

export type GuideSigRow = {
  key: string;
  priority: UpgradeTier;
  priorityLabel: string;
};

/**
 * A guide only lists a constellation or signature when it is worth pulling for,
 * so those rows present at the vertical ladder's high band — the recommendation
 * itself is the claim, and no percentage stands behind it.
 */
const GUIDE_VERTICAL_IMPACT = impactForTier(CONSTELLATION_UPGRADE, "high");

/** Guide Level 90 recommendation borrows the level ladder's "Recommended" band. */
const GUIDE_LEVEL_IMPACT = impactForTier(LEVEL_UPGRADE, "solid");

/**
 * Whether an authored guide section should present instead of measured data.
 * Default fills gaps; override replaces only sections the guide authored.
 */
export function useGuideSection(
  guide: CharacterGuidePriority | null | undefined,
  hasGuide: boolean,
  hasSim: boolean,
): boolean {
  if (!guide || !hasGuide) return false;
  if (guide.override) return true;
  return !hasSim;
}

export type TalentPrioritySection =
  | { source: "sim"; rows: TalentImportanceRow[] }
  | { source: "guide"; simMissing: boolean; rows: GuideTalentRow[] };

export function talentPrioritySection(
  builds: CharacterIndex | null | undefined,
  resolveSkillIcon: (kitType: string) => string | null,
): TalentPrioritySection | null {
  const guide = builds?.guide_priority;
  const simRows = talentImportanceRows(
    builds?.talent_importance,
    resolveSkillIcon,
    impactScale(builds, "talents"),
  );
  const guideSlots = (guide?.talent_priority ?? []).filter(
    (slot): slot is TalentSlot =>
      Object.hasOwn(TALENT_SLOT_LABELS, slot) &&
      Object.hasOwn(TALENT_SLOT_TO_KIT, slot),
  );
  const preferGuide = useGuideSection(
    guide,
    guideSlots.length > 0,
    simRows.length > 0,
  );
  if (preferGuide) {
    return {
      source: "guide",
      simMissing: simRows.length === 0,
      rows: guideSlots.map((slot) => ({
        slot,
        label: TALENT_SLOT_LABELS[slot],
        icon: resolveSkillIcon(TALENT_SLOT_TO_KIT[slot]),
      })),
    };
  }
  if (simRows.length > 0) return { source: "sim", rows: simRows };
  return null;
}

export type LevelPrioritySection =
  | { source: "sim"; row: LevelImportanceRow }
  | {
      source: "guide";
      simMissing: boolean;
      priority: UpgradeTier;
      priorityLabel: string;
    };

export function levelPrioritySection(
  builds: CharacterIndex | null | undefined,
): LevelPrioritySection | null {
  const guide = builds?.guide_priority;
  const simRow = levelImportanceFromBuilds(builds);
  const preferGuide = useGuideSection(
    guide,
    guide?.level_90 === true,
    simRow != null,
  );
  if (preferGuide) {
    return {
      source: "guide",
      simMissing: simRow == null,
      priority: GUIDE_LEVEL_IMPACT.tier,
      priorityLabel: GUIDE_LEVEL_IMPACT.label,
    };
  }
  if (simRow) return { source: "sim", row: simRow };
  return null;
}

/** Sim-only final-ascension band (no guide override yet). */
export function ascensionPrioritySection(
  builds: CharacterIndex | null | undefined,
): LevelPrioritySection | null {
  const simRow = ascensionImportanceFromBuilds(builds);
  if (simRow) return { source: "sim", row: simRow };
  return null;
}

export type ConsPrioritySection =
  | { source: "sim"; rows: VerticalImpactRow<CharacterConsGain>[] }
  | { source: "guide"; simMissing: boolean; rows: GuideConsRow[] };

export function constellationPrioritySection(
  builds: CharacterIndex | null | undefined,
): ConsPrioritySection | null {
  const guide = builds?.guide_priority;
  const simRows = constellationImpactRows(
    builds?.vertical_importance?.constellations,
    impactScale(builds, "constellations"),
  );
  const guideCons = guide?.constellations ?? [];
  const preferGuide = useGuideSection(
    guide,
    guideCons.length > 0,
    simRows.length > 0,
  );
  if (preferGuide) {
    return {
      source: "guide",
      simMissing: simRows.length === 0,
      rows: [...guideCons]
        .sort((a, b) => a - b)
        .map((cons) => ({
          cons,
          priority: GUIDE_VERTICAL_IMPACT.tier,
          priorityLabel: GUIDE_VERTICAL_IMPACT.label,
        })),
    };
  }
  if (simRows.length > 0) return { source: "sim", rows: simRows };
  return null;
}

export type SigPrioritySection =
  | { source: "sim"; rows: VerticalImpactRow<CharacterSigGain>[] }
  | { source: "guide"; simMissing: boolean; rows: GuideSigRow[] };

export function sigWeaponPrioritySection(
  builds: CharacterIndex | null | undefined,
): SigPrioritySection | null {
  const guide = builds?.guide_priority;
  const simRows = rankSigWeaponsByGain(
    builds?.vertical_importance?.sig_weapons,
    impactScale(builds, "sig_weapons"),
  );
  const guideSigs = guide?.sig_weapons ?? [];
  const preferGuide = useGuideSection(
    guide,
    guideSigs.length > 0,
    simRows.length > 0,
  );
  if (preferGuide) {
    return {
      source: "guide",
      simMissing: simRows.length === 0,
      rows: guideSigs.map((key) => ({
        key,
        priority: GUIDE_VERTICAL_IMPACT.tier,
        priorityLabel: GUIDE_VERTICAL_IMPACT.label,
      })),
    };
  }
  if (simRows.length > 0) return { source: "sim", rows: simRows };
  return null;
}

const REACTION_LABELS: Record<string, string> = {
  melt: "Melt",
  vaporize: "Vaporize",
  overload: "Overload",
  electrocharged: "Electro-Charged",
  superconduct: "Superconduct",
  freeze: "Freeze",
  shatter: "Shatter",
  bloom: "Bloom",
  hyperbloom: "Hyperbloom",
  burgeon: "Burgeon",
  burning: "Burning",
  spread: "Spread",
  aggravate: "Aggravate",
  quicken: "Quicken",
  lunarcharged: "Lunar-Charged",
  swirl: "Swirl",
  "swirl-pyro": "Swirl (Pyro)",
  "swirl-hydro": "Swirl (Hydro)",
  "swirl-electro": "Swirl (Electro)",
  "swirl-cryo": "Swirl (Cryo)",
  "swirl-anemo": "Swirl (Anemo)",
  "swirl-dendro": "Swirl (Dendro)",
  "swirl-geo": "Swirl (Geo)",
};

/** Display label for a single reaction bucket name. */
export function formatReactionName(name: string): string {
  if (!name) return name;
  const known = REACTION_LABELS[name.toLowerCase()];
  if (known) return known;
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Fingerprint like ``melt+vaporize`` → ``Melt + Vaporize``. */
export function formatReactionFingerprint(
  fingerprint: string | null | undefined,
): string {
  if (!fingerprint) return "No reactions";
  return fingerprint
    .split("+")
    .map((part) => formatReactionName(part.trim()))
    .join(" + ");
}

export type LiquidRollChip = { key: string; rolls: number };

/** Non-zero liquid rolls, highest first (for build-example chips). */
export function liquidRollChips(
  rolls: Record<string, number> | null | undefined,
  limit = 6,
): LiquidRollChip[] {
  if (!rolls) return [];
  return Object.entries(rolls)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([key, n]) => ({ key, rolls: n }))
    .sort((a, b) => b.rolls - a.rolls || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export type ExampleSheetRow = {
  /** Sheet / format key (e.g. ``critRate``, ``pyro_dmg_``). */
  key: string;
  /** GOOD key for ``statIconUrl``. */
  iconKey: string;
  label: string;
  value: number;
};

export type ExampleRollTier = "mid" | "high";

function sheetIconKey(stat: string): string {
  if (stat === "critRate") return "critRate_";
  if (stat === "critDMG") return "critDMG_";
  if (stat === "enerRech") return "enerRech_";
  if (stat === "heal") return "heal_";
  return stat;
}

/** True when the example carries a distinct high-invest roll sheet. */
export function exampleHasHighConfig(example: CharacterBuildExample): boolean {
  if (example.invest !== "high") return false;
  const rolls = example.high_substat_rolls;
  if (!rolls || typeof rolls !== "object") return false;
  return Object.keys(rolls).length > 0;
}

/** True when the example's baseline weapon is a Favonius piece. */
export function exampleUsesFavonius(example: CharacterBuildExample): boolean {
  const key = example.weapon?.key;
  return typeof key === "string" && key.toLowerCase().startsWith("favonius");
}

/**
 * Which sheet lines to show for a build example.
 *
 * - Mid / negligible: baseline **ER**, plus **CR** only when that team's
 *   baseline weapon is Fav; if sands / goblet / circlet share one main,
 *   include that main too
 * - High invest: **mains + pipeline ``goal_substats``** (team-specific
 *   mid→high liquid gainers). Older CDN rows without ``goal_substats`` fall
 *   back to clamped high liquids > 0.
 */
export function exampleRelevantGoodKeys(
  example: CharacterBuildExample,
  tier: ExampleRollTier = "mid",
): Set<string> {
  if (tier !== "high" || !exampleHasHighConfig(example)) {
    const keys = new Set<string>(["enerRech_"]);
    if (exampleUsesFavonius(example)) keys.add("critRate_");
    const uniformMain = uniformMainStatKey(example);
    if (uniformMain) keys.add(uniformMain);
    return keys;
  }
  const keys = new Set<string>();
  for (const slot of MAIN_STAT_SLOTS) {
    const k = example.main_stats?.[slot.key];
    if (typeof k === "string" && k) keys.add(k);
  }
  if (Array.isArray(example.goal_substats) && example.goal_substats.length > 0) {
    for (const k of example.goal_substats) {
      if (typeof k === "string" && k) keys.add(k);
    }
    return keys;
  }
  // Legacy CDN: no stamped gainers — show any positive high liquid.
  const highLiquid = clampSubstatRolls(
    example.high_substat_rolls_liquid,
    example.main_stats,
  );
  for (const [k, n] of Object.entries(highLiquid)) {
    if (n > 0) keys.add(k);
  }
  return keys;
}

/** Shared sands/goblet/circlet main, or null when they differ / are missing. */
function uniformMainStatKey(example: CharacterBuildExample): string | null {
  const mains = MAIN_STAT_SLOTS.map((slot) => example.main_stats?.[slot.key]);
  const first = mains[0];
  if (typeof first !== "string" || !first) return null;
  return mains.every((m) => m === first) ? first : null;
}

/**
 * Numerical sheet lines for mains + assigned substats only (not the full
 * default sheet). Flat/percent pairs collapse to one total (ATK, HP, DEF).
 */
export function exampleRelevantSheetRows(
  example: CharacterBuildExample,
  tier: ExampleRollTier = "mid",
): ExampleSheetRow[] {
  const relevant = exampleRelevantGoodKeys(example, tier);
  if (relevant.size === 0) return [];

  const sheet = computeBuildSheetStats(
    characterBuildFromExample(example, tier),
  );
  if (!sheet) return [];

  const rows: ExampleSheetRow[] = [];
  const push = (key: string, label: string, value: number) => {
    rows.push({ key, iconKey: sheetIconKey(key), label, value });
  };

  if (relevant.has("hp") || relevant.has("hp_")) {
    push("hp", "HP", sheet.hp);
  }
  if (relevant.has("atk") || relevant.has("atk_")) {
    push("atk", "ATK", sheet.atk);
  }
  if (relevant.has("def") || relevant.has("def_")) {
    push("def", "DEF", sheet.def);
  }
  if (relevant.has("eleMas")) {
    push("eleMas", "Elemental Mastery", sheet.eleMas);
  }
  if (relevant.has("critRate_")) {
    push("critRate", "CRIT Rate", sheet.critRate);
  }
  if (relevant.has("critDMG_")) {
    push("critDMG", "CRIT DMG", sheet.critDMG);
  }
  if (relevant.has("enerRech_")) {
    push("enerRech", "Energy Recharge", sheet.enerRech);
  }
  if (relevant.has("heal_")) {
    push("heal", translateStatKey("heal_"), sheet.heal);
  }

  for (const [key, value] of Object.entries(sheet.dmgBonus)
    .filter(([k, v]) => relevant.has(k) && v > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    push(key, translateStatKey(key), value);
  }

  return rows;
}

function isCompleteBuildExample(example: CharacterBuildExample): boolean {
  return (
    typeof example.key === "string" &&
    example.key.length > 0 &&
    typeof example.cons === "number" &&
    typeof example.level === "number" &&
    !!example.talents &&
    typeof example.talents.auto === "number" &&
    typeof example.talents.skill === "number" &&
    typeof example.talents.burst === "number"
  );
}

/** Examples that carry a full CharacterBuild payload (skip stale CDN rows). */
export function buildExamples(
  builds: CharacterIndex | null | undefined,
): CharacterBuildExample[] {
  const list = builds?.build_examples;
  if (!Array.isArray(list)) return [];
  return list.filter(isCompleteBuildExample);
}

/**
 * Party GOOD keys for an example. Prefer the stamped list; fall back to
 * parsing ``state_key`` (``Char~C0~Weapon~R1__…``) for older CDN rows.
 */
export function exampleTeamKeys(example: CharacterBuildExample): string[] {
  if (Array.isArray(example.characters) && example.characters.length > 0) {
    return example.characters;
  }
  if (!example.state_key) return [];
  return example.state_key
    .split("__")
    .map((part) => part.split("~")[0]?.trim() ?? "")
    .filter(Boolean);
}

/**
 * Pulls-style split: featured character first, then up to ``mateSlots`` mates
 * (null-padded so the strip stays fixed-width).
 */
export function exampleFeaturedAndMates(
  keys: readonly string[],
  featuredKey: string,
  mateSlots = 3,
): { featured: string | null; mates: (string | null)[] } {
  const featured = keys.find((k) => k === featuredKey) ?? keys[0] ?? null;
  const rest = featured ? keys.filter((k) => k !== featured) : [...keys];
  const mates: (string | null)[] = [];
  for (let i = 0; i < mateSlots; i++) {
    mates.push(rest[i] ?? null);
  }
  return { featured, mates };
}

/**
 * Sim configs sometimes stamp 5pc (on-set flower) or 3pc/1pc leftovers.
 * Real bonuses are only 2pc / 4pc — map 5→4, 3→2; drop 1pc.
 */
export function normalizeSetPieceCount(
  count: number | null | undefined,
): 2 | 4 | null {
  if (count == null || !Number.isFinite(count)) return null;
  const n = Math.trunc(count);
  if (n >= 4) return 4;
  if (n >= 2) return 2;
  return null;
}

/** Strip example metadata down to the shared InvestmentBuildCard shape. */
export function characterBuildFromExample(
  example: CharacterBuildExample,
  tier: ExampleRollTier = "mid",
): CharacterBuild {
  const useHigh = tier === "high" && exampleHasHighConfig(example);
  const mains = example.main_stats;
  const totals = useHigh
    ? (example.high_substat_rolls ?? {})
    : example.substat_rolls;
  const liquid = useHigh
    ? (example.high_substat_rolls_liquid ?? {})
    : example.substat_rolls_liquid;
  const setCount = normalizeSetPieceCount(example.set.count) ?? 4;
  const set2Count = example.set2
    ? normalizeSetPieceCount(example.set2_count ?? 2)
    : null;
  return {
    key: example.key,
    cons: example.cons,
    level: example.level,
    talents: example.talents,
    weapon: example.weapon,
    set: { key: example.set.key, count: setCount },
    set2: set2Count != null ? example.set2 : undefined,
    set2_count: set2Count ?? undefined,
    main_stats: mains,
    // OptimFull can over-allocate onto mains; clamp for sheet/goals display.
    substat_rolls: clampSubstatRolls(totals, mains),
    substat_rolls_liquid: clampSubstatRolls(liquid, mains),
  };
}
