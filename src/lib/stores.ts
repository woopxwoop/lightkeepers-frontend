import { writable, derived, type Writable } from "svelte/store";
import { db } from "$lib/supabaseClient";
import type { Character, CharacterOwned, Team } from "$lib/definitions";

export const charactersOwned = writable<CharacterOwned[]>([]);
export const teamsOwned = writable<Team[]>([]);

export const teamsOwnedTop = derived<Writable<Team[]>, Team[]>(
  teamsOwned,
  ($teamsOwned) => {
    return $teamsOwned.filter(
      (team) =>
        (team.usage_rate_top ?? 0) > 40 && (team.members ?? []).length == 4,
    );
  },
);

export const teamsOwnedBottom = derived<Writable<Team[]>, Team[]>(
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
