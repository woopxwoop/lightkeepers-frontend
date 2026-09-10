// ── gcsim investment comparison types ────────────────────────────────────────
// Shape of investment.json.gz served from R2 (sim/investment.json.gz)

export interface InvestmentFile {
  teams: InvestmentTeam[];
  /** Sorted unique sim costs across all teams (merge-time). */
  available_costs?: number[];
}

export interface InvestmentTeam {
  version: number;
  team_key: string;
  team_name: string;
  /** Total cost to acquire the baseline team (limited5 = 1 copy each). */
  baseline_cost: number;
  /** Character keys in the team, sorted alphabetically. */
  characters: string[];
  /**
   * Characters for whom this team's floor-tier DPS (`results[0]`) is their
   * global best (merge-time). Ties include all winners.
   */
  is_best_for?: string[];
  /**
   * Per exact cost: characters for whom this team's DPS at that cost is best.
   * Keys are cost strings (e.g. `"2"`).
   */
  is_best_for_at_cost?: Record<string, string[]>;
  /** All simulated investment levels for this team, sorted by cost → dps descending. */
  results: InvestmentSim[];
}

export type SimKind = "baseline" | "f2p" | "owned" | "vertical" | "talent";

export interface InvestmentSim {
  /** Stable key: characters sorted, Char~C{cons}~{weapon}, joined by __ */
  state_key: string;
  /**
   * Human-readable label.
   * - baseline: full config (every char C / weapon / R)
   * - f2p / owned / vertical: diffs from baseline only (e.g. "Flins C1", "Aino C2")
   */
  label: string;
  /**
   * baseline = canonical starting build;
   * f2p = floor-cost alternative (free weapon / 4★ budget cons, etc.);
   * owned = already-owned 5★ weapon alt (+1 cost, vs baseline — not a pull rung);
   * vertical = limited-pull upgrades (extra cost above floor);
   * talent = one-step talent drop from baseline (single char, one talent at 1).
   */
  kind: SimKind;
  /** Total cost in limited5 copies (baseline + upgrades). */
  cost: number;
  /** Simulated DPS from gcsim. */
  dps: number;
  /** Per-character build snapshot for this simulation. */
  characters: CharacterBuild[];
  /** Baseline reaction profile (merge pass-through from summary). */
  reactions?: TeamReactionProfile;
}

export interface CharacterBuild {
  key: string;
  cons: number;
  weapon: {
    key: string;
    refinement: number;
    level: number;
  };
  set: {
    key: string;
    count: number;
  };
  /** Second 2pc set when running 2pc/2pc (flat fields from pipeline summaries). */
  set2?: string;
  set2_count?: number;
  main_stats: {
    sands: string;
    goblet: string;
    circlet: string;
  };
  level: number;
  talents: {
    auto: number;
    skill: number;
    burst: number;
  };
  /**
   * Total substat rolls from gcsim OptimFull (`stat=*N` in config).
   * Includes the fixed baseline (default 2 per substat).
   * Keys are GOOD StatKey values (e.g. critDMG_, atk_).
   */
  substat_rolls?: Record<string, number>;
  /** Liquid rolls only (total minus fixed baseline of 2). */
  substat_rolls_liquid?: Record<string, number>;
}

/** Windowed dropoff impact bands (same vocabulary as Builds upgrade tiers). */
export type ImportanceImpactTier =
  "exceptional" | "high" | "solid" | "modest" | "negligible";

/** Shape of `output/characters.json` (aggregate character summaries). */
export interface CharacterIndexFile {
  characters: Record<string, CharacterIndex>;
  /** Roster-level impact bucket floors + labels (also copied onto each character). */
  impact_tiers?: ImpactTiersMeta;
}

/** One impact scale: inclusive % floors and display labels (k may be 3–5). */
export interface ImpactTierScale {
  bucket_count?: number | null;
  floors: Partial<Record<ImportanceImpactTier, number>>;
  labels: Partial<Record<ImportanceImpactTier, string>>;
}

/**
 * Merge-time impact buckets uploaded with character summaries.
 * Each upgrade axis has its own floors (talents vs cons vs sigs vs artifacts).
 */
