/**
 * Types matching lightkeepers-agent POST /v1/research.
 *
 * ## Answer embeddings (hydrateable mentions)
 *
 * `answer_markdown` may contain double-bracket tokens. The agent validates them
 * and returns matching rows in `entities[]` (unknown tokens are stripped to
 * plain text). UI should replace each `[[key]]` with a chip / link / icon using
 * the entity whose `key` equals the token body (no brackets).
 *
 * Token forms (from lightkeepers-agent `research/entities.py`)::
 *
 *     [[char:Xingqiu]]
 *     [[c:Xingqiu:6]]              // constellation C-index 1–6; kit anchor T{id}
 *     [[s:Xingqiu:burst]]          // skill slot: normal | skill | burst
 *     [[s:Xingqiu:10385]]         // or numeric skill id (GameText LINK#S…)
 *     [[p:Xingqiu:252101]]         // passive numeric id (LINK#P…)
 *     [[weapon:StaffOfHoma]]       // GOOD-style key or display name
 *     [[set:EmblemOfSeveredFate]]  // artifact set GOOD-style key or display name
 *     [[cite:2297]]                  // guide chunk id — superscript + footnote in UI
 *
 * Legacy `[2297]` / `[2297, 2300]` in prose is normalized to `[[cite:…]]` by the agent.
 *
 * ### Displaying assets
 *
 * Prefer `entity.icon` (a `UI_*` stem) via `$lib/asset-urls`:
 *
 * | `entity.type`   | typical `icon` prefix     | helper                         |
 * |-----------------|---------------------------|--------------------------------|
 * | character       | `UI_AvatarIcon_*` etc.    | `assetUrl` / portrait helpers  |
 * | skill           | `UI_SkillIcon_*`          | `skillIconUrl` / `assetUrl`    |
 * | constellation   | `UI_Talent_*`             | `talentIconUrl` / `assetUrl`   |
 * | passive         | `UI_Talent_*`             | `talentIconUrl` / `assetUrl`   |
 * | weapon          | `UI_EquipIcon_*`          | `weaponIconUrl` / `assetUrl`   |
 * | artifact_set    | `UI_RelicIcon_*`          | `artifactIconUrl` / `assetUrl` |
 *
 * Fallbacks when `icon` is null:
 * - character → `CharacterIcon` / roster mapping by `name_id`
 * - weapon → `useWeapon(() => entity.weapon_key)` / `weaponIconSrc`
 * - artifact_set → `artifactSetByKey.get(entity.set_key)` then `artifactIconUrl`
 *
 * Kit deep-links (character pages): `kit_ref` is Hoyoverse/Lightkeepers LINK
 * grammar — skills `S{id}`, passives `P{id}`, constellations `T{id}` — same as
 * CharacterKitPanel / GameText `{LINK#…}` → in-page `#kit-{kit_ref}`.
 * Constellation **UI label** stays `C{index}` even when `kit_ref` is `T…`.
 */

export type ResearchQuestionKind = "how_to_play" | "ask";

export type ResearchLlmProvider = "gemini" | "deepseek";

export type ResearchAnswerStyle = "concise" | "normal" | "verbose";

/** Dedicated research UI view. `topic=build` forces `view=build` panels. */
export type ResearchTopic = "build";

export type ResearchView = "build";

/** Player-owned weapon (GOOD key) for research personalization. */
export type ResearchOwnedWeapon = {
  key: string;
  refinement?: number;
  level?: number | null;
  ascension?: number | null;
  /** Copies of this GOOD key owned (set when inventory is deduped). */
  copies?: number;
};

/** Player-owned character with optional investment for research personalization. */
export type ResearchOwnedCharacter = {
  name_id: string;
  constellation?: number;
  level?: number | null;
  ascension?: number | null;
  talents?: { normal?: number; skill?: number; burst?: number } | null;
  weapon?: ResearchOwnedWeapon | null;
};

export type ResearchRequest = {
  /**
   * Force a dedicated research view. `topic=build` skips freeform intent and
   * returns `view=build` panels. Requires `focus_name_ids`.
   */
  topic?: ResearchTopic | null;
  question_kind?: ResearchQuestionKind;
  /**
   * Freeform question. Optional when `topic=build` — agent fills
   * `How should I build {focus}?` if omitted.
   */
  question?: string;
  focus_name_ids?: string[];
  llm_provider?: ResearchLlmProvider;
  mode?: "abyss" | "stygian";
  /** @deprecated Ignored by agent — do not send for research. */
  roster_name_ids?: string[];
  /** @deprecated Ignored by agent — do not send inventory for research. */
  owned_characters?: ResearchOwnedCharacter[];
  /** @deprecated Ignored by agent — do not send inventory for research. */
  owned_weapons?: ResearchOwnedWeapon[];
  /** @deprecated Ignored by agent — client joins inventory locally. */
  personalize?: boolean;
  /** Chat-friendly length. Agent defaults to concise if omitted. */
  answer_style?: ResearchAnswerStyle;
};

export type ResearchCitation = {
  id: number;
  title: string | null;
  url: string;
  date?: string | null;
  source_tier: string;
  publisher: string;
  heading_path?: string | null;
  quote: string;
};

export type ResearchDisagreement = {
  summary: string;
  citation_ids?: number[];
};

/** Structured A/B breakdown for vs / worth-it questions (UI chart panel). */
export type ResearchComparisonSide = {
  label: string;
  summary: string;
  bullets?: string[];
};

export type ResearchComparison = {
  verdict: string;
  option_a: ResearchComparisonSide;
  option_b: ResearchComparisonSide;
};

