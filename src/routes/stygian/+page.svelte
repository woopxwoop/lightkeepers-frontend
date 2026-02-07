<script lang="ts">
  import type { Tables } from "$lib/types/database.types";
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import Team from "$lib/components/Team.svelte";
  import {
    teamsOwnedStygianTop,
    teamsOwnedStygianMiddle,
    teamsOwnedStygianBottom,
  } from "$lib/stores";

  let { data } = $props();

  let mapping: Map<string, string> = $derived(data.mapping);
  let loading = $state(true);

  let showTop = $state(true);
  let showMid = $state(false);
  let showBot = $state(false);

  $inspect(showTop);
  $inspect(showMid);
  $inspect(showBot);

  function switchTab(tab: string) {
    switch (tab) {
      case "mid":
        showTop = false;
        showMid = true;
        showBot = false;
        break;
      case "bot":
        showTop = false;
        showMid = false;
        showBot = true;
        break;
      default:
        showTop = true;
        showMid = false;
        showBot = false;
    }
  }

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
    <div class="w-full flex flex-col justify-center items-center">
      <div class="lg:hidden w-full flex flex-row text-center">
        <button
          class="flex-1 cursor-pointer rounded-t-xl"
          onclick={() => switchTab("top")}
          class:invert-theme={showTop}>Field 1</button
        >
        <button
          class="flex-1 cursor-pointer rounded-t-xl"
          onclick={() => switchTab("mid")}
          class:invert-theme={showMid}>Field 2</button
        >
        <button
          class="flex-1 cursor-pointer rounded-t-xl"
          onclick={() => switchTab("bot")}
          class:invert-theme={showBot}>Field 3</button
        >
      </div>

      <div class="hidden lg:flex w-full flex-row text-center mb-2 gap-x-10">
        <h2 class="flex-1">Field 1</h2>
        <h2 class="flex-1">Field 2</h2>
        <h2 class="flex-1">Field 3</h2>
      </div>

      <div
        class="grid lg:grid-cols-3 gap-x-10 w-full text-center place-items-start"
      >
        <div
          class="lg:flex col-span-1 justify-center flex-col bg-(--foreground-color)"
          class:hidden={!showTop}
        >
          <div class="grid grid-cols-1 gap-y-1">
            {#each ($teamsOwnedStygianTop ?? []).slice(0, 25) as team}
              <Team {team} {mapping}></Team>
            {/each}
          </div>
        </div>
        <div
          class="lg:flex col-span-1 justify-center flex-col bg-(--foreground-color)"
          class:hidden={!showMid}
        >
          <div class="grid grid-cols-1 gap-y-1">
            {#each ($teamsOwnedStygianMiddle ?? []).slice(0, 25) as team}
              <Team {team} {mapping}></Team>
            {/each}
          </div>
        </div>
        <div
          class="lg:flex col-span-1 justify-center flex-col bg-(--foreground-color)"
          class:hidden={!showBot}
        >
          <div class="grid grid-cols-1 gap-y-1">
            {#each ($teamsOwnedStygianBottom ?? []).slice(0, 25) as team}
              <Team {team} {mapping}></Team>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>
