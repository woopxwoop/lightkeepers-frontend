import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  annotateOwnedRankRows,
  buildResearchPersonalization,
  collectOwnedResearchGearKeys,
  joinBuildInventory,
} from "./research.ts";
import type { InventoryWeapon } from "$lib/definitions";

describe("buildResearchPersonalization", () => {
  it("returns personalize false for empty / unowned roster", () => {
    assert.deepEqual(buildResearchPersonalization({ characters: [] }), {
      personalize: false,
    });
    assert.deepEqual(
      buildResearchPersonalization({
        characters: [{ isOwned: false, name_id: "HuTao" }],
      }),
      { personalize: false },
    );
  });

  it("maps owned characters with progress and equipped weapon", () => {
    const fields = buildResearchPersonalization({
      characters: [
        {
          isOwned: true,
          name_id: "HuTao",
          progress: {
            level: 90,
            ascension: 6,
            constellation: 1,
            talents: { normal: 6, skill: 9, burst: 9 },
            weapon: {
              key: "StaffOfHoma",
              level: 90,
              ascension: 6,
              refinement: 1,
            },
          },
        },
        { isOwned: false, name_id: "Xingqiu" },
      ],
    });
    assert.equal(fields.personalize, true);
    assert.deepEqual(fields.roster_name_ids, ["HuTao"]);
    assert.deepEqual(fields.owned_characters, [
      {
        name_id: "HuTao",
        constellation: 1,
        level: 90,
        ascension: 6,
        talents: { normal: 6, skill: 9, burst: 9 },
        weapon: {
          key: "StaffOfHoma",
          refinement: 1,
          level: 90,
          ascension: 6,
        },
      },
    ]);
    assert.equal(fields.owned_weapons, undefined);
  });

  it("includes inventory weapons not already equipped", () => {
    const inventory: InventoryWeapon[] = [
      {
        key: "StaffOfHoma",
        level: 90,
        ascension: 6,
        refinement: 1,
        location: "HuTao",
        lock: false,
      },
      {
        key: "Deathmatch",
        level: 80,
        ascension: 5,
        refinement: 3,
        location: "",
        lock: false,
      },
    ];
    const fields = buildResearchPersonalization({
      characters: [
        {
          isOwned: true,
          name_id: "HuTao",
          progress: {
            level: 90,
            ascension: 6,
            constellation: 0,
            talents: { normal: 1, skill: 8, burst: 8 },
            weapon: {
              key: "StaffOfHoma",
              level: 90,
              ascension: 6,
              refinement: 1,
            },
          },
        },
      ],
      inventoryWeapons: inventory,
    });
    assert.deepEqual(fields.owned_weapons, [
      {
        key: "Deathmatch",
        refinement: 3,
        level: 80,
        ascension: 5,
      },
    ]);
  });

  it("dedupes inventory weapons by key keeping highest refinement and copy count", () => {
    const inventory: InventoryWeapon[] = [
      {
        key: "TheWidsith",
        level: 70,
        ascension: 4,
        refinement: 1,
        location: "",
        lock: false,
      },
      {
        key: "TheWidsith",
        level: 90,
        ascension: 6,
        refinement: 5,
        location: "",
        lock: false,
      },
      {
        key: "TheWidsith",
        level: 1,
        ascension: 0,
        refinement: 1,
        location: "",
        lock: false,
      },
    ];
    const fields = buildResearchPersonalization({
      characters: [{ isOwned: true, name_id: "Yae" }],
      inventoryWeapons: inventory,
    });
    assert.deepEqual(fields.owned_weapons, [
      {
        key: "TheWidsith",
        refinement: 5,
        level: 90,
        ascension: 6,
        copies: 3,
      },
    ]);
  });

  it("attaches total copies to equipped weapon when bag has duplicates", () => {
    const inventory: InventoryWeapon[] = [
      {
        key: "StaffOfHoma",
        level: 90,
        ascension: 6,
        refinement: 1,
        location: "HuTao",
        lock: false,
      },
      {
        key: "StaffOfHoma",
        level: 1,
        ascension: 0,
        refinement: 1,
        location: "",
        lock: false,
      },
    ];
    const fields = buildResearchPersonalization({
      characters: [
        {
          isOwned: true,
          name_id: "HuTao",
          progress: {
            level: 90,
            ascension: 6,
            constellation: 0,
            talents: { normal: 1, skill: 8, burst: 8 },
            weapon: {
              key: "StaffOfHoma",
              level: 90,
              ascension: 6,
              refinement: 1,
            },
          },
        },
      ],
      inventoryWeapons: inventory,
    });
    assert.equal(fields.owned_weapons, undefined);
    assert.equal(fields.owned_characters?.[0]?.weapon?.copies, 2);
  });

  it("omits owned_weapons when inventory is empty or null", () => {
    const base = {
      characters: [{ isOwned: true, name_id: "Xingqiu" }],
    };
    assert.equal(
      buildResearchPersonalization(base).owned_weapons,
      undefined,
    );
    assert.equal(
      buildResearchPersonalization({ ...base, inventoryWeapons: null })
        .owned_weapons,
      undefined,
    );
    assert.equal(
      buildResearchPersonalization({ ...base, inventoryWeapons: [] })
        .owned_weapons,
      undefined,
    );
  });
});

