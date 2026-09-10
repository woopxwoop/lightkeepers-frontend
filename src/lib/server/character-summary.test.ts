import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { liveCharacterSummary } from "./character-summary.ts";
import type { CharacterIndex } from "../types/investment.ts";

function summary(partial: Partial<CharacterIndex> = {}): CharacterIndex {
  return {
    key: "Furina",
    weapons: [],
    sets: [],
    main_stats: { sands: [], goblet: [], circlet: [] },
    substat_rolls_liquid: { teams: 0, configs: 0, mean: {}, ranked: [] },
    ...partial,
  };
}

describe("liveCharacterSummary", () => {
  it("passes through current summaries", () => {
    const live = summary();
    assert.deepEqual(liveCharacterSummary(live), live);
    const flagged = summary({ upToDate: true });
    assert.deepEqual(liveCharacterSummary(flagged), flagged);
  });

  it("treats tombstones as missing", () => {
    assert.equal(
      liveCharacterSummary({ key: "Aloy", upToDate: false } as CharacterIndex),
      null,
    );
  });

  it("returns stale summaries that still have a body", () => {
    const stale = summary({
      upToDate: false,
      weapons: [{ key: "KagurasVerity", teams: 1 }],
    });
    assert.deepEqual(liveCharacterSummary(stale), stale);
  });

  it("returns null for null and undefined without throwing", () => {
    assert.equal(liveCharacterSummary(null), null);
    assert.equal(liveCharacterSummary(undefined), null);
  });

  it("normalizes missing main_stats and liquid for legacy payloads", () => {
    const legacy = {
      key: "Legacy",
      weapons: [],
      sets: [],
    } as unknown as CharacterIndex;
    const live = liveCharacterSummary(legacy);
    assert.ok(live);
    assert.deepEqual(live.main_stats, {
      sands: [],
      goblet: [],
      circlet: [],
    });
    assert.deepEqual(live.substat_rolls_liquid, {
      teams: 0,
      configs: 0,
      mean: {},
      ranked: [],
    });
  });

  it("fills partial main_stats slots without dropping present ranks", () => {
    const partial = summary({
      main_stats: {
        sands: [{ key: "hp_", teams: 2 }],
      } as CharacterIndex["main_stats"],
    });
    const live = liveCharacterSummary(partial);
    assert.ok(live);
    assert.deepEqual(live.main_stats.sands, [{ key: "hp_", teams: 2 }]);
    assert.deepEqual(live.main_stats.goblet, []);
    assert.deepEqual(live.main_stats.circlet, []);
  });

  it("drops null and malformed main_stats / liquid ranked entries", () => {
    const dirty = summary({
      main_stats: {
        sands: [
          null,
          { key: "hp_", teams: 2 },
          { key: "", teams: 1 },
          { key: "atk_", teams: Number.NaN },
          { teams: 3 },
          "junk",
        ],
        goblet: [{ key: "hydro_dmg_", teams: 1 }],
        circlet: [],
      } as unknown as CharacterIndex["main_stats"],
      substat_rolls_liquid: {
        teams: 1,
        configs: 1,
        mean: {},
        ranked: [
          null,
          { key: "critDMG_", mean: 4 },
          { key: "atk_", mean: Number.POSITIVE_INFINITY },
          { key: "", mean: 1 },
          { mean: 2 },
        ],
      } as unknown as CharacterIndex["substat_rolls_liquid"],
    });
    const live = liveCharacterSummary(dirty);
    assert.ok(live);
    assert.deepEqual(live.main_stats.sands, [{ key: "hp_", teams: 2 }]);
    assert.deepEqual(live.main_stats.goblet, [{ key: "hydro_dmg_", teams: 1 }]);
    assert.deepEqual(live.substat_rolls_liquid?.ranked, [
      { key: "critDMG_", mean: 4 },
    ]);
  });

  it("rejects negative and non-integer teams counts", () => {
    const dirty = summary({
      main_stats: {
        sands: [
          { key: "hp_", teams: -1 },
          { key: "atk_", teams: 1.5 },
          { key: "def_", teams: 2 },
        ],
        goblet: [],
        circlet: [],
      },
      substat_rolls_liquid: {
        teams: -1,
        configs: 1.5,
        mean: { critDMG_: 4 },
        ranked: [],
      },
    });
    const live = liveCharacterSummary(dirty);
    assert.ok(live);
    assert.deepEqual(live.main_stats.sands, [{ key: "def_", teams: 2 }]);
    assert.equal(live.substat_rolls_liquid?.teams, 0);
    assert.equal(live.substat_rolls_liquid?.configs, 0);
  });

  it("filters liquid.mean to nonempty keys with finite numbers", () => {
    const dirty = summary({
      substat_rolls_liquid: {
        teams: 2,
        configs: 2,
        mean: {
          critDMG_: 4,
          "": 1,
          atk_: Number.NaN,
          bad: "x",
          ok: 2.5,
        },
        ranked: [],
      } as unknown as CharacterIndex["substat_rolls_liquid"],
    });
    // Array mean must become {}.
    const arrayMean = summary({
      substat_rolls_liquid: {
        teams: 1,
        configs: 1,
        mean: ["junk"] as unknown as Record<string, number>,
        ranked: [],
      },
    });
    const live = liveCharacterSummary(dirty);
    assert.ok(live);
    assert.deepEqual(live.substat_rolls_liquid?.mean, {
      critDMG_: 4,
      ok: 2.5,
    });
    const liveArray = liveCharacterSummary(arrayMean);
    assert.ok(liveArray);
    assert.deepEqual(liveArray.substat_rolls_liquid?.mean, {});
  });
});
