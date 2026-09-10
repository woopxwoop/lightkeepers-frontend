import type { AbyssTeam, StygianTeam, Character } from "$lib/definitions";
import type { InvestmentSim, InvestmentTeam } from "$lib/types/investment";

/** Character-page team lists (meta + simulated). */
export const TOP_TEAMS_LIMIT = 6;

/** Default investment cost for character-page sim rankings. */
export const CHARACTER_SIM_COST = 4;

/**
 * Top teams from a meta board that include `nameId`, ranked by usage_rate.
 */
export function topTeamsForCharacter<T extends AbyssTeam | StygianTeam>(
  teams: T[],
  nameId: string,
  limit = TOP_TEAMS_LIMIT,
): T[] {
  return teams
    .filter(
      (t) =>
        (t.members ?? []).length === 4 && (t.members ?? []).includes(nameId),
    )
    .sort((a, b) => (b.usage_rate ?? 0) - (a.usage_rate ?? 0))
    .slice(0, limit);
}

/** Best sim at an exact investment cost, or null. */
export function bestSimAtCost(
  team: InvestmentTeam,
  cost: number,
): InvestmentSim | null {
  let best: InvestmentSim | null = null;
  for (const sim of team.results) {
    if (sim.cost !== cost) continue;
    if (!best || sim.dps > best.dps) best = sim;
  }
  return best;
}

export type RankedSimTeam = {
  team: InvestmentTeam;
  sim: InvestmentSim;
  dps: number;
};

/**
 * Teams featuring `goodKey`, ranked by best DPS at the given investment cost.
 */
export function topSimTeamsForCharacter(
  teams: InvestmentTeam[],
  goodKey: string,
  cost = CHARACTER_SIM_COST,
  limit = TOP_TEAMS_LIMIT,
): RankedSimTeam[] {
  const ranked: RankedSimTeam[] = [];
  for (const team of teams) {
    if (!team.characters.includes(goodKey)) continue;
    const sim = bestSimAtCost(team, cost);
    if (!sim) continue;
    ranked.push({ team, sim, dps: sim.dps });
  }
  ranked.sort((a, b) => b.dps - a.dps);
  return ranked.slice(0, limit);
}

export type HandBuild = {
  cons: number;
  weaponRefinement: number;
  weaponKey: string;
};

/** Resolve name_ids to catalog characters for TeamCardHand. */
export function handCharactersFromMembers<T>(
  members: string[],
  mapping: Map<string, T>,
): (T | undefined)[] {
  return members.map((id) => mapping.get(id));
}

/** name_ids to dim for unowned roster members (name_id set). */
export function dimmedKeysFromMembers(
  members: string[],
  ownedNameIds: ReadonlySet<string>,
): Set<string> {
  return new Set(members.filter((id) => !ownedNameIds.has(id)));
}

/** Resolve GOOD keys to catalog characters for TeamCardHand. */
export function handCharactersFromGoodKeys<T extends Character>(
  keys: string[],
  goodKeyMap: Map<string, T>,
): (T | undefined)[] {
  return keys.map((key) => goodKeyMap.get(key));
}

/** Per-slot build chips for a sim (null when the key is missing). */
export function handBuilds(
  team: InvestmentTeam,
  sim: InvestmentSim | null,
): (HandBuild | null)[] {
  return team.characters.map((key) => {
    const build = sim?.characters.find((c) => c.key === key);
    if (!build) return null;
    return {
      cons: build.cons,
      weaponRefinement: build.weapon.refinement,
      weaponKey: build.weapon.key,
    };
  });
}

/** name_ids to dim for unowned GOOD-key roster members. */
export function dimmedKeysFromGoodKeys<
  T extends { name_id?: string | null; name?: string | null },
>(
  keys: string[],
  ownedKeys: ReadonlySet<string>,
  goodKeyMap: Map<string, T>,
): Set<string> {
  return new Set(
    keys
      .filter((key) => !ownedKeys.has(key))
      .flatMap((key) => {
        const char = goodKeyMap.get(key);
        const id = char?.name_id ?? char?.name;
        return id ? [id] : [];
      }),
  );
}
