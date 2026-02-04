import type { Tables } from "$lib/types/database.types";

export type Character = Tables<"characters">;
export type CharacterOwned = Character & { isOwned: boolean };
export type Team = Tables<"top_100_abyss_teams">;