export interface ImpactTiersMeta {
  talents: ImpactTierScale;
  constellations: ImpactTierScale;
  sig_weapons: ImpactTierScale;
  artifacts: ImpactTierScale;
}

export interface CharacterIndex {
  key: string;
  /**
   * Stamped at merge from gcsim `characters.json`.
   * - `true` (or omitted on old payloads): current sim/guide index
   * - `false` with weapons/sets: summary exists but teams are stale (kit buff)
   * - `false` without a body: tombstone so R2 overwrites a dropped summary
   */
  upToDate?: boolean;
  /**
   * Roster impact bucket definitions (embedded on per-character CDN JSON so
   * Builds can label stamped tiers without fetching the full index).
   */
  impact_tiers?: ImpactTiersMeta;
  /**
   * Weapons ranked by Bradley–Terry strength (same-team weapon one-steps),
   * then team count. Baseline weapons always count; F2P / owned alts only
   * count teams where that config beats baseline DPS; vertical/sig weapons
   * still count every appearance.
   */
  weapons: CharacterWeaponRank[];
  /**
   * Artifact sets from each team's baseline sim only
   * (one vote per team). Ranked by team count; `count` is 2 or 4 pieces.
   */
  sets: CharacterSetRank[];
  /**
   * Per-slot main-stat frequency from each team's baseline sim only
   * (one vote per team). Ranked by team count.
   */
  main_stats: {
    sands: CharacterStatRank[];
    goblet: CharacterStatRank[];
    circlet: CharacterStatRank[];
  };
  /**
   * Mean OptimFull liquid rolls: average f2p + bp_limited-weapon configs
   * within a team, then average those team-means across teams.
   */
  substat_rolls_liquid?: CharacterLiquidSubstats;
  /**
   * Mean high OptimFull (30/18/1) liquid allocations across artifact-importance
   * teams. Preferred source for Recommended substats (rebalance signal).
   */
  high_substat_rolls_liquid?: CharacterLiquidSubstats;
  /**
   * How much DPS drops when each talent is lowered to 1 (others stay baseline),
   * aggregated across teams. Character level is tracked separately.
   */
  talent_importance?: CharacterTalentImportance;
  /**
   * How much DPS drops when the character runs at level 80/90 (talents stay
   * baseline), aggregated across teams.
   */
  level_importance?: CharacterLevelImportance;
  /**
   * How much DPS drops from final ascension at level 80 (80/90 vs 80/80 as a
   * % of the 80/90 rung), aggregated across teams that have both samples.
   */
  ascension_importance?: CharacterLevelImportance;
  /**
   * One-step gains: constellations are stepwise vs the previous constellation
   * (C2 vs C1), covering rungs below the team baseline as well as above it;
   * sig weapons are vs baseline. Combined cons+sig and multi-char results are
   * excluded.
   */
  vertical_importance?: CharacterVerticalImportance;
  /**
   * One-hot high-invest artifact gain vs mid baseline (30/18/1 on this character,
   * others at pipeline mid OptimFull). Aggregated across teams at merge from
   * `artifact_importance.py` reports. Negative per-team gains are floored to 0.
   */
  artifact_importance?: CharacterArtifactImportance;
  /**
   * Stat goals from mid→high OptimFull allocation deltas (+ ER if burst, CR if Fav).
   * Negligible artifact impact collapses to the ER/Fav checklist only.
   * Character-level summary — prefer ``build_examples`` for team/archetype views.
   */
  stat_recommendations?: CharacterStatRecommendations;
  /**
   * One example per reaction fingerprint (highest baseline DPS), capped.
   * `invest: mid` (negligible) → baseline ER (+ CR if that example uses Fav);
   * `high` → mains + pipeline ``goal_substats`` (team mid→high gainers).
   * Shown on the character Builds tab.
   */
  build_examples?: CharacterBuildExample[];
  /**
   * Editorial upgrade recommendations from a hand-authored guide.
   * Published separately from measured `*_importance` statistics; the Builds
   * UI fills missing sim sections by default, or replaces authored sections
   * when `override` is true.
   */
  guide_priority?: CharacterGuidePriority;
  /** Optional editorial blurb from hand-authored guide (merge-time). */
  notes?: string;
}

