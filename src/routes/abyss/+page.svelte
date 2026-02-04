<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "$lib/supabaseClient";
  import type { Tables } from "$lib/types/database.types";
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import {
    charactersOwned,
    teamsOwned,
    teamsOwnedTop,
    teamsOwnedBottom,
  } from "$lib/stores";

  type Character = Tables<"characters">;
  type CharacterOwned = Character & { isOwned: boolean };
  type Team = Tables<"top_100_abyss_teams">;
  type CharacterMapping = Tables<"url_to_character_mapping">;

  let { data } = $props();

  let mapping: Map<string, string> = $derived(data.mapping);
  let teams: Team[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);

  $effect(() => {
    loading = $teamsOwnedTop.length == 0 || $teamsOwnedBottom.length == 0;
  });
</script>

<main class="w-[80%]">
  {#if loading}
    <div>loading teams data</div>
  {:else}
    <div class="grid grid-cols-2 gap-x-10 w-full text-center">
      <div class="flex col-span-1 justify-center flex-col">
        <h1>Top Half Teams</h1>
        <ul class="grid grid-cols-1 gap-y-4">
          {#each ($teamsOwnedTop ?? []).slice(0, 25) as team}
            <li
              class="grid grid-cols-4 gap-x-2 border rounded-xl p-2 bg-(--foreground-color)"
            >
              {#each team.members as member}
                <div
                  class="bg-(--intermediate-color) rounded-xl overflow-hidden"
                >
                  <CharacterIcon
                    name={member}
                    icon={mapping.get(member) ?? null}
                    rarity={null}
                  />
                </div>
              {/each}
            </li>
          {/each}
        </ul>
      </div>
      <div class="flex col-span-1 justify-center flex-col">
        <h1>Bottom Half Teams</h1>
        <ul class="grid grid-cols-1 gap-y-4">
          {#each ($teamsOwnedBottom ?? []).slice(0, 25) as team}
            <li
              class="grid grid-cols-4 gap-x-2 border rounded-xl p-2 bg-(--foreground-color)"
            >
              {#each team.members as member}
                <div
                  class="bg-(--intermediate-color) rounded-xl overflow-hidden"
                >
                  <CharacterIcon
                    name={member}
                    icon={mapping.get(member) ?? null}
                    rarity={null}
                  />
                </div>
              {/each}
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</main>
