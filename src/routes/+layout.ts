// If you're using a fallback (i.e. SPA mode) you don't need to prerender all
// pages by setting this here, but should prerender as many as possible to
// avoid large performance and SEO impacts
import { building } from "$app/environment";

import { db } from "$lib/supabaseClient";
import type { Tables } from "$lib/types/database.types";

type CharacterMapping = Tables<"url_to_character_mapping">;
type Character = Tables<"characters">;

export async function load() {
  let mapping: Map<string, string> = new Map<string, string>();
  let characters: Character[] = [];

  const getCharacterMapping = async () => {
    // console.log("getting mapping");
    const { data, error: err } = await db
      .from("url_to_character_mapping")
      .select("*");

    if (err) {
      throw new Error(err.message);
    } else {
      let arr = data as CharacterMapping[];
      arr.forEach((m) => {
        mapping.set(m.character_name, m.url);
      });
    }
    console.log("got mapping");
    // console.log(mapping);
  };

  const getCharacterData = async () => {
    // console.log("getting data");
    const { data, error: err } = await db
      .from("characters")
      .select("*")
      .order("name", { ascending: true });
    if (err) {
      throw new Error(err.message);
    } else {
      characters = data as Character[];
    }
    console.log("got data");
    // console.log(characters);
  };

  if (!building) {
    try {
      await getCharacterMapping();
      await getCharacterData();
    } catch (e) {
      console.log("unexpected error");
    }
  }

  return {
    mapping,
    characters,
  };
}