describe("collectOwnedResearchGearKeys + annotateOwnedRankRows", () => {
  it("collects weapons from inventory + equipped progress and sets from artifacts", () => {
    const owned = collectOwnedResearchGearKeys({
      inventoryWeapons: [
        {
          key: "StaffOfHoma",
          level: 90,
          ascension: 6,
          refinement: 1,
          location: "",
          lock: false,
        },
      ],
      inventoryArtifacts: [
        {
          setKey: "CrimsonWitchOfFlames",
          slotKey: "sands",
          level: 20,
          rarity: 5,
          mainStatKey: "eleMas",
          location: "",
          lock: false,
          substats: [],
        },
      ],
      characters: [
        {
          progress: {
            weapon: { key: "Deathmatch" },
          },
        },
      ],
    });
    assert.equal(owned.weapons.has("StaffOfHoma"), true);
    assert.equal(owned.weapons.has("Deathmatch"), true);
    assert.equal(owned.artifactSets.has("CrimsonWitchOfFlames"), true);
  });

  it("marks owned / bestOwned on ranked rows", () => {
    const rows = annotateOwnedRankRows(
      [
        { rank: 1, key: "StaffOfHoma" },
        { rank: 2, key: "Deathmatch" },
        { rank: 3, key: "DragonsBane" },
      ],
      new Set(["Deathmatch", "DragonsBane"]),
    );
    assert.deepEqual(
      rows.map((r) => ({ key: r.key, owned: r.owned, bestOwned: r.bestOwned })),
      [
        { key: "StaffOfHoma", owned: false, bestOwned: false },
        { key: "Deathmatch", owned: true, bestOwned: true },
        { key: "DragonsBane", owned: true, bestOwned: false },
      ],
    );
  });

  it("joinBuildInventory annotates weapons and artifact sets separately", () => {
    const joined = joinBuildInventory({
      weapon_ranks: [
        { rank: 1, key: "StaffOfHoma" },
        { rank: 2, key: "Deathmatch" },
      ],
      artifact_ranks: [{ rank: 1, key: "CrimsonWitchOfFlames" }],
      artifact_options: [{ key: "ShimenawasReminiscence" }],
      owned: {
        weapons: new Set(["Deathmatch"]),
        artifactSets: new Set(["ShimenawasReminiscence"]),
      },
    });
    assert.equal(joined.weapons[0]?.owned, false);
    assert.equal(joined.weapons[1]?.bestOwned, true);
    assert.equal(joined.artifacts[0]?.owned, false);
    assert.equal(joined.options[0]?.owned, true);
    assert.equal(joined.options[0]?.bestOwned, true);
  });
});
