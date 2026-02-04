<script lang="ts">
  import type { Character } from "$lib/definitions";
  let {
    icon,
    name,
    rarity,
  }: { icon: string | null; name: string; rarity: number | null } = $props();
</script>

<div>
  <img src={icon ?? "add default src here"} alt={name} />
</div>
