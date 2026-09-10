/**
 * Deterministic payloads for Playwright E2E (PLAYWRIGHT_E2E=1).
 * Used by SSR (/api/static, layout characters) and client API mocks.
 */

import type {
  AbyssEnemies,
  AbyssTeam,
  AbyssVersion,
  Character,
  CharacterAnalyticsMode,
  CharacterAnalyticsPayload,
  Enemy,
  NearMissStygianPair,
  NearMissStygianTeam,
  StygianEnemies,
  StygianEnemyListItem,
  StygianEnemyCycleOption,
  StygianEnemyTeamsPayload,
  StygianSchedule,
  StygianTeam,
  StygianVersion,
} from "$lib/definitions";
import type { ResearchResponse } from "$lib/research-types";
import type { TierListPayload } from "$lib/tierlist";

export const E2E_ABYSS_TEAM_TOP = {
  team_key: "test-abyss-top",
  version_number: 1,
  members: ["Hutao", "Yelan", "Zhongli", "Albedo"],
  members_names: ["Hu Tao", "Yelan", "Zhongli", "Albedo"],
  usage_total: 45.5,
  usage_rate: 45.5,
  field_1_rate: 70,
  field_2_rate: 30,
  has_total: 1000,
} satisfies AbyssTeam;

export const E2E_ABYSS_TEAM_BOTTOM = {
  team_key: "test-abyss-bottom",
  version_number: 1,
  members: ["RaidenShogun", "Kazuha", "Bennett", "Xiangling"],
  members_names: ["Raiden Shogun", "Kazuha", "Bennett", "Xiangling"],
  usage_total: 38.2,
  usage_rate: 38.2,
  field_1_rate: 25,
  field_2_rate: 75,
  has_total: 1000,
} satisfies AbyssTeam;

export const E2E_STYGIAN_TEAM_TOP = {
  team_key: "test-stygian-top",
  version_number: 1,
  members: ["Hutao", "Yelan", "Zhongli", "Albedo"],
  members_names: ["Hu Tao", "Yelan", "Zhongli", "Albedo"],
  usage_total: 40,
  usage_rate: 40,
  avg_usage_rate: 40,
  field_1_rate: 80,
  field_2_rate: 10,
  field_3_rate: 10,
  has_total: 1000,
} satisfies StygianTeam;

export const E2E_STYGIAN_TEAM_MIDDLE = {
  team_key: "test-stygian-middle",
  version_number: 1,
  members: ["RaidenShogun", "Kazuha", "Bennett", "Xiangling"],
  members_names: ["Raiden Shogun", "Kazuha", "Bennett", "Xiangling"],
  usage_total: 35,
  usage_rate: 35,
  avg_usage_rate: 35,
  field_1_rate: 10,
  field_2_rate: 10,
  field_3_rate: 80,
  has_total: 1000,
} satisfies StygianTeam;

export const E2E_STYGIAN_TEAM_BOTTOM = {
  team_key: "test-stygian-bottom",
  version_number: 1,
  members: ["Neuvillette", "Furina", "Xingqiu", "Nahida"],
  members_names: ["Neuvillette", "Furina", "Xingqiu", "Nahida"],
  usage_total: 30,
  usage_rate: 30,
  avg_usage_rate: 30,
  field_1_rate: 10,
  field_2_rate: 80,
  field_3_rate: 10,
  has_total: 1000,
} satisfies StygianTeam;

export const E2E_STYGIAN_OWNED_BASELINE = {
  team_key: "test-stygian-owned-baseline",
  version_number: 1,
  members: ["Yelan", "Zhongli", "Albedo", "Bennett"],
  members_names: ["Yelan", "Zhongli", "Albedo", "Bennett"],
  usage_total: 12,
  usage_rate: 12,
  avg_usage_rate: 12,
  field_1_rate: 50,
  field_2_rate: 25,
  field_3_rate: 25,
  has_total: 500,
} satisfies StygianTeam;

export const E2E_NEAR_MISS_SINGLE = {
  team_key: "test-near-miss-hutao",
  members: ["Hutao", "Yelan", "Zhongli", "Albedo"],
  members_names: ["Hu Tao", "Yelan", "Zhongli", "Albedo"],
  missing_character: "Hutao",
  missing_character_name: "Hu Tao",
  avg_usage_rate: 42,
  usage_rate: 42,
  usage_total: 42,
  field_1_rate: 70,
  field_2_rate: 15,
  field_3_rate: 15,
} satisfies NearMissStygianTeam;