/** Compact team reaction profile from baseline gcsim ``-out`` extract. */
export interface TeamReactionProfile {
  rps: number | null;
  /** Which signal ranked the list. */
  metric: "damage" | "count";
  list: TeamReactionEntry[];
  primary: string | null;
  /** Diversity key, e.g. ``melt`` or ``melt+vaporize``. */
  fingerprint: string | null;
}

export interface TeamReactionEntry {
  name: string;
  damage: number;
  count: number;
  share: number;
}

/** Condensed near-mean gcsim action timeline (CDN rotation.json.gz). */
export type RotationAction =
  | "swap"
  | "skill"
  | "hold_skill"
  | "burst"
  | "attack"
  | "charge"
  | "aim"
  | "dash"
  | "jump"
  | "walk"
  | "low_plunge"
  | "high_plunge"
  | "wait"
  | "delay"
  | "other";

export interface RotationSampleEvent {
  /** Seconds from sim start. */
  t: number;
  /** GOOD key when known, else gcsim alias. */
  char: string;
  action: RotationAction;
  /** Swap target alias when action is swap. */
  label?: string;
}

export interface RotationSample {
  seed: string;
  sample_dps: number;
  /** Saved summary mean DPS used as search target. */
  target_dps: number;
  /** |sample_dps - target_dps| / target_dps */
  rel_err: number;
  attempts: number;
  duration_s: number;
  /** Party order from the sample (GOOD keys when mapped). */
  characters: string[];
  events: RotationSampleEvent[];
  /** `# generated:` hash from config.txt when present. */
  config_hash?: string;
}

export type TalentSlot = "auto" | "skill" | "burst";

/**
 * Hand-authored upgrade recommendations. No percentages or impact labels —
 * order / selection is the editorial signal.
 */
export interface CharacterGuidePriority {
  /** When true, authored sections replace sim sections (omitted sections never override). */
  override: boolean;
  /** Talent slots in recommended priority order. */
  talent_priority?: TalentSlot[];
  /** Recommend raising the character to level 90. */
  level_90?: true;
  /** Recommended constellation stopping points (ascending). */
  constellations?: number[];
  /** Signature weapon GOOD keys in recommendation order. */
  sig_weapons?: string[];
}

export interface CharacterTalentSlotImportance {
  /** Average % DPS drop vs baseline across teams. */
  mean_pct_drop: number;
  /** Median % DPS drop vs baseline across teams. */
  median_pct_drop: number;
  /** Smallest % DPS drop on any contributing team. */
  min_pct_drop: number;
  /** Largest % DPS drop on any contributing team. */
  max_pct_drop: number;
  /**
   * Merge-time impact bucket from the joint talent+cons pool cutoffs.
   * Null when this slot was not scored.
   */
  tier?: ImportanceImpactTier | null;
}

export interface CharacterTalentImportance {
  /** Teams with baseline + all three talent drops for this character. */
  teams: number;
  auto: CharacterTalentSlotImportance;
  skill: CharacterTalentSlotImportance;
  burst: CharacterTalentSlotImportance;
  /** Talent slots ranked by mean % drop (highest first). */
  priority: TalentSlot[];
}

export interface CharacterLevelImportance extends CharacterTalentSlotImportance {
  /** Teams with a level-80 (or ascension) drop sample for this character. */
  teams: number;
}

export interface CharacterVerticalGain {
  /** Teams that contributed a one-step vertical sample for this entry. */
  teams: number;
  /** Average % DPS gain vs that team's baseline. */
  mean_pct_gain: number;
  /** Median % DPS gain vs that team's baseline. */
  median_pct_gain: number;
  /** Smallest % DPS gain on any contributing team. */
  min_pct_gain: number;
  /** Largest % DPS gain on any contributing team. */
  max_pct_gain: number;
  /**
   * Merge-time impact bucket from shared talent+cons cutoff floors.
   * Null when this entry was not scored.
   */
  tier?: ImportanceImpactTier | null;
}

