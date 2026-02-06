<script lang="ts">
  import type { Tables } from "$lib/types/database.types";
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import {
    teamsOwnedStygianTop,
    teamsOwnedStygianMiddle,
    teamsOwnedStygianBottom,
  } from "$lib/stores";

  let { data } = $props();

  let mapping: Map<string, string> = $derived(data.mapping);
  let loading = $state(true);

  $effect(() => {
    loading =
      $teamsOwnedStygianTop.length == 0 ||
      $teamsOwnedStygianMiddle.length == 0 ||
      $teamsOwnedStygianBottom.length == 0;
  });
</script>

<main class="w-[80%]">
  {#if loading}
    <div>loading teams data</div>
  {:else}
    <div class="grid grid-cols-3 gap-x-10 w-full text-center">
      <div class="flex col-span-1 justify-center flex-col">
        <h1>Top Teams</h1>
        <ul class="grid grid-cols-1 gap-y-4">
          {#each ($teamsOwnedStygianTop ?? []).slice(0, 25) as team}
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
        <h1>Middle Teams</h1>
        <ul class="grid grid-cols-1 gap-y-4">
          {#each ($teamsOwnedStygianMiddle ?? []).slice(0, 25) as team}
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
        <h1>Bottom Teams</h1>
        <ul class="grid grid-cols-1 gap-y-4">
          {#each ($teamsOwnedStygianBottom ?? []).slice(0, 25) as team}
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
