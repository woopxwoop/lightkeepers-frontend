import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import {
  getCharacterKitResult,
  getTravelerElementKits,
} from "$lib/server/character-kit";
import { getCharacterSummary } from "$lib/server/character-summary";
import { simCharacterKey } from "$lib/utils";

/** null = no such character (404); a throw = CDN trouble, so 503 not 404. */
async function loadKit(slug: string) {
  try {
    return await getCharacterKitResult(slug);
  } catch (err) {
    console.error(`[characters] kit load failed for ${slug}:`, err);
    error(503, "Character data is temporarily unavailable");
  }
}

export const load: PageServerLoad = async ({ params }) => {
  const result = await loadKit(params.slug);
  if (!result) {
    error(404, `Character "${params.slug}" not found`);
  }

  const { kit, channel: kitChannel } = result;

  const [buildsResult, travelerKits] = await Promise.all([
    getCharacterSummary(simCharacterKey(kit))
      .then((builds) => ({ builds, buildsUnavailable: false as const }))
      .catch((err) => {
        // Kit page still works without Builds; transport stays uncached in the helper.
        console.warn(
          `[characters] summary load failed for ${params.slug}:`,
          err,
        );
        return { builds: null, buildsUnavailable: true as const };
      }),
    kit.is_traveler ? getTravelerElementKits(kit) : Promise.resolve({}),
  ]);

  return {
    kit,
    kitChannel,
    builds: buildsResult.builds,
    buildsUnavailable: buildsResult.buildsUnavailable,
    travelerKits,
    seo: {
      title: `${kit.name} — Lightkeepers`,
      description: kit.title
        ? `${kit.name} — ${kit.title}. Skills, passives, and constellations.`
        : `${kit.name} character kit — skills, passives, and constellations.`,
    },
  };
};
