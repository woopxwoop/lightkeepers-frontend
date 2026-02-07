<script lang="ts">
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import {
    charactersOwned,
    writeTopAbyssTeamsOwned,
    writeTopStygianTeamsOwned,
  } from "$lib/stores";
  import { onMount } from "svelte";
  import type { Character, CharacterOwned } from "$lib/definitions";
  import "../app.css";

  let { data, children } = $props();

  let characters: Character[] = $derived(data.characters);

  $inspect($charactersOwned);

  onMount(async () => {
    let cachedCharactersOwnedJSON = localStorage.getItem("charactersOwned");
    let cachedCharactersOwned: CharacterOwned[] | undefined =
      cachedCharactersOwnedJSON
        ? JSON.parse(cachedCharactersOwnedJSON)
        : undefined;

    if (cachedCharactersOwned) {
      // add characters not in the cache
      let finalList: CharacterOwned[] = characters.map((c) => {
        let cachedChar = cachedCharactersOwned.find((c2) => c2.id === c.id);

        if (cachedChar) return cachedChar;
        else {
          return {
            icon: c.icon,
            id: c.id,
            name: c.name,
            rarity: c.rarity,
            isOwned: true,
          };
        }
      });

      charactersOwned.set(finalList);
    } else {
      charactersOwned.set(
        characters.map((c) => {
          return {
            icon: c.icon,
            id: c.id,
            name: c.name,
            rarity: c.rarity,
            isOwned: true,
          };
        }),
      );
    }
    await writeTopAbyssTeamsOwned($charactersOwned);
    await writeTopStygianTeamsOwned($charactersOwned);
  });

  // paths
  const homePath = resolve("/");
  const abyssPath = resolve("/abyss");
  const stygianPath = resolve("/stygian");
  const settingsPath = resolve("/settings");
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="w-full flex flex-col items-center">
  <nav
    class="w-[60%] flex flex-row justify-center gap-4 text-3xl rounded-3xl border-(--foreground-color) border-2 translate-y-4 p-2 fixed backdrop-blur-xs z-10"
  >
    <a href={homePath} aria-current={page.url.pathname === homePath}> Home </a>
    <a href={abyssPath} aria-current={page.url.pathname === abyssPath}>
      Abyss
    </a>
    <a href={stygianPath} aria-current={page.url.pathname === stygianPath}>
      Stygian
    </a>
    <a href={settingsPath} aria-current={page.url.pathname === settingsPath}>
      Settings
    </a>
  </nav>
  <div class="mt-20"></div>

  {@render children()}
</div>
