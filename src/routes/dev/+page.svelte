<script lang="ts">
  import { resolve } from "$app/paths";
  import PageShell from "$lib/ui/components/PageShell.svelte";
</script>

<PageShell class="gap-6">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Dev</h1>
      <p class="page-meta">
        Internal pages (vite dev only).
        <span class="page-meta-sep" aria-hidden="true">·</span>
        <a class="back-link" href={resolve("/dev/ui")}>UI gallery</a>
        <span class="page-meta-sep" aria-hidden="true">·</span>
        <a class="back-link" href={resolve("/dev/research-chat")}>Research</a>
        <span class="page-meta-sep" aria-hidden="true">·</span>
        <a class="back-link" href={resolve("/dev/infographics")}
          >Infographics → Abyss summary</a
        >
      </p>
    </div>
  </header>
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .page-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 0.5rem;
  }
</style>
