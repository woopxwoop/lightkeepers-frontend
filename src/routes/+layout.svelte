<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { page } from "$app/state";
	import { resolve } from "$app/paths";
	import type { Tables } from "$lib/types/database.types";

	type Character = Tables<"characters">;
	type CharacterOwned = Character & { isOwned: boolean };

	let { data, children } = $props();

	let mapping: Map<string, string> = $derived(data.mapping);
	let characters: Character[] = $derived(data.characters);
	let charactersOwned: CharacterOwned[] = $state([]);

	$effect(() => {
		charactersOwned = characters.map((c) => {
			return {
				icon: c.icon,
				id: c.id,
				name: c.name,
				rarity: c.rarity,
				isOwned: true,
			};
		});
	});

	function toggleOwned(id: string) {
		const c = charactersOwned.find((character) => character.id == id);
		if (c) c.isOwned = !c.isOwned;
		console.log(`toggle ${c?.name}`);
	}

	function saveCharacters() {
		
	}

	// paths
	const homePath = resolve("/");
	const abyssPath = resolve("/abyss");
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav>
	<a href={homePath} aria-current={page.url.pathname === homePath}> home </a>
	<a href={abyssPath} aria-current={page.url.pathname === abyssPath}> abyss </a>
</nav>

<aside>
	{#each charactersOwned as character (character.id)}
		<div>
			<button
				onclick={() => toggleOwned(character.id)}
				style="background: none; border: none; padding: 0;"
			>
				<img
					src={character.icon}
					alt="portrait of {character.name}"
					class:darken={!character.isOwned}
				/>
			</button>
		</div>
	{/each}
	<button onclick={() => saveCharacters()}> Save Characters </button>
</aside>

{@render children()}

<style>
	.darken {
		filter: brightness(0.5);
	}
</style>
