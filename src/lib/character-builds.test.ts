/**
 * Unit tests for character Builds-tab helpers.
 *
 * Run: pnpm test:unit
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  constellationImpactRows,
  constellationPrioritySection,
  characterBuildFromExample,
  exampleHasHighConfig,
  exampleRelevantGoodKeys,
  exampleUsesFavonius,
  formatReactionFingerprint,
  formatReactionName,
  levelImportanceFromBuilds,
  ascensionImportanceFromBuilds,
  levelPrioritySection,
  rankSigWeaponsByGain,
  rankWeaponsByRarityAndTeams,
  recommendedSubstatSourceLabel,
  recommendedSubstatsFromBuilds,
  sigWeaponPrioritySection,
  talentImportanceRows,
  talentPrioritySection,
  useGuideSection,
} from "./character-builds.ts";
import type {
  CharacterBuildExample,
  CharacterIndex,
  CharacterTalentImportance,
} from "./types/investment.ts";

function builds(
  partial: Partial<CharacterIndex> & Pick<CharacterIndex, "main_stats">,
): CharacterIndex {
  return {
    key: "Test",
    weapons: [],
    sets: [],
    ...partial,
  };
}

describe("recommendedSubstatsFromBuilds", () => {
  it("non-negligible uses absolute high OptimFull liquids plus mains", () => {
    const result = recommendedSubstatsFromBuilds(
      builds({
        main_stats: {
          sands: [{ key: "eleMas", teams: 3 }],
          goblet: [{ key: "hydro_dmg_", teams: 3 }],
          circlet: [{ key: "critRate_", teams: 3 }],
        },
        substat_rolls_liquid: {
          teams: 2,
          configs: 2,
          mean: {},
          ranked: [
            { key: "atk_", mean: 8 },
            { key: "critDMG_", mean: 2 },
          ],
        },
        high_substat_rolls_liquid: {
          teams: 2,
          configs: 2,
          mean: {},
          ranked: [
            { key: "critDMG_", mean: 12.4 },
            { key: "eleMas", mean: 9.2 },
            { key: "atk_", mean: 0.3 },
          ],
        },
        stat_recommendations: {
          mode: "delta",
          delta_stats: [
            { key: "critDMG_", mean_delta: 4.2, teams_positive: 2 },
          ],
          enerRech_if_burst: true,
          critRate_if_fav: false,
          teams: 2,
          burst_teams: 2,
          fav_teams: 0,
        },
      }),
    );
    assert.deepEqual(
      result.map((r) => [r.key, r.matchesMain, r.mean, r.isDelta]),
      [
        ["eleMas", true, 9.2, false],
        ["critRate_", true, 0, false],
        ["critDMG_", false, 12.4, false],
      ],
    );
  });

  it("negligible uses mid→high deltas plus mains (not flat high leftovers)", () => {
    const result = recommendedSubstatsFromBuilds(
      builds({
        main_stats: {
          sands: [{ key: "enerRech_", teams: 3 }],
          goblet: [{ key: "hydro_dmg_", teams: 3 }],
          circlet: [{ key: "critRate_", teams: 3 }],
        },
        substat_rolls_liquid: {
          teams: 3,
          configs: 3,
          mean: {},
          ranked: [
            { key: "critDMG_", mean: 4 },
            { key: "atk_", mean: 3 },
          ],
        },
        high_substat_rolls_liquid: {
          teams: 3,
          configs: 3,
          mean: {},
          ranked: [
            { key: "enerRech_", mean: 11 },
            { key: "critRate_", mean: 6 },
            { key: "atk_", mean: 8 },
          ],
        },
        stat_recommendations: {
          mode: "checklist",
          delta_stats: [
            { key: "enerRech_", mean_delta: 3.5, teams_positive: 2 },
            { key: "critRate_", mean_delta: 2.0, teams_positive: 2 },
          ],
          enerRech_if_burst: true,
          critRate_if_fav: true,
          teams: 3,
          burst_teams: 3,
          fav_teams: 2,
        },
      }),
    );
    assert.deepEqual(
      result.map((r) => [r.key, r.mean, r.isDelta]),
      [
        ["enerRech_", 3.5, true],
        ["critRate_", 2.0, true],
      ],
    );
  });

  it("falls back to mid liquid ranks when high and recommendations are missing", () => {
    const result = recommendedSubstatsFromBuilds(
      builds({
        main_stats: {
          sands: [{ key: "eleMas", teams: 3 }],
          goblet: [{ key: "hydro_dmg_", teams: 3 }],
          circlet: [{ key: "critRate_", teams: 3 }],
        },
        substat_rolls_liquid: {
          teams: 1,
          configs: 1,
          mean: {},
          ranked: [
            { key: "critDMG_", mean: 2.1 },
            { key: "atk_", mean: 0.2 },
            { key: "eleMas", mean: 0.1 },
          ],
        },
      }),
    );
    assert.deepEqual(
      result.map((r) => [r.key, r.matchesMain, r.mean]),
      [
        ["eleMas", true, 0.1],
        ["critRate_", true, 0],
        ["critDMG_", false, 2.1],
      ],
    );
  });

  it("keeps guide-authored ranks when there are no measured teams", () => {
    const result = recommendedSubstatsFromBuilds(
      builds({
        main_stats: {
          sands: [{ key: "def_", teams: 0 }],
          goblet: [{ key: "def_", teams: 0 }],
          circlet: [
            { key: "critRate_", teams: 0 },
            { key: "critDMG_", teams: 0 },
          ],
        },
        substat_rolls_liquid: {
          teams: 0,
          configs: 0,
          mean: { enerRech_: 0, eleMas: 0 },
          ranked: [
            { key: "enerRech_", mean: 0 },
            { key: "eleMas", mean: 0 },
          ],
        },
        stat_recommendations: {
          mode: "checklist",
          delta_stats: [],
          enerRech_if_burst: false,
          critRate_if_fav: false,
          teams: 0,
          burst_teams: 0,
          fav_teams: 0,
        },
      }),
    );
    assert.deepEqual(
      result.map((r) => r.key),
      ["critDMG_", "critRate_", "def_", "eleMas", "enerRech_"],
    );
  });

  it("uses checklist deltas when liquid is absent", () => {
    const result = recommendedSubstatsFromBuilds(
      builds({
        main_stats: {
          sands: [{ key: "enerRech_", teams: 1 }],
          goblet: [{ key: "hydro_dmg_", teams: 1 }],
          circlet: [{ key: "critRate_", teams: 1 }],
        },
        stat_recommendations: {
          mode: "checklist",
          delta_stats: [
            { key: "enerRech_", mean_delta: 2.5, teams_positive: 1 },
            { key: "critRate_", mean_delta: 1.5, teams_positive: 1 },
          ],
          enerRech_if_burst: true,
          critRate_if_fav: true,
          teams: 1,
          burst_teams: 1,
          fav_teams: 1,
        },
      }),
    );
    assert.deepEqual(
      result.map((r) => [r.key, r.mean, r.isDelta]),
      [
        ["enerRech_", 2.5, true],
        ["critRate_", 1.5, true],
      ],
    );
  });

  it("uses checklist deltas when liquid ranked is empty", () => {
    const result = recommendedSubstatsFromBuilds(
      builds({
        main_stats: {
          sands: [{ key: "enerRech_", teams: 1 }],
          goblet: [{ key: "hydro_dmg_", teams: 1 }],
          circlet: [{ key: "critRate_", teams: 1 }],
        },
        substat_rolls_liquid: {
          teams: 0,
          configs: 0,
          mean: {},
          ranked: [],
        },
        stat_recommendations: {
          mode: "checklist",
          delta_stats: [
            { key: "enerRech_", mean_delta: 4, teams_positive: 2 },
            { key: "atk_", mean_delta: 0, teams_positive: 0 },
          ],
          enerRech_if_burst: true,
          critRate_if_fav: false,
          teams: 2,
          burst_teams: 2,
          fav_teams: 0,
        },
      }),
    );
    assert.deepEqual(
      result.map((r) => [r.key, r.mean, r.isDelta]),
      [
        ["enerRech_", 4, true],
        ["critRate_", 0, false],
      ],
    );
  });

  it("falls back to mid liquid when high liquid exists but teams is 0", () => {
    const result = recommendedSubstatsFromBuilds(
      builds({
        main_stats: {
          sands: [{ key: "eleMas", teams: 2 }],
          goblet: [{ key: "hydro_dmg_", teams: 2 }],
          circlet: [{ key: "critRate_", teams: 2 }],
        },
        substat_rolls_liquid: {
          teams: 2,
          configs: 2,
          mean: {},
          ranked: [
            { key: "critDMG_", mean: 3.5 },
            { key: "atk_", mean: 0.2 },
          ],
        },
        high_substat_rolls_liquid: {
          teams: 0,
          configs: 0,
          mean: {},
          ranked: [{ key: "enerRech_", mean: 99 }],
        },
      }),
    );
    const crit = result.find((r) => r.key === "critDMG_");
    assert.ok(crit);
    assert.equal(crit.source, "mid");
    assert.equal(crit.teams, 2);
    assert.equal(crit.mean, 3.5);
    assert.equal(
      recommendedSubstatSourceLabel(crit.source),
      "avg liquid rolls",
    );
    assert.equal(
      result.some((r) => r.key === "enerRech_" && r.mean === 99),
      false,
    );
  });
});

describe("rankWeaponsByRarityAndTeams", () => {
  it("sorts by team count then rarity when strength is missing", () => {
    const ranked = rankWeaponsByRarityAndTeams(
      [
        { key: "fourA", teams: 9 },
        { key: "fiveB", teams: 2 },
        { key: "fiveA", teams: 5 },
      ],
      (key) => (key.startsWith("five") ? 5 : 4),
    );
    assert.deepEqual(
      ranked.map((w) => w.key),
      ["fourA", "fiveA", "fiveB"],
    );
  });

  it("uses rarity as a fallback when teams also tie", () => {
    const ranked = rankWeaponsByRarityAndTeams(
      [
        { key: "fourA", teams: 5 },
        { key: "fiveB", teams: 5 },
        { key: "fiveA", teams: 5 },
      ],
      (key) => (key.startsWith("five") ? 5 : 4),
    );
    assert.deepEqual(
      ranked.map((w) => w.key),
      ["fiveA", "fiveB", "fourA"],
    );
  });

  it("prefers measured sigs when strength and teams tie", () => {
    const ranked = rankWeaponsByRarityAndTeams(
      [
        { key: "SurfsUp", teams: 5 },
        { key: "TomeOfTheEternalFlow", teams: 5 },
        { key: "PrototypeAmber", teams: 5 },
      ],
      () => 5,
      ["TomeOfTheEternalFlow"],
    );
    assert.deepEqual(
      ranked.map((w) => w.key),
      ["TomeOfTheEternalFlow", "PrototypeAmber", "SurfsUp"],
    );
  });

  it("sorts by Bradley-Terry strength before team count and rarity", () => {
    const ranked = rankWeaponsByRarityAndTeams(
      [
        { key: "SurfsUp", teams: 5, strength: 0.9 },
        { key: "TomeOfTheEternalFlow", teams: 5, strength: 1.2 },
        { key: "PrototypeAmber", teams: 8, strength: 0.7 },
        { key: "SacrificialFragments", teams: 12, strength: 1.0 },
      ],
      (key) => (key === "SacrificialFragments" ? 4 : 5),
    );
    assert.deepEqual(
      ranked.map((w) => w.key),
      [
        "TomeOfTheEternalFlow",
        "SacrificialFragments",
        "SurfsUp",
        "PrototypeAmber",
      ],
    );
  });

  it("ranks defined strength ahead of missing strength", () => {
    const ranked = rankWeaponsByRarityAndTeams(
      [
        { key: "noStrength", teams: 20 },
        { key: "hasStrength", teams: 2, strength: 0.5 },
      ],
      () => 5,
    );
    assert.deepEqual(
      ranked.map((w) => w.key),
      ["hasStrength", "noStrength"],
    );
  });
});

describe("rankSigWeaponsByGain", () => {
  it("sorts and classifies by the stronger mean/median gain", () => {
    const ranked = rankSigWeaponsByGain([
      {
        key: "B",
        teams: 1,
        mean_pct_gain: 10,
        median_pct_gain: 10,
        min_pct_gain: 10,
        max_pct_gain: 10,
      },
      {
        key: "A",
        teams: 1,
        mean_pct_gain: 10,
        median_pct_gain: 10,
        min_pct_gain: 10,
        max_pct_gain: 10,
      },
      {
        key: "C",
        teams: 1,
        mean_pct_gain: 20,
        median_pct_gain: 8,
        min_pct_gain: 8,
        max_pct_gain: 20,
      },
    ]);
    assert.deepEqual(
      ranked.map((w) => [w.key, w.priority]),
      [
        ["C", "exceptional"],
        ["A", "solid"],
        ["B", "solid"],
      ],
    );
  });

  it("sorts non-finite gains last", () => {
    const ranked = rankSigWeaponsByGain([
      {
        key: "nan",
        teams: 1,
        mean_pct_gain: Number.NaN,
        median_pct_gain: Number.NaN,
        min_pct_gain: 0,
        max_pct_gain: 0,
      },
      {
        key: "small",
        teams: 1,
        mean_pct_gain: 1,
        median_pct_gain: 1,
        min_pct_gain: 1,
        max_pct_gain: 1,
      },
      {
        key: "infinite",
        teams: 1,
        mean_pct_gain: Number.POSITIVE_INFINITY,
        median_pct_gain: 0,
        min_pct_gain: 0,
        max_pct_gain: 0,
      },
      {
        key: "big",
        teams: 1,
        mean_pct_gain: 24,
        median_pct_gain: 24,
        min_pct_gain: 24,
        max_pct_gain: 24,
      },
    ]);
    assert.deepEqual(
      ranked.map((w) => w.key),
      ["big", "small", "infinite", "nan"],
    );
  });

  it("prefers merge-stamped tiers over the fixed ladder", () => {
    const ranked = rankSigWeaponsByGain(
      [
        {
          key: "small_but_stamped",
          teams: 1,
          mean_pct_gain: 1,
          median_pct_gain: 1,
          min_pct_gain: 1,
          max_pct_gain: 1,
          tier: "exceptional",
        },
        {
          key: "big_unstamped",
          teams: 1,
          mean_pct_gain: 24,
          median_pct_gain: 24,
          min_pct_gain: 24,
          max_pct_gain: 24,
        },
      ],
      {
        floors: {
          exceptional: 7.83,
          high: 4.11,
          solid: 0.79,
          negligible: 0,
        },
        labels: {
          exceptional: "Exceptional impact",
          high: "High impact",
          solid: "Solid impact",
          modest: "Modest impact",
          negligible: "Negligible impact",
        },
      },
    );
    assert.deepEqual(
      ranked.map((w) => [w.key, w.priority, w.priorityLabel]),
      [
        ["big_unstamped", "exceptional", "Exceptional impact"],
        ["small_but_stamped", "exceptional", "Exceptional impact"],
      ],
    );
  });
});

describe("constellationImpactRows", () => {
  it("preserves source order and classifies each gain", () => {
    const rows = constellationImpactRows([
      {
        cons: 1,
        teams: 2,
        mean_pct_gain: 4,
        median_pct_gain: 6,
        min_pct_gain: 2,
        max_pct_gain: 7,
      },
      {
        cons: 2,
        teams: 2,
        mean_pct_gain: 21,
        median_pct_gain: 18,
        min_pct_gain: 15,
        max_pct_gain: 25,
      },
    ]);
    assert.deepEqual(
      rows.map((row) => [row.cons, row.pct, row.priorityLabel]),
      [
        [1, 6, "Modest impact"],
        [2, 21, "Exceptional impact"],
      ],
    );
  });

  it("classifies measured constellation gains on the five-band ladder", () => {
    const rows = constellationImpactRows([
      {
        cons: 1,
        teams: 2,
        mean_pct_gain: 30,
        median_pct_gain: 30,
        min_pct_gain: 30,
        max_pct_gain: 30,
      },
    ]);
    assert.deepEqual(
      rows.map((row) => [row.priority, row.priorityLabel]),
      [["exceptional", "Exceptional impact"]],
    );
  });
});

describe("talentImportanceRows / levelImportanceFromBuilds", () => {
  it("orders talent rows by max mean/median and classifies level impact", () => {
    const rows = talentImportanceRows(
      {
        teams: 2,
        auto: {
          mean_pct_drop: 3,
          median_pct_drop: 3,
          min_pct_drop: 3,
          max_pct_drop: 3,
        },
        skill: {
          mean_pct_drop: 12,
          median_pct_drop: 12,
          min_pct_drop: 12,
          max_pct_drop: 12,
        },
        burst: {
          mean_pct_drop: 5,
          median_pct_drop: 5,
          min_pct_drop: 5,
          max_pct_drop: 5,
        },
        priority: ["skill", "burst", "auto"],
      },
      (kitType) => `icon:${kitType}`,
    );
    assert.deepEqual(
      rows.map((r) => [r.slot, r.icon, r.priority]),
      [
        ["skill", "icon:skill", "exceptional"],
        ["burst", "icon:burst", "solid"],
        ["auto", "icon:normal", "modest"],
      ],
    );

    const level = levelImportanceFromBuilds(
      builds({
        main_stats: { sands: [], goblet: [], circlet: [] },
        substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
        level_importance: {
          teams: 2,
          mean_pct_drop: 6,
          median_pct_drop: 6,
          min_pct_drop: 6,
          max_pct_drop: 6,
        },
      }),
    );
    assert.equal(level?.priority, "high");

    const ascension = ascensionImportanceFromBuilds(
      builds({
        main_stats: { sands: [], goblet: [], circlet: [] },
        substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
        ascension_importance: {
          teams: 1,
          mean_pct_drop: 3,
          median_pct_drop: 3,
          min_pct_drop: 3,
          max_pct_drop: 3,
        },
      }),
    );
    assert.equal(ascension?.priority, "modest");
    assert.equal(ascension?.mean, 3);
  });

  it("hides talent/level rows when teams are zero", () => {
    assert.equal(
      talentImportanceRows(
        {
          teams: 0,
          auto: {
            mean_pct_drop: 0,
            median_pct_drop: 0,
            min_pct_drop: 0,
            max_pct_drop: 0,
          },
          skill: {
            mean_pct_drop: 0,
            median_pct_drop: 0,
            min_pct_drop: 0,
            max_pct_drop: 0,
          },
          burst: {
            mean_pct_drop: 0,
            median_pct_drop: 0,
            min_pct_drop: 0,
            max_pct_drop: 0,
          },
          priority: ["auto", "skill", "burst"],
        },
        () => null,
      ).length,
      0,
    );
    assert.equal(
      levelImportanceFromBuilds(
        builds({
          main_stats: { sands: [], goblet: [], circlet: [] },
          substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
          level_importance: {
            teams: 0,
            mean_pct_drop: 0,
            median_pct_drop: 0,
            min_pct_drop: 0,
            max_pct_drop: 0,
          },
        }),
      ),
      null,
    );
  });
});

describe("guide vs sim section selection", () => {
  const emptyShell = {
    main_stats: {
      sands: [],
      goblet: [],
      circlet: [],
    } as CharacterIndex["main_stats"],
    substat_rolls_liquid: {
      teams: 0,
      configs: 0,
      mean: {},
      ranked: [],
    },
  };

  const simTalent: CharacterTalentImportance = {
    teams: 2,
    auto: {
      mean_pct_drop: 3,
      median_pct_drop: 3,
      min_pct_drop: 3,
      max_pct_drop: 3,
    },
    skill: {
      mean_pct_drop: 12,
      median_pct_drop: 12,
      min_pct_drop: 12,
      max_pct_drop: 12,
    },
    burst: {
      mean_pct_drop: 5,
      median_pct_drop: 5,
      min_pct_drop: 5,
      max_pct_drop: 5,
    },
    priority: ["skill", "burst", "auto"],
  };

  it("fills missing sim sections from guide_priority by default", () => {
    assert.equal(useGuideSection({ override: false }, true, false), true);
    assert.equal(useGuideSection({ override: false }, true, true), false);
    assert.equal(useGuideSection({ override: true }, true, true), true);
    assert.equal(useGuideSection({ override: true }, false, true), false);

    const section = talentPrioritySection(
      builds({
        ...emptyShell,
        guide_priority: {
          override: false,
          talent_priority: ["burst", "skill", "auto"],
        },
      }),
      (kitType) => `icon:${kitType}`,
    );
    assert.equal(section?.source, "guide");
    assert.deepEqual(
      section?.source === "guide"
        ? section.rows.map((r) => [r.slot, r.icon])
        : null,
      [
        ["burst", "icon:burst"],
        ["skill", "icon:skill"],
        ["auto", "icon:normal"],
      ],
    );

    assert.deepEqual(
      levelPrioritySection(
        builds({
          ...emptyShell,
          guide_priority: { override: false, level_90: true },
        }),
      ),
      {
        source: "guide",
        simMissing: true,
        priority: "solid",
        priorityLabel: "Recommended",
      },
    );

    const cons = constellationPrioritySection(
      builds({
        ...emptyShell,
        guide_priority: { override: false, constellations: [2, 1] },
      }),
    );
    assert.equal(cons?.source, "guide");
    assert.deepEqual(
      cons?.source === "guide"
        ? cons.rows.map((r) => [r.cons, r.priority, r.priorityLabel])
        : null,
      [
        [1, "high", "High impact"],
        [2, "high", "High impact"],
      ],
    );

    const sigs = sigWeaponPrioritySection(
      builds({
        ...emptyShell,
        guide_priority: {
          override: false,
          sig_weapons: ["Elegy", "Skyward"],
        },
      }),
    );
    assert.equal(sigs?.source, "guide");
    assert.deepEqual(
      sigs?.source === "guide"
        ? sigs.rows.map((r) => [r.key, r.priority, r.priorityLabel])
        : null,
      [
        ["Elegy", "high", "High impact"],
        ["Skyward", "high", "High impact"],
      ],
    );
  });

  it("marks guide sections that replace existing sim data as measured", () => {
    const section = constellationPrioritySection(
      builds({
        ...emptyShell,
        vertical_importance: {
          constellations: [
            {
              cons: 1,
              teams: 2,
              mean_pct_gain: 20,
              median_pct_gain: 20,
              min_pct_gain: 20,
              max_pct_gain: 20,
            },
          ],
          sig_weapons: [],
        },
        guide_priority: { override: true, constellations: [2] },
      }),
    );
    assert.equal(section?.source, "guide");
    assert.equal(
      section?.source === "guide" ? section.simMissing : null,
      false,
    );
  });

  it("keeps measured five-band rows when sim data exists and override is off", () => {
    const section = talentPrioritySection(
      builds({
        ...emptyShell,
        talent_importance: simTalent,
        guide_priority: {
          override: false,
          talent_priority: ["burst", "auto", "skill"],
        },
      }),
      () => null,
    );
    assert.equal(section?.source, "sim");
    assert.deepEqual(
      section?.source === "sim"
        ? section.rows.map((r) => [r.slot, r.priority])
        : null,
      [
        ["skill", "exceptional"],
        ["burst", "solid"],
        ["auto", "modest"],
      ],
    );
  });

  it("replaces authored sections when override is true, leaving omitted sections on sim", () => {
    const talent = talentPrioritySection(
      builds({
        ...emptyShell,
        talent_importance: simTalent,
        level_importance: {
          teams: 2,
          mean_pct_drop: 6,
          median_pct_drop: 6,
          min_pct_drop: 6,
          max_pct_drop: 6,
        },
        guide_priority: {
          override: true,
          talent_priority: ["burst", "skill", "auto"],
          // level_90 omitted → keep sim level
        },
      }),
      () => null,
    );
    assert.equal(talent?.source, "guide");
    assert.deepEqual(
      talent?.source === "guide" ? talent.rows.map((r) => r.slot) : null,
      ["burst", "skill", "auto"],
    );

    const level = levelPrioritySection(
      builds({
        ...emptyShell,
        level_importance: {
          teams: 2,
          mean_pct_drop: 6,
          median_pct_drop: 6,
          min_pct_drop: 6,
          max_pct_drop: 6,
        },
        guide_priority: {
          override: true,
          talent_priority: ["burst", "skill", "auto"],
        },
      }),
    );
    assert.equal(level?.source, "sim");
    assert.equal(level?.source === "sim" ? level.row.priority : null, "high");
  });
});

describe("reaction helpers", () => {
  it("formats reaction names and fingerprints", () => {
    assert.equal(formatReactionName("lunarcharged"), "Lunar-Charged");
    assert.equal(formatReactionName("swirl-electro"), "Swirl (Electro)");
    assert.equal(formatReactionName("mystery-reaction"), "Mystery Reaction");
    assert.equal(formatReactionFingerprint(null), "No reactions");
    assert.equal(
      formatReactionFingerprint("bloom+swirl-hydro"),
      "Bloom + Swirl (Hydro)",
    );
  });
});

describe("exampleRelevantGoodKeys display rules", () => {
  const base = {
    team_key: "t",
    team_name: "T",
    characters: ["Xilonen", "A", "B", "C"],
    state_key: "Xilonen~C0~FavoniusSword~R5",
    reactions: {
      rps: null,
      metric: "damage" as const,
      list: [],
      primary: null,
      fingerprint: null,
    },
    artifact_pct_gain: 0.4,
    key: "Xilonen",
    cons: 0,
    level: 90,
    talents: { auto: 1, skill: 9, burst: 9 },
    weapon: { key: "FavoniusSword", refinement: 5, level: 90 },
    set: { key: "ScrollsOfTheHearthfire", count: 4 },
    main_stats: {
      sands: "enerRech_",
      goblet: "geo_dmg_",
      circlet: "critRate_",
    },
    substat_rolls: { enerRech_: 12, critRate_: 10, critDMG_: 4 },
    substat_rolls_liquid: { enerRech_: 10, critRate_: 8, critDMG_: 2 },
  };

  it("mid-only on Fav → ER + CR", () => {
    const example: CharacterBuildExample = {
      ...base,
      invest: "mid",
    };
    assert.deepEqual([...exampleRelevantGoodKeys(example)].sort(), [
      "critRate_",
      "enerRech_",
    ]);
  });

  it("mid-only without Fav → ER only (no CR)", () => {
    const example: CharacterBuildExample = {
      ...base,
      invest: "mid",
      state_key: "Mona~C2~ThrillingTalesOfDragonSlayers~R5",
      weapon: {
        key: "ThrillingTalesOfDragonSlayers",
        refinement: 5,
        level: 90,
      },
    };
    assert.deepEqual([...exampleRelevantGoodKeys(example)].sort(), [
      "enerRech_",
    ]);
  });

  it("mid-only with uniform mains → ER + that main", () => {
    const example: CharacterBuildExample = {
      ...base,
      invest: "mid",
      state_key: "Sucrose~C6~SacrificialFragments~R5",
      weapon: {
        key: "SacrificialFragments",
        refinement: 5,
        level: 90,
      },
      main_stats: {
        sands: "eleMas",
        goblet: "eleMas",
        circlet: "eleMas",
      },
    };
    assert.deepEqual([...exampleRelevantGoodKeys(example)].sort(), [
      "eleMas",
      "enerRech_",
    ]);
  });

  it("high invest → mains + pipeline goal_substats", () => {
    const example: CharacterBuildExample = {
      ...base,
      key: "RaidenShogun",
      invest: "high",
      main_stats: {
        sands: "eleMas",
        goblet: "eleMas",
        circlet: "eleMas",
      },
      substat_rolls_liquid: { atk_: 10, critDMG_: 2, enerRech_: 15 },
      high_substat_rolls: { eleMas: 16, enerRech_: 16, critDMG_: 2 },
      high_substat_rolls_liquid: {
        eleMas: 15,
        enerRech_: 15,
        critDMG_: 2,
      },
      // Pipeline already dropped flat/leftover mid liquids for this team.
      goal_substats: ["eleMas"],
    };
    const keys = exampleRelevantGoodKeys(example, "high");
    assert.equal(keys.has("eleMas"), true); // main + gainer
    assert.equal(keys.has("enerRech_"), false); // flat mid→high, not stamped
    assert.equal(keys.has("critDMG_"), false);
    assert.equal(keys.has("atk_"), false);
  });

  it("high invest without goal_substats falls back to high liquids", () => {
    const example: CharacterBuildExample = {
      ...base,
      key: "RaidenShogun",
      invest: "high",
      main_stats: {
        sands: "atk_",
        goblet: "electro_dmg_",
        circlet: "critRate_",
      },
      high_substat_rolls: { critDMG_: 12, critRate_: 10 },
      high_substat_rolls_liquid: { critDMG_: 11, critRate_: 9 },
    };
    const keys = exampleRelevantGoodKeys(example, "high");
    assert.equal(keys.has("atk_"), true);
    assert.equal(keys.has("electro_dmg_"), true);
    assert.equal(keys.has("critRate_"), true);
    assert.equal(keys.has("critDMG_"), true);
  });

  it("high invest with empty goal_substats falls back to high liquids", () => {
    const example: CharacterBuildExample = {
      ...base,
      key: "RaidenShogun",
      invest: "high",
      main_stats: {
        sands: "atk_",
        goblet: "electro_dmg_",
        circlet: "critRate_",
      },
      high_substat_rolls: { critDMG_: 12, critRate_: 10 },
      high_substat_rolls_liquid: { critDMG_: 11, critRate_: 9 },
      goal_substats: [],
    };
    const keys = exampleRelevantGoodKeys(example, "high");
    assert.equal(keys.has("atk_"), true);
    assert.equal(keys.has("electro_dmg_"), true);
    assert.equal(keys.has("critRate_"), true);
    assert.equal(keys.has("critDMG_"), true);
  });

  it("mid invest keeps mid sheet even when high_substat_rolls is present", () => {
    const example: CharacterBuildExample = {
      ...base,
      invest: "mid",
      substat_rolls: { enerRech_: 12, critRate_: 10, critDMG_: 4 },
      substat_rolls_liquid: { enerRech_: 10, critRate_: 8, critDMG_: 2 },
      high_substat_rolls: { eleMas: 16, enerRech_: 16 },
      high_substat_rolls_liquid: { eleMas: 15, enerRech_: 15 },
    };
    assert.equal(exampleHasHighConfig(example), false);
    assert.deepEqual([...exampleRelevantGoodKeys(example, "mid")].sort(), [
      "critRate_",
      "enerRech_",
    ]);
    assert.deepEqual([...exampleRelevantGoodKeys(example, "high")].sort(), [
      "critRate_",
      "enerRech_",
    ]);
    const build = characterBuildFromExample(example, "mid");
    assert.equal(build.substat_rolls.enerRech_, 12);
    assert.equal(build.substat_rolls.critRate_, 10);
    assert.equal(build.substat_rolls_liquid.enerRech_, 10);
    assert.equal(build.substat_rolls_liquid.critRate_, 8);
    assert.equal(build.substat_rolls.eleMas, undefined);
    assert.equal(build.substat_rolls_liquid.eleMas, undefined);
  });

  it("clamps EM liquid to flower+plume when mains are EM/EM/EM", () => {
    const example: CharacterBuildExample = {
      ...base,
      key: "RaidenShogun",
      invest: "high",
      main_stats: {
        sands: "eleMas",
        goblet: "eleMas",
        circlet: "eleMas",
      },
      high_substat_rolls: { eleMas: 16, enerRech_: 16 },
      high_substat_rolls_liquid: { eleMas: 15, enerRech_: 15 },
    };
    const build = characterBuildFromExample(example, "high");
    assert.equal(build.substat_rolls_liquid.eleMas, 6);
    assert.equal(build.substat_rolls.eleMas, 6);
    assert.equal(build.substat_rolls_liquid.enerRech_, 15);
  });

  it("clamps CR to 12 when circlet is CR (4 pieces × 3)", () => {
    const example: CharacterBuildExample = {
      ...base,
      key: "RaidenShogun",
      invest: "high",
      main_stats: {
        sands: "atk_",
        goblet: "atk_",
        circlet: "critRate_",
      },
      high_substat_rolls: { critRate_: 18, critDMG_: 19 },
      high_substat_rolls_liquid: { critRate_: 17, critDMG_: 18 },
    };
    const build = characterBuildFromExample(example, "high");
    assert.equal(build.substat_rolls_liquid.critRate_, 12);
    assert.equal(build.substat_rolls.critRate_, 12);
    assert.equal(build.substat_rolls_liquid.critDMG_, 15);
  });

  it("maps 5pc→4pc and drops 1pc set2", () => {
    const example: CharacterBuildExample = {
      ...base,
      invest: "mid",
      set: { key: "EmblemOfSeveredFate", count: 5 },
      set2: "NoblesseOblige",
      set2_count: 1,
    };
    const build = characterBuildFromExample(example, "mid");
    assert.equal(build.set.count, 4);
    assert.equal(build.set2, undefined);
    assert.equal(build.set2_count, undefined);
  });
});
