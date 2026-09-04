<script lang="ts">
  /**
   * Character → Build button sheet. Fetches topic=build (no personalize) and
   * mounts BuildPanel when view === "build".
   */
  import { tick, untrack } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import {
    collectOwnedResearchGearKeys,
    postResearchBuild,
    type ResearchOwnedGearKeys,
  } from "$lib/app/research";
  import {
    loadRosterArtifacts,
    loadRosterWeapons,
  } from "$lib/app/roster-inventory";
  import type { ResearchResponse } from "$lib/research-types";
  import { charactersOwned } from "$lib/stores";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import { acquireBodyScrollLock } from "$lib/ui/body-scroll-lock";
  import BuildPanel from "$lib/ui/components/BuildPanel.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import ResearchTrace from "$lib/ui/components/ResearchTrace.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import { get } from "svelte/store";

  let {
    open = $bindable(false),
    focusNameId,
    characterName = null,
  }: {
    open?: boolean;
    focusNameId: string;
    characterName?: string | null;
  } = $props();

  let panelEl: HTMLDivElement | null = $state(null);
  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);
  let closedByNavigate = false;

  let loading = $state(false);
  let error = $state<string | null>(null);
  let response = $state<ResearchResponse | null>(null);
  let ownedGear = $state<ResearchOwnedGearKeys | null>(null);
  let loadedFor = $state<string | null>(null);
  let requestGen = 0;

  function close() {
    open = false;
  }

  afterNavigate(() => {
    if (!open) return;
    closedByNavigate = true;
    close();
  });

  async function loadOwnedGear(): Promise<ResearchOwnedGearKeys> {
    let weapons = null;
    let artifacts = null;
    try {
      weapons = await loadRosterWeapons();
    } catch {
      // Soft-fail — badges just show unowned.
    }
    try {
      artifacts = await loadRosterArtifacts();
    } catch {
      // Soft-fail.
    }
    return collectOwnedResearchGearKeys({
      inventoryWeapons: weapons,
      inventoryArtifacts: artifacts,
      characters: get(charactersOwned),
    });
  }

  async function loadBuild(nameId: string, force = false) {
    if (!nameId) return;
    if (!force && loadedFor === nameId && response) return;

    const gen = ++requestGen;
    loading = true;
    error = null;
    if (force || loadedFor !== nameId) {
      response = null;
      ownedGear = null;
    }

    try {
      const [res, gear] = await Promise.all([
        postResearchBuild(nameId),
        loadOwnedGear(),
      ]);
      if (gen !== requestGen) return;
      response = res;
      ownedGear = gear;
      loadedFor = nameId;
    } catch (err) {
      if (gen !== requestGen) return;
      error = err instanceof Error ? err.message : "Build research failed";
      loadedFor = null;
      response = null;
    } finally {
      if (gen === requestGen) loading = false;
    }
  }

  $effect(() => {
    if (!open) return;
    const id = focusNameId;
    if (!id) return;
    // Do not track response/loadedFor — updating them must not re-enter load.
    untrack(() => {
      void loadBuild(id);
    });
  });

  $effect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const releaseScrollLock = acquireBodyScrollLock();
    let active = true;
    void tick().then(() => {
      if (!active || !open) return;
      panelEl?.querySelector<HTMLElement>(".sheet-close")?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (panelEl) trapTabKey(e, panelEl);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      active = false;
      releaseScrollLock();
      window.removeEventListener("keydown", onKey);
      const skipFocus = closedByNavigate;
      closedByNavigate = false;
      if (previous?.isConnected && !skipFocus) previous.focus();
    };
  });

  let isBuildView = $derived(response?.view === "build");
</script>

{#if open}
  <div class="sheet-root">
    <button
      type="button"
      class="sheet-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={close}
      transition:fade={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="sheet-panel"
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="build-research-title"
      tabindex="-1"
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <div class="sheet-head">
        <h2 id="build-research-title" class="sheet-title">
          Build · {characterName ?? focusNameId}
        </h2>
        <button
          type="button"
          class="sheet-close"
          onclick={close}
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
      </div>
      <div class="sheet-body">
        {#if loading}
          <div class="build-state" aria-busy="true" aria-label="Loading build">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
          </div>
        {:else if error}
          <div class="build-state build-error" role="alert">
            <p class="section-title">Couldn’t load build</p>
            <p class="section-lede">{error}</p>
            <Button variant="secondary" onclick={() => void loadBuild(focusNameId, true)}>
              Retry
            </Button>
          </div>
        {:else if response && isBuildView}
          <BuildPanel
            focus_name_id={response.focus_name_id ?? focusNameId}
            markdown={response.answer_markdown}
            entities={response.entities ?? []}
            citations={response.citations}
            disagreements={response.disagreements ?? []}
            weapon_ranks={response.weapon_ranks ?? []}
            artifact_ranks={response.artifact_ranks ?? []}
            artifact_options={response.artifact_options ?? []}
            stat_priority={response.stat_priority ?? null}
            {ownedGear}
            characterLabel={characterName}
          />
          {#if response.trace}
            <ResearchTrace trace={response.trace} />
          {/if}
        {:else if response}
          <div class="build-state build-error" role="alert">
            <p class="section-title">Unexpected response</p>
            <p class="section-lede">
              Agent did not return a Build view. Try again from Research.
            </p>
            <Button variant="secondary" onclick={() => void loadBuild(focusNameId, true)}>
              Retry
            </Button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet-root {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .sheet-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 62%, transparent);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .sheet-panel {
    position: relative;
    z-index: 1;
    width: min(92vw, 40rem);
    height: min(88vh, 52rem);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem 0.85rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--background-color);
    box-shadow: 0 22px 56px color-mix(in oklab, black 50%, transparent);
    pointer-events: auto;
  }

  .sheet-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .sheet-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--foreground-color);
  }

  .sheet-close {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    flex-shrink: 0;
  }

  .sheet-close:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .sheet-body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0.15rem 0.1rem 0.35rem;
  }

  .build-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding: 1.25rem 0.5rem;
  }

  .build-state[aria-busy="true"] {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    min-height: 8rem;
    gap: 0.4rem;
  }

  .thinking-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--foreground-color) 45%, transparent);
    animation: build-pulse 1s ease-in-out infinite;
  }

  .thinking-dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .thinking-dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes build-pulse {
    0%,
    100% {
      opacity: 0.35;
      transform: translateY(0);
    }
    50% {
      opacity: 1;
      transform: translateY(-0.15rem);
    }
  }

  .build-error .section-title,
  .build-error .section-lede {
    margin: 0;
  }
</style>