export interface CharacterConsGain extends CharacterVerticalGain {
  /** Absolute constellation level reached (e.g. 1 for C1). Gain is vs C{cons-1}. */
  cons: number;
}

export interface CharacterSigGain extends CharacterVerticalGain {
  /** Signature weapon GOOD key. */
  key: string;
}

export interface CharacterVerticalImportance {
  /** Cons-only upgrades, sorted by cons ascending. May start at C1. */
  constellations: CharacterConsGain[];
  /** Sig-weapon-only upgrades, sorted by mean gain descending. */
  sig_weapons: CharacterSigGain[];
}

/** Gain from juicing this character's artifacts (high OptimFull) while teammates stay mid. */
export interface CharacterArtifactImportance {
  teams: number;
  mean_pct_gain: number;
  median_pct_gain: number;
  min_pct_gain: number;
  max_pct_gain: number;
  /**
   * Merge-time impact bucket from successive largest-dropoff cuts on mean_pct_gain.
   * Null when no samples.
   */
  tier?: ImportanceImpactTier | null;
}

/**
 * Derived farm targets: mid→high liquid movers, plus conditional ER/Fav overlays.
 * ``checklist`` mode (negligible artifact impact) still stamps ``delta_stats``
 * for Recommended substats; report tables only show the ER/Fav overlays.
 */
export interface CharacterStatRecommendations {
  mode: "delta" | "checklist";
  delta_stats: Array<{
    key: string;
    mean_delta: number;
    teams_positive: number;
  }>;
  enerRech_if_burst: boolean;
  critRate_if_fav: boolean;
  teams: number;
  burst_teams: number;
  fav_teams: number;
}

/** One concrete team build example for a character (CDN character index). */
export interface CharacterBuildExample {
  team_key: string;
  team_name: string;
  /** GOOD keys for the full party (order matches the sim). */
  characters: string[];
  state_key: string;
  reactions: TeamReactionProfile;
  /**
   * ``mid`` = negligible artifact impact → UI shows baseline ER (+ CR if Fav).
   * ``high`` = otherwise → UI shows high OptimFull sheet from mains +
   * ``goal_substats`` (team mid→high liquid gainers).
   */
  invest: "mid" | "high";
  artifact_pct_gain: number;
  /** Featured character GOOD key (same shape as ``CharacterBuild``). */
  key: string;
  cons: number;
  level: number;
  talents: CharacterBuild["talents"];
  weapon: CharacterBuild["weapon"];
  set: CharacterBuild["set"];
  set2?: string;
  set2_count?: number;
  main_stats: CharacterBuild["main_stats"];
  /** Baseline (mid-invest) OptimFull total rolls. */
  substat_rolls: Record<string, number>;
  substat_rolls_liquid: Record<string, number>;
  /** High-invest OptimFull totals when ``invest === "high"``. */
  high_substat_rolls?: Record<string, number>;
  high_substat_rolls_liquid?: Record<string, number>;
  /**
   * Substat keys that gained liquid rolls mid→high on this team (pipeline).
   * Stat goals show mains + these; full high rolls stay for sheet math.
   */
  goal_substats?: string[];
}

/** @deprecated Use {@link ImportanceImpactTier}. */
export type ArtifactImportanceTier = ImportanceImpactTier;

export interface CharacterWeaponRank {
  key: string;
  teams: number;
  /**
   * Bradley–Terry strength from same-team pairwise DPS among baseline +
   * one-weapon-step configs. Higher = stronger. Omitted on older payloads.
   */
  strength?: number;
}

export interface CharacterSetRank {
  key: string;
  /** Piece count bucket: 2 (from 2–3) or 4 (from 4–5). */
  count: number;
  teams: number;
}

export interface CharacterStatRank {
  key: string;
  teams: number;
}

export interface CharacterLiquidSubstats {
  /** Teams that contributed at least one liquid sample. */
  teams: number;
  /** Total configs averaged before the per-team collapse. */
  configs: number;
  mean: Record<string, number>;
  ranked: Array<{ key: string; mean: number }>;
}