export const E2E_EMPTY_ABYSS_ENEMIES: AbyssEnemies = {
  top: [],
  bottom: [],
  buffName: null,
  openTime: null,
};

export const E2E_EMPTY_STYGIAN_ENEMIES: StygianEnemies = {
  top: null,
  middle: null,
  bottom: null,
};

function e2eEnemy(id: number, name: string): Enemy {
  return {
    id,
    enemy_name: name,
    asset: `UI_MonsterIcon_Test_${id}`,
    icon_path: null,
    description: null,
    created_at: "2024-01-01T00:00:00Z",
  };
}

/** Board bosses so YSHelper / hybrid seating has slot enemy ids. */
export const E2E_STYGIAN_ENEMIES: StygianEnemies = {
  top: e2eEnemy(101, "E2E Top Boss"),
  middle: e2eEnemy(102, "E2E Middle Boss"),
  bottom: e2eEnemy(103, "E2E Bottom Boss"),
};

const E2E_ABYSS_VERSION: AbyssVersion = {
  version_number: 1,
  version_name: "test",
  created_at: "",
};

const E2E_STYGIAN_VERSION: StygianVersion = {
  version_number: 1,
  version_name: "test",
  created_at: "",
};

const E2E_CHAR_IDS = [
  ["Hutao", "Hu Tao", "Pyro", "Polearm"],
  ["Yelan", "Yelan", "Hydro", "Bow"],
  ["Zhongli", "Zhongli", "Geo", "Polearm"],
  ["Albedo", "Albedo", "Geo", "Sword"],
  ["RaidenShogun", "Raiden Shogun", "Electro", "Polearm"],
  ["Kazuha", "Kazuha", "Anemo", "Sword"],
  ["Bennett", "Bennett", "Pyro", "Sword"],
  ["Xiangling", "Xiangling", "Pyro", "Polearm"],
  ["Neuvillette", "Neuvillette", "Hydro", "Catalyst"],
  ["Furina", "Furina", "Hydro", "Sword"],
  ["Xingqiu", "Xingqiu", "Hydro", "Sword"],
  ["Nahida", "Nahida", "Dendro", "Catalyst"],
] as const;

function e2eCharacter(
  name_id: string,
  name: string,
  element: string,
  weapon_type: string,
  game_id: number,
): Character {
  return {
    name_id,
    name,
    element,
    weapon_type,
    game_id,
    rarity: 5,
    released_at: "2020-01-01T00:00:00Z",
    created_at: "",
  };
}

/** Roster used by SSR layout when PLAYWRIGHT_E2E is set. */
export function e2eCharacters(): Character[] {
  return E2E_CHAR_IDS.map(([name_id, name, element, weapon_type], i) =>
    e2eCharacter(name_id, name, element, weapon_type, i + 1),
  );
}

export type E2eStaticPayload = {
  latestAbyssVersion: AbyssVersion;
  latestStygianVersion: StygianVersion;
  allTeamsAbyss: AbyssTeam[];
  allTeamsStygian: StygianTeam[];
  stygianEnemies: StygianEnemies;
  abyssEnemies: AbyssEnemies;
  stygianSchedule: StygianSchedule;
};

/** Full /api/static body for Playwright SSR (no Supabase). */
export function e2eStaticPayload(): E2eStaticPayload {
  return {
    latestAbyssVersion: E2E_ABYSS_VERSION,
    latestStygianVersion: E2E_STYGIAN_VERSION,
    allTeamsAbyss: [E2E_ABYSS_TEAM_TOP, E2E_ABYSS_TEAM_BOTTOM],
    allTeamsStygian: [
      E2E_STYGIAN_TEAM_TOP,
      E2E_STYGIAN_TEAM_MIDDLE,
      E2E_STYGIAN_TEAM_BOTTOM,
    ],
    stygianEnemies: E2E_STYGIAN_ENEMIES,
    abyssEnemies: E2E_EMPTY_ABYSS_ENEMIES,
    stygianSchedule: null,
  };
}

/** Empty near-miss pair list typed for API mocks. */
export const E2E_NEAR_MISS_PAIRS: NearMissStygianPair[] = [];

