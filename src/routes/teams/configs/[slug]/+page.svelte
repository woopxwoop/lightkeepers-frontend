<script lang="ts">
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import {
    buildGoodKeyMap,
    humanizeTeamName,
    namesFromGoodKeyMap,
  } from "$lib/utils";
  import {
    humanizeInvestmentLabel,
    ensureEquipmentData,
  } from "$lib/equipment-data";
  import { useEquipmentData } from "$lib/equipment-data.svelte";
  import { onMount } from "svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PageTrail from "$lib/ui/components/PageTrail.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import CostPopover from "$lib/ui/components/CostPopover.svelte";
  import InvestmentBuildCard from "$lib/ui/components/InvestmentBuildCard.svelte";
  import RotationTimeline from "$lib/ui/components/RotationTimeline.svelte";

  let { data } = $props();
  const equipment = useEquipmentData();
  let team = $derived(data.team);
  let sim = $derived(data.sim);
  let configText = $derived(data.configText);
  let configUrl = $derived(data.configUrl);
  let rotation = $derived(data.rotation);
  let kitsByKey = $derived(data.kitsByKey);

  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));
  let characterNames = $derived(namesFromGoodKeyMap(goodKeyMap));
  let teamTitle = $derived(humanizeTeamName(team.characters, characterNames));
  let simLabel = $derived.by(() => {
    void equipment.version;
    return sim.kind === "baseline"
      ? "Baseline"
      : sim.label
        ? humanizeInvestmentLabel(sim.label, characterNames, {
            fiveStarWeaponsAs: sim.kind === "owned" ? "name" : "R1",
          })
        : "";
  });

  onMount(() => {
    void ensureEquipmentData();
  });

  function characterFor(key: string) {
    return goodKeyMap.get(key) ?? null;
  }
</script>

<PageShell class="gap-8 {$animationsEnabled ? '' : 'no-page-anim'}">
  <header class="page-head">
    <PageTrail
      items={[
        { label: "Teams", href: "/teams" },
        { label: teamTitle, href: `/teams/${team.team_key}` },
        { label: simLabel || "Config" },
      ]}
    />
    <h1 class="page-title">{simLabel || teamTitle}</h1>
    <p class="page-meta">
      <span>{(sim.dps / 1000).toFixed(1)}K DPS</span>
      <span aria-hidden="true">·</span>
      <span><CostPopover label="Cost" /> {sim.cost}</span>
    </p>
  </header>

  <section class="section">
    <div class="builds-grid">
      {#each sim.characters as build (build.key)}
        <InvestmentBuildCard
          {build}
          character={characterFor(build.key)}
          kit={kitsByKey[build.key] ?? null}
        />
      {/each}
    </div>
    <p class="footnote">
      Sheet totals exclude artifact set bonuses and weapon passives.
    </p>
  </section>

  {#if rotation && rotation.events.length > 0}
    <section class="section">
      <h2 class="section-title">Rotation sample</h2>
      <RotationTimeline
        sample={rotation}
        characterByKey={goodKeyMap}
        script={configText}
      />
    </section>
  {:else if sim.kind === "baseline"}
    <section class="section">
      <h2 class="section-title">Rotation sample</h2>
      <p class="muted">Rotation sample not available for this config.</p>
    </section>
  {/if}

  <section class="section">
    <div class="section-head">
      <h2 class="section-title">gcsim config</h2>
      <a
        href={configUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="meta-link"
      >
        Open raw →
      </a>
    </div>
    {#if configText}
      <Surface flush class="config-surface">
        <pre class="config-block">{configText}</pre>
      </Surface>
    {:else}
      <p class="muted">Config file not found on CDN for this build.</p>
    {/if}
  </section>
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .page-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
  }

  .meta-link {
    color: var(--accent-1);
  }

  .meta-link:hover {
    text-decoration: underline;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .builds-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  @media (min-width: 1024px) {
    .builds-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  :global(.config-surface) {
    --border-subtle: rgba(255, 255, 255, 0.14);
    overflow: hidden;
  }

  .footnote,
  .muted {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .config-block {
    margin: 0;
    padding: 1rem;
    font-size: 0.7rem;
    line-height: 1.55;
    color: var(--foreground-mid);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 32rem;
    overflow: auto;
  }

  :global(.page-shell.no-page-anim) {
    --sk-animation: none;
    --pulse-animation: none;
  }
</style>
