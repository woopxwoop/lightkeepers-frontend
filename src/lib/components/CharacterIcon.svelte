<script lang="ts">
  import avatarImg from "$lib/assets/default-avatar.jpg";
  let {
    icon,
    name,
    rarity,
  }: { icon: string | null; name: string; rarity: number | null } = $props();
</script>

<div>
  <img src={icon ?? avatarImg} alt={name} />
</div>