/** Deterministic /api/tierlist body for Playwright. */
export function e2eTierListPayload(): TierListPayload {
  return {
    windowCycles: 5,
    cutoffMethod: "relative-gap",
    fiveStarCutoff: 3,
    fourStarCutoff: 2,
    fiveStar: [
      {
        nameId: "Hutao",
        name: "Hu Tao",
        score: 55,
        cycles: 5,
        rank: 1,
      },
      {
        nameId: "Yelan",
        name: "Yelan",
        score: 42,
        cycles: 5,
        rank: 2,
      },
      {
        nameId: "Furina",
        name: "Furina",
        score: 28,
        cycles: 5,
        rank: 3,
      },
    ],
    fourStar: [
      {
        nameId: "Bennett",
        name: "Bennett",
        score: 60,
        cycles: 5,
        rank: 1,
      },
      {
        nameId: "Xiangling",
        name: "Xiangling",
        score: 18,
        cycles: 5,
        rank: 2,
      },
    ],
  };
}

/** Deterministic /api/character-analytics body for Playwright. */
export function e2eCharacterAnalyticsPayload(
  nameId: string,
  mode: CharacterAnalyticsMode,
): CharacterAnalyticsPayload {
  const usage = [
    {
      version_number: 1,
      version_name: "test-v1",
      usage_rate: 40,
      ownership_rate: 70,
      usage: 400,
      ownership: 700,
    },
    {
      version_number: 2,
      version_name: "test-v2",
      usage_rate: 55,
      ownership_rate: 72,
      usage: 550,
      ownership: 720,
    },
  ];

  if (mode === "stygian") {
    return {
      nameId,
      mode: "stygian",
      usage,
      teams: [
        {
          version_number: 2,
          team_key: "e2e-analytics-stygian",
          members: [nameId, "Furina", "Xilonen", "Kazuha"],
          members_names: [nameId, "Furina", "Xilonen", "Kazuha"],
          usage_rate: 12,
          usage_total: 120,
          field_1_rate: 40,
          field_2_rate: 35,
          field_3_rate: 25,
          has_total: 1000,
        },
      ],
    };
  }

  return {
    nameId,
    mode: "abyss",
    usage,
    teams: [
      {
        version_number: 2,
        team_key: "e2e-analytics-abyss",
        members: [nameId, "Yelan", "Zhongli", "Albedo"],
        members_names: [nameId, "Yelan", "Zhongli", "Albedo"],
        usage_rate: 18,
        usage_total: 180,
        field_1_rate: 60,
        field_2_rate: 40,
        has_total: 1000,
      },
    ],
  };
}

export const E2E_STYGIAN_ENEMY: Enemy = e2eEnemy(1, "Test Boss");

export function e2eStygianEnemyList(): StygianEnemyListItem[] {
  return [
    {
      id: E2E_STYGIAN_ENEMY.id,
      enemy_name: E2E_STYGIAN_ENEMY.enemy_name,
      asset: E2E_STYGIAN_ENEMY.asset,
      appearance_count: 2,
      latest_version_number: 2,
      latest_version_name: "test-v2",
      version_numbers: [2, 1],
    },
  ];
}

export function e2eStygianEnemyCycles(): StygianEnemyCycleOption[] {
  return [
    { version_number: 2, version_name: "test-v2" },
    { version_number: 1, version_name: "test-v1" },
  ];
}

/** Deterministic /api/stygian-enemy-teams body for Playwright. */
export function e2eStygianEnemyTeamsPayload(
  enemyId: number,
): StygianEnemyTeamsPayload {
  return {
    enemyId,
    teams: [
      {
        version_number: 2,
        version_name: "test-v2",
        slot_index: 0,
        team_key: "e2e-enemy-v2",
        members: ["Hutao", "Yelan", "Zhongli", "Albedo"],
        members_names: ["Hu Tao", "Yelan", "Zhongli", "Albedo"],
        field_rate: 70,
        usage_rate: 40,
        usage_total: 400,
        field_1_rate: 70,
        field_2_rate: 20,
        field_3_rate: 10,
        has_total: 1000,
      },
      {
        version_number: 1,
        version_name: "test-v1",
        slot_index: 1,
        team_key: "e2e-enemy-v1",
        members: ["RaidenShogun", "Kazuha", "Bennett", "Xiangling"],
        members_names: ["Raiden Shogun", "Kazuha", "Bennett", "Xiangling"],
        field_rate: 65,
        usage_rate: 35,
        usage_total: 350,
        field_1_rate: 15,
        field_2_rate: 20,
        field_3_rate: 65,
        has_total: 1000,
      },
    ],
  };
}

