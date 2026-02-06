<script lang="ts">
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import type { AbyssTeam, StygianTeam } from "$lib/definitions";
  let {
    team,
    mapping,
  }: { team: AbyssTeam | StygianTeam; mapping: Map<string, string> } = $props();
</script>

<div class="grid grid-cols-4 gap-x-2 md:gap-x-4 border p-2 rounded-xl">
  {#each team.members as member}
    <div class="bg-(--intermediate-color) rounded-xl overflow-hidden">
      <CharacterIcon
        name={member}
        icon={mapping.get(member) ?? null}
        rarity={null}
      />
    </div>
  {/each}
</div>
