import type { Tables, Database } from "$lib/types/database.types";

export type Character = Tables<"characters">;
export type CharacterOwned = Character & { isOwned: boolean };
export type AbyssTeam = Tables<"top_100_abyss_teams">;
export type StygianTeam = Tables<"top_100_stygian_teams">;