/** Deterministic research answer for PLAYWRIGHT_E2E (entities + citation). */
export const E2E_RESEARCH_RESPONSE = {
  answer_markdown:
    "[[c:Xingqiu:6]] pairs well with [[weapon:StaffOfHoma]] for Hu Tao vaporize lines.[[cite:2297]]",
  citations: [
    {
      id: 2297,
      title: "Hu Tao Guide",
      url: "https://keqingmains.com/hu-tao/",
      source_tier: "guide",
      publisher: "KeqingMains",
      heading_path: "FAQ > C1",
      quote: "C0 with R1 Homa has a similar damage ceiling to C1 with a strong 4-star.",
    },
  ],
  confidence: "high",
  thin_corpus: false,
  entities: [
    {
      key: "c:Xingqiu:6",
      type: "constellation",
      label: "Xingqiu C6",
      name_id: "Xingqiu",
      index: 6,
      kit_ref: "T256",
      icon: "UI_Talent_S_Xingqiu_04",
      description: "Energy-related constellation for Xingqiu.",
    },
    {
      key: "weapon:StaffOfHoma",
      type: "weapon",
      label: "Staff of Homa",
      weapon_key: "StaffOfHoma",
      icon: "UI_EquipIcon_Pole_Homa",
    },
  ],
} satisfies ResearchResponse;

/** Deterministic Build view for PLAYWRIGHT_E2E (`topic=build`). */
export const E2E_RESEARCH_BUILD_RESPONSE = {
  view: "build",
  focus_name_id: "Hutao",
  answer_markdown:
    "Prefer Staff of Homa and Crimson Witch. Prioritize EM sands until vaporize is comfortable.",
  weapon_ranks: [
    {
      rank: 1,
      key: "StaffOfHoma",
      note: "Best option for HP-scaling charged attacks",
      citation_ids: [2297],
    },
    {
      rank: 2,
      key: "Deathmatch",
      note: "Strong F2P battle pass option",
      citation_ids: [2297],
    },
  ],
  artifact_ranks: [
    {
      rank: 1,
      key: "CrimsonWitchOfFlames",
      note: "Best in most vaporize teams",
      citation_ids: [2297],
    },
  ],
  artifact_options: [
    {
      key: "ShimenawasReminiscence",
      note: "Situational when skill uptime is low",
      citation_ids: [2297],
    },
  ],
  stat_priority: {
    sands: ["EM", "HP%"],
    goblet: ["Pyro DMG%"],
    circlet: ["CRIT Rate", "CRIT DMG"],
    substats: ["EM", "CRIT Rate", "CRIT DMG", "HP%"],
    notes: "EM sands until comfortable vaporize uptime.",
    citation_ids: [2297],
  },
  entities: [
    {
      key: "char:Hutao",
      type: "character",
      label: "Hu Tao",
      name_id: "Hutao",
    },
    {
      key: "weapon:StaffOfHoma",
      type: "weapon",
      label: "Staff of Homa",
      weapon_key: "StaffOfHoma",
      icon: "UI_EquipIcon_Pole_Homa",
    },
    {
      key: "set:CrimsonWitchOfFlames",
      type: "artifact_set",
      label: "Crimson Witch of Flames",
      set_key: "CrimsonWitchOfFlames",
    },
  ],
  disagreements: [],
  citations: [
    {
      id: 2297,
      title: "Hu Tao Guide",
      url: "https://keqingmains.com/hu-tao/",
      source_tier: "guide",
      publisher: "KeqingMains",
      heading_path: "Builds",
      quote: "Staff of Homa is Hu Tao's best-in-slot weapon in most teams.",
    },
  ],
  confidence: "medium",
  thin_corpus: false,
  comparison: null,
  teams: null,
  er_targets: null,
  rotation: null,
  trace: {
    path: "build_fast_path",
    steps: [{ phase: "static", summary: "Build panels from corpus ranks" }],
    topics: ["build"],
  },
} satisfies ResearchResponse;
