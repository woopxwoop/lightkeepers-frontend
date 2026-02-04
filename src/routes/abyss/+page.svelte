<script lang="ts">
  import { onMount } from "svelte";
  import { db } from "$lib/supabaseClient";
  import type { Tables } from "$lib/types/database.types";
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

<main>
  {#if loading}
    <div>loading teams data</div>
  {:else}
    <div class="grid grid-cols-2 gap-10">
      <div class="col-span-1">
        <h1>Top Half Teams</h1>
        <ul>
          {#each ($teamsOwnedTop ?? []).slice(0, 25) as team}
            <li class="grid grid-cols-4">
              {#each team.members as member}
                <img
                  src={mapping.get(member) ?? ""}
                  alt="character portrait"
                  class="inline-block col-span-1"
                />
              {/each}
            </li>
          {/each}
        </ul>
      </div>
      <div class="col-span-1">
        <h1>Bottom Half Teams</h1>
        <ul>
          {#each ($teamsOwnedBottom ?? []).slice(0, 25) as team}
            <li class="grid grid-cols-4">
              {#each team.members as member}
                <img
                  src={mapping.get(member) ?? ""}
                  alt="character portrait"
                  class="inline-block col-span-1"
                />
              {/each}
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</main>
