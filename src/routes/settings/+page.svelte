<script lang="ts">
  import { charactersOwned, writeTopAbyssTeamsOwned } from "$lib/stores";
  import { onMount } from "svelte";
  import type { CharacterOwned } from "$lib/definitions";

  let hasChanged = $state(false);
  let tempCharactersOwned: CharacterOwned[] = $derived([]);
  let synced = $state(false);

  function toggleOwned(id: string) {
    tempCharactersOwned = tempCharactersOwned.map((character) => {
      if (character.id == id) {
        console.log(`toggle ${character.name}`);
        return { ...character, isOwned: !character.isOwned };
      } else return character;
    });
  }

  function saveCharacters() {
    localStorage.setItem(
      "charactersOwned",
      JSON.stringify(tempCharactersOwned),
    );
    charactersOwned.set(tempCharactersOwned);
    writeTopAbyssTeamsOwned($charactersOwned);

    // ADD SUCCESS INDICATOR
  }

  $effect(() => {
    if ($charactersOwned.length > 0 && !synced) {
      tempCharactersOwned = $charactersOwned;
      synced = true;
    }
  });
</script>

<main>
  {#if synced}
    <div class="w-full grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
      {#each tempCharactersOwned as character (character.id)}
        <div>
          <button
            onclick={() => toggleOwned(character.id)}
            class="bg-transparent, border-none, padding-0 cursor-pointer"
          >
            <img
              src={character.icon}
              alt="portrait of {character.name}"
              class:brightness-50={!character.isOwned}
            />
          </button>
        </div>
      {/each}
    </div>
    <button
      onclick={() => saveCharacters()}
      class="uppercase text-sm font-bold p-3 cursor-pointer rounded-lg w-full bg-(--foreground-color) text-(--background-color) hover:opacity-75"
    >
      Save Characters
    </button>
  {:else}
    <div>loading</div>
  {/if}
</main>
