<script lang="ts">
  import {
    charactersOwned,
    writeTopAbyssTeamsOwned,
    writeTopStygianTeamsOwned,
  } from "$lib/stores";
  import { onMount } from "svelte";
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import type { CharacterOwned } from "$lib/definitions";

  let tempCharactersOwned: CharacterOwned[] = $state([]);
  let tempFiveStarsOwned: CharacterOwned[] = $derived(
    tempCharactersOwned.filter((c) => c.rarity === 5),
  );
  let synced = $state(false);
  let show4Stars = $state(true);

  let showSaved = $state(false);

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
    writeTopStygianTeamsOwned($charactersOwned);
    showSaved = true;

    // ADD SUCCESS INDICATOR
    setTimeout(() => {
      showSaved = false;
    }, 2000);
  }

  onMount(() => {
    synced = false;
  });

  $effect(() => {
    if ($charactersOwned.length > 0 && !synced) {
      tempCharactersOwned = [...$charactersOwned];
      synced = true;
    }
  });
</script>

<main class="w-[80%]">
  <div class="flex flex-row w-full justify-end mb-4">
    <input
      type="checkbox"
      bind:checked={show4Stars}
      aria-label="toggle four star characters"
    />
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 14 14"
      class="w-4 text-purple-500"
    >
      <path
        d="M5.254 13.563a.14.14 0 0 1-.068-.12c0-.023.056-.368.125-.768.089-.518.122-.73.116-.741-.004-.009-.248-.25-.541-.535s-.54-.532-.547-.547a.18.18 0 0 1-.002-.14c.032-.068.002-.06.824-.18.41-.06.753-.113.762-.119a15 15 0 0 0 .347-.683c.183-.37.339-.68.347-.69a.2.2 0 0 1 .112-.048c.031 0 .084.024.107.05.008.008.164.318.346.688s.339.677.348.683c.01.006.352.06.762.119.822.12.791.113.823.18a.18.18 0 0 1-.001.14c-.008.015-.254.26-.548.547-.293.285-.536.526-.54.535-.007.01.028.227.116.742.068.4.125.745.125.768a.14.14 0 0 1-.14.139c-.052 0 .005.028-.752-.37a14 14 0 0 0-.649-.331c-.01 0-.297.145-.635.323-.339.178-.64.336-.67.35q-.101.051-.166.008zM.962 9.271a.14.14 0 0 1-.068-.12c0-.022.056-.368.125-.767.089-.518.122-.731.116-.742-.004-.008-.248-.25-.54-.535a17 17 0 0 1-.549-.547.18.18 0 0 1-.001-.14c.032-.067 0-.06.823-.18.41-.06.753-.113.762-.119a15 15 0 0 0 .348-.683c.182-.37.338-.68.346-.689a.2.2 0 0 1 .112-.048c.032 0 .085.023.107.048.008.01.164.32.346.69.183.369.34.676.348.682.01.006.352.06.762.12.822.119.791.112.823.18a.18.18 0 0 1 0 .14c-.01.014-.255.26-.548.546s-.537.526-.541.535c-.007.01.028.227.116.742.069.4.125.745.125.768a.14.14 0 0 1-.14.139c-.052 0 .006.028-.752-.37a15 15 0 0 0-.648-.331c-.011 0-.297.145-.636.323s-.64.336-.67.35q-.101.052-.166.008M5.254 4.98a.14.14 0 0 1-.068-.12c0-.023.056-.369.125-.768.089-.518.122-.73.116-.742-.004-.008-.248-.25-.541-.535s-.54-.532-.547-.546a.18.18 0 0 1-.001-.14c.032-.068 0-.061.823-.18.41-.06.753-.114.762-.12a15 15 0 0 0 .347-.683c.183-.37.339-.68.347-.689A.2.2 0 0 1 6.729.41c.031 0 .084.024.107.049.008.009.164.318.346.688s.339.677.348.683c.01.007.352.06.762.12.822.119.791.112.823.18a.18.18 0 0 1-.001.14c-.008.014-.255.26-.548.546a29 29 0 0 0-.54.535c-.007.01.028.227.116.742.068.4.125.745.125.768a.14.14 0 0 1-.14.139c-.052 0 .005.028-.752-.37a15 15 0 0 0-.649-.331c-.01 0-.297.145-.635.323l-.67.351q-.101.05-.166.007zm4.837 4.291a.14.14 0 0 1-.068-.12c0-.022.056-.368.125-.767.089-.518.122-.731.116-.742a28 28 0 0 0-.54-.535c-.294-.286-.54-.532-.548-.546a.18.18 0 0 1-.001-.14c.032-.068 0-.062.823-.18.41-.06.753-.114.762-.12s.165-.313.347-.683c.183-.37.339-.68.347-.689a.2.2 0 0 1 .112-.048.18.18 0 0 1 .107.048c.008.01.164.32.346.69s.339.676.348.682c.01.006.352.06.762.12.822.119.791.112.823.18a.18.18 0 0 1 0 .14c-.01.014-.255.26-.548.546a29 29 0 0 0-.541.535c-.007.01.028.227.116.742.069.4.125.745.125.768a.14.14 0 0 1-.14.139c-.052 0 .005.028-.752-.37a14 14 0 0 0-.649-.331c-.01 0-.297.145-.635.323-.339.178-.64.336-.67.35q-.101.052-.166.008z"
        style="fill:currentColor;stroke-width:.00687583"
      ></path>
    </svg>
  </div>

  {#if synced}
    <div
      class="w-full grid grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-4"
    >
      {#if show4Stars}
        {#each tempCharactersOwned as character (character.id)}
          <div>
            <button
              onclick={() => toggleOwned(character.id)}
              class="padding-0 cursor-pointer border-(--foreground-color) border-2 rounded-xl w-full overflow-hidden relative hover:-translate-y-2 duration-75"
              class:opacity-50={!character.isOwned}
            >
              <CharacterIcon
                icon={character.icon}
                name={character.name}
                rarity={character.rarity}
              />
            </button>
          </div>
        {/each}
      {:else}
        {#each tempFiveStarsOwned as character (character.id)}
          <div>
            <button
              onclick={() => toggleOwned(character.id)}
              class="bg-(--background-color) padding-0 cursor-pointer border-(--foreground-color) border-2 rounded-xl w-full overflow-hidden relative hover:-translate-y-2 duration-75"
              class:opacity-50={!character.isOwned}
            >
              <CharacterIcon
                icon={character.icon}
                name={character.name}
                rarity={character.rarity}
              />
            </button>
          </div>
        {/each}
      {/if}
    </div>
    <button
      onclick={() => saveCharacters()}
      class="uppercase text-sm font-bold p-3 cursor-pointer rounded-lg w-full bg-(--foreground-color) text-(--background-color) hover:opacity-75"
    >
      {showSaved ? "Successfully Saved" : "Save Character Selection"}
    </button>
  {:else}
    <div>loading</div>
  {/if}
</main>