/** One 4-character lineup for team/build answers. */
export type ResearchTeamLineup = {
  label: string;
  /** Catalog name_ids (prefer exactly 4). */
  members: string[];
  weapon?: string | null;
  artifact_set?: string | null;
  /** Resolved GOOD weapon key when known. */
  weapon_key?: string | null;
  /** Resolved GOOD artifact-set key when known. */
  set_key?: string | null;
  notes?: string | null;
  citation_ids?: number[];
};

/** Ranked weapon or artifact-set row for build answers. */
export type ResearchRankItem = {
  rank: number;
  key: string;
  note?: string | null;
  citation_ids?: number[];
};

/** Unranked situational artifact set for the Build UI options section. */
export type ResearchArtifactOption = {
  key: string;
  note?: string | null;
  citation_ids?: number[];
};

/** Main/substat priority for the Build UI stats row. */
export type ResearchStatPriority = {
  sands: string[];
  goblet: string[];
  circlet: string[];
  substats: string[];
  notes?: string | null;
  citation_ids?: number[];
};

/** ER requirement for a character. */
export type ResearchErTarget = {
  name_id: string;
  min_er?: number | null;
  max_er?: number | null;
  context?: string | null;
  citation_ids?: number[];
};

/** Ordered rotation / how-to-play steps. */
export type ResearchRotation = {
  steps: string[];
  notes?: string | null;
  citation_ids?: number[];
};

export type ResearchTracePhase =
  | "intent"
  | "retrieve"
  | "static"
  | "synthesize"
  | "refuse";

export type ResearchAnswerPath =
  | "kit_fast_path"
  | "equipment_fast_path"
  | "build_fast_path"
  | "thin_refuse"
  | "llm_synthesis"
  | "llm_fallback_kit";

export type ResearchTraceRetrievedChunk = {
  chunk_id: number;
  publisher: string;
  chunk_kind: string;
  source_tier: string;
  heading_path?: string | null;
};

export type ResearchTraceStep = {
  phase: ResearchTracePhase;
  summary: string;
};

export type ResearchTrace = {
  path: ResearchAnswerPath;
  steps: ResearchTraceStep[];
  question_kind?: ResearchQuestionKind;
  question?: string | null;
  topics?: string[];
  focus_name_ids?: string[];
  thin_corpus?: boolean;
  kit_name_ids?: string[];
  equipment_loaded?: boolean;
  retrieved_count?: number;
  publisher_counts?: Record<string, number>;
  kind_counts?: Record<string, number>;
  retrieved_preview?: ResearchTraceRetrievedChunk[];
  llm_provider?: ResearchLlmProvider | null;
  llm_model?: string | null;
  answer_style?: ResearchAnswerStyle;
  cited_chunk_ids?: number[];
};

export type ResearchEntityType =
  | "character"
  | "constellation"
  | "skill"
  | "passive"
  | "weapon"
  | "artifact_set";

/** One hydrateable `[[…]]` mention for research UI. */
export type ResearchEntity = {
  /** Token body without brackets, e.g. `c:Xingqiu:6` or `weapon:StaffOfHoma`. */
  key: string;
  type: ResearchEntityType;
  label: string;
  name_id?: string | null;
  /** Constellation C-index 1–6 (display). Kit anchor uses `kit_ref` `T{id}`. */
  index?: number | null;
  /** Hoyoverse/Lightkeepers link ref: `S…` / `P…` / `T…`. */
  kit_ref?: string | null;
  game_id?: number | null;
  /** `UI_*` icon stem for `$lib/asset-urls` helpers. */
  icon?: string | null;
  description?: string | null;
  skill_slot?: "normal" | "skill" | "burst" | null;
  /** GOOD weapon key when `type === "weapon"`. */
  weapon_key?: string | null;
  /** GOOD artifact-set key when `type === "artifact_set"`. */
  set_key?: string | null;
};

export type ResearchResponse = {
  answer_markdown: string;
  citations: ResearchCitation[];
  disagreements?: ResearchDisagreement[];
  confidence: "high" | "medium" | "low" | "none";
  thin_corpus: boolean;
  used_chunk_ids?: number[];
  /** Rows for each validated `[[key]]` still present in `answer_markdown`. */
  entities?: ResearchEntity[];
  /** Auditable steps: intent, retrieval, synthesis path, LLM used. */
  trace?: ResearchTrace | null;
  /**
   * UI view discriminator. `view=build` → mount `<BuildPanel>` (not free chat).
   * For build view, rank/option lists are always arrays (`[]` when empty);
   * `comparison` / `teams` / `er_targets` / `rotation` are always null.
   */
  view?: ResearchView | null;
  /** Primary focus character for `view=build` (catalog `name_id`). */
  focus_name_id?: string | null;
  /** Optional A/B panel for vs/worth-it questions. */
  comparison?: ResearchComparison | null;
  /** Optional 4-character lineups for team/build questions. */
  teams?: ResearchTeamLineup[] | null;
  /** Ranked weapons (always `[]` when `view=build`). */
  weapon_ranks?: ResearchRankItem[] | null;
  /** Ranked artifact sets (always `[]` when `view=build`). */
  artifact_ranks?: ResearchRankItem[] | null;
  /** Unranked situational artifact sets (always `[]` when `view=build`). */
  artifact_options?: ResearchArtifactOption[] | null;
  /** Main/substat priority (`null` when sources lack guidance). */
  stat_priority?: ResearchStatPriority | null;
  /** Optional ER targets for ER questions. */
  er_targets?: ResearchErTarget[] | null;
  /** Optional rotation steps for how-to-play questions. */
  rotation?: ResearchRotation | null;
};
