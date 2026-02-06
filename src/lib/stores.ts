import { writable, derived, type Writable } from "svelte/store";
import { db } from "$lib/supabaseClient";
import type {
  Character,
  CharacterOwned,
  AbyssTeam,
  StygianTeam,
} from "$lib/definitions";

export const charactersOwned = writable<CharacterOwned[]>([]);
export const teamsOwned = writable<AbyssTeam[]>([]);

export const teamsOwnedTop = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) => {
    return $teamsOwned.filter(
      (team) =>
        (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length == 4,
    );
  },
);

export const teamsOwnedBottom = derived<Writable<AbyssTeam[]>, AbyssTeam[]>(
  teamsOwned,
  ($teamsOwned) => {
    return $teamsOwned.filter(
      (team) =>
        (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length == 4,
    );
  },
);

export async function writeTopAbyssTeamsOwned(
  charactersOwned: CharacterOwned[],
) {
  const { data, error: err } = await db.rpc(
    "get_teams_with_characters_subset",
    {
      p_character_names: charactersOwned
        .filter((character) => character.isOwned)
        .map((character) => character.name),
      p_version_number: 54,
    },
  );
  if (err) {
    return;
  } else {
    teamsOwned.set(data ?? []);
  }
}

export const teamsOwnedStygian = writable<StygianTeam[]>([]);

export const teamsOwnedStygianTop = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($teamsOwnedStygian) => {
  return $teamsOwnedStygian.filter(
    (team) =>
      (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length == 4,
  );
});

export const teamsOwnedStygianMiddle = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($teamsOwnedStygian) => {
  return $teamsOwnedStygian.filter(
    (team) =>
      (team.usage_rate_middle ?? 0) > 40 && (team.members ?? []).length == 4,
  );
});

export const teamsOwnedStygianBottom = derived<
  Writable<StygianTeam[]>,
  StygianTeam[]
>(teamsOwnedStygian, ($teamsOwnedStygian) => {
  return $teamsOwnedStygian.filter(
    (team) =>
      (team.usage_rate_bottom ?? 0) > 40 && (team.members ?? []).length == 4,
  );
});

export async function writeTopStygianTeamsOwned(
  charactersOwned: CharacterOwned[],
) {
  const { data, error: err } = await db.rpc(
    "get_teams_with_characters_subset_stygian",
    {
      p_character_names: charactersOwned
        .filter((character) => character.isOwned)
        .map((character) => character.name),
      p_version_number: 4,
    },
  );
  if (err) {
    return;
  } else {
    teamsOwnedStygian.set(data ?? []);
  }
}
