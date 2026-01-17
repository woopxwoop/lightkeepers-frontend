<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav>
	<div><a href="/"> home </a></div>
	<div><a href="/abyss"> abyss </a></div>
</nav>
{@render children()}
