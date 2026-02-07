<script lang="ts">
  import CharacterIcon from "$lib/components/CharacterIcon.svelte";
  import avatarImg from "$lib/assets/default-avatar.jpg";

  import type { AbyssTeam, StygianTeam } from "$lib/definitions";
  let {
    team,
    mapping,
  }: { team: AbyssTeam | StygianTeam; mapping: Map<string, string> } = $props();
</script>

<div
  class="grid grid-cols-4 gap-x-1 md:gap-x-2 border p-1 rounded-xl bg-black/30 backdrop-blur-sm"
>
  {#each team.members as member}
    <div
      class="rounded-xl overflow-hidden border-2 border-(--foreground-color) bg-gray-700"
    >
      <CharacterIcon
        name={member}
        icon={mapping.get(member) ?? avatarImg}
        rarity={null}
      />
    </div>
  {/each}
</div>
