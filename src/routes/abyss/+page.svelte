<script lang="ts">
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import Team from "$lib/components/Team.svelte";
  import { teamsOwnedTop, teamsOwnedBottom } from "$lib/stores";

  let { data } = $props();

  let mapping: Map<string, string> = $derived(data.mapping);
  let loading = $state(true);

  let showTop = $state(true);
  function switchTab(tab: string) {
    showTop = !showTop;
  }

  $effect(() => {
    loading = $teamsOwnedTop.length == 0 || $teamsOwnedBottom.length == 0;
  });
</script>

<main class="w-[80%]">
  {#if loading}
    <div>loading teams data</div>
  {:else}
    <div class="w-full flex flex-col justify-center items-center">
      <div class="md:hidden w-full flex flex-row text-center">
        <button
          class="flex-1 cursor-pointer rounded-t-xl"
          onclick={() => switchTab("top")}
          class:invert-theme={showTop}>Top Side</button
        >
        <button
          class="flex-1 cursor-pointer rounded-t-xl"
          onclick={() => switchTab("bot")}
          class:invert-theme={!showTop}>Bottom Side</button
        >
      </div>

      <div class="hidden md:flex w-full flex-row text-center mb-2 gap-x-10">
        <h2 class="flex-1">Top Side</h2>
        <h2 class="flex-1">Bottom Side</h2>
      </div>

      <div
        class="grid md:grid-cols-2 gap-x-10 w-full text-center place-items-start"
      >
        <div
          class="md:flex col-span-1 justify-center flex-col bg-(--foreground-color)"
          class:hidden={!showTop}
        >
          <div class="grid grid-cols-1 gap-y-1">
            {#each ($teamsOwnedTop ?? []).slice(0, 25) as team}
              <Team {team} {mapping} />
            {/each}
          </div>
        </div>
        <div
          class="md:flex col-span-1 justify-center flex-col bg-(--foreground-color)"
          class:hidden={showTop}
        >
          <div class="grid grid-cols-1 gap-y-1">
            {#each ($teamsOwnedBottom ?? []).slice(0, 25) as team}
              <Team {team} {mapping} />
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>
