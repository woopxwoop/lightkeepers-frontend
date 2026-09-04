<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import { dev } from "$app/environment";
  import { animationsEnabled, charactersOwned } from "$lib/stores";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PageTrail from "$lib/ui/components/PageTrail.svelte";
  import ActionMenu from "$lib/ui/components/ActionMenu.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import BuildResearchSheet from "$lib/ui/components/BuildResearchSheet.svelte";
  import CharacterKitPanel from "$lib/ui/components/character/CharacterKitPanel.svelte";
  import CharacterTeamsPanel from "$lib/ui/components/character/CharacterTeamsPanel.svelte";
  import CharacterAnalyticsPanel from "$lib/ui/components/character/CharacterAnalyticsPanel.svelte";
  import CharacterBuildsPanel from "$lib/ui/components/character/CharacterBuildsPanel.svelte";
  import { elementColor } from "$lib/element-colors";
  import {
    buildGoodKeyMap,
    getUiAssetUrl,
    ownedGoodKeys,
    ownedNameIds,
    getCrimsonWitchLinks,
    simCharacterKey,
  } from "$lib/utils";
  import { travelerElementKitId } from "$lib/traveler-kits";
  import type { CharacterKit } from "$lib/types/character-kit";
  import type { CharacterIndex } from "$lib/types/investment";
  import type { Character } from "$lib/definitions";
  import { isStaleBuildSummary } from "$lib/stale-build-summary";
  import type { ActionMenuItem } from "$lib/ui/components/ActionMenu.svelte";

  let { data } = $props();
  let kit = $derived(data.kit as CharacterKit);
  let kitChannel = $derived((data.kitChannel ?? "live") as "live" | "beta");
  let rawBuilds = $derived((data.builds ?? null) as CharacterIndex | null);
  let buildsUnavailable = $derived(Boolean(data.buildsUnavailable));
  let summaryStale = $derived(
    isStaleBuildSummary(kit.name_id) || rawBuilds?.upToDate === false,
  );
  let builds = $derived(summaryStale ? null : rawBuilds);
  let travelerKits = $derived(
    (data.travelerKits ?? {}) as Record<string, CharacterKit>,
  );
  let mapping = $derived(data.mapping as Map<string, Character>);

  type PageTab = "skills" | "builds" | "teams" | "analytics";

  const TAB_OPTIONS = [
    { value: "builds" as const, label: "Builds" },
    { value: "teams" as const, label: "Teams" },
    { value: "analytics" as const, label: "Analytics" },
    { value: "skills" as const, label: "Kit" },
  ];

  let activeTab = $state<PageTab>("builds");
  let mobileNavOpen = $state(false);
  let skillsElement = $state("");
  let buildResearchOpen = $state(false);
  let activeTabLabel = $derived(
    TAB_OPTIONS.find((option) => option.value === activeTab)?.label ?? "Builds",
  );

  function selectTab(tab: PageTab) {
    activeTab = tab;
    mobileNavOpen = false;
  }

  function handleTabKeydown(event: KeyboardEvent, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % TAB_OPTIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + TAB_OPTIONS.length) % TAB_OPTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = TAB_OPTIONS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = TAB_OPTIONS[nextIndex].value;
    // Leave the mobile rail open while arrowing so focus stays visible.
    activeTab = nextTab;
    requestAnimationFrame(() => {
      document.getElementById(`tab-${nextTab}`)?.focus();
    });
  }

  let goodKey = $derived(simCharacterKey(kit));
  let crimsonWitchLinks = $derived(
    getCrimsonWitchLinks(kit.name, {
      isTraveler: kit.is_traveler,
      element: kit.element,
    }),
  );
  let goodKeyMap = $derived(buildGoodKeyMap($charactersOwned));

  let ownedKeys = $derived(ownedGoodKeys($charactersOwned));
  let ownedNameIdsSet = $derived(ownedNameIds($charactersOwned));

  let character = $derived(
    $charactersOwned.find((c) => c.name_id === kit.name_id),
  );

  let elColor = $derived(elementColor(kit.element, "var(--foreground-color)"));
  // Kit asset stem, not name_id: an elemental Traveler kit (`PlayerBoy-Anemo`)
  // still resolves `UI_NameCardPic_PlayerBoy_P` rather than a missing suffix key.
  let namecard = $derived(getUiAssetUrl(kit.assets.namecard));
  let plannerAddHref = $derived(
    `${resolve("/tools/planner")}?add=${encodeURIComponent(
      kit.is_traveler
        ? travelerElementKitId(kit.name_id, kit.element ?? "Pyro")
        : kit.name_id,
    )}`,
  );

  let heroMenuItems = $derived.by((): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [
      {
        id: "planner",
        label: "Add to planner",
        href: plannerAddHref,
      },
    ];
    for (const [index, link] of crimsonWitchLinks.entries()) {
      items.push({
        id: `crimson-witch-${link.element ?? index}`,
        label:
          crimsonWitchLinks.length === 1
            ? "Crimson Witch guide"
            : `Crimson Witch · ${link.label}`,
        href: link.url,
        external: true,
      });
    }
    return items;
  });

  onMount(() => {
    let hash = window.location.hash;
    try {
      hash = decodeURIComponent(hash);
    } catch {
      // Keep the raw hash when it is not valid URI encoding.
    }
    if (hash.startsWith("#kit-")) selectTab("skills");
  });
</script>

<PageShell class="char-detail {$animationsEnabled ? '' : 'no-page-anim'}">
  <div class="char-page" style="--hero-accent: {elColor};">
    <section class="hero relative overflow-hidden">
      <div
        class="hero-bg absolute inset-0"
        style="background-image: url('{namecard}');"
      ></div>
      <div class="hero-shade absolute inset-0"></div>
      <div
        class="hero-body relative z-10 flex flex-row items-center gap-3 sm:gap-4 md:gap-5"
      >
        {#if character}
          <div class="hero-portrait">
            <CharacterIcon {character} />
          </div>
        {/if}
        <div
          class="hero-copy flex flex-col gap-1.5 min-w-0 flex-1 pb-3 sm:pb-4 md:pb-5"
        >
          <div class="hero-name-block">
            <PageTrail
              class="hero-trail"
              items={[
                { label: "Characters", href: "/characters" },
                { label: kit.name },
              ]}
            />
            <div class="hero-title-row">
              <h1 class="hero-title">{kit.name}</h1>
              {#if kitChannel === "beta"}
                <span class="hero-beta-badge">BETA</span>
              {/if}
            </div>
          </div>
          <p class="hero-eyebrow" style="color: {elColor};">
            {kit.title || "Character"}
          </p>
        </div>
      </div>
      <div class="hero-menu">
        {#if dev}
          <Button
            variant="secondary"
            class="hero-build-btn"
            onclick={() => (buildResearchOpen = true)}
          >
            Build
          </Button>
        {/if}
        <ActionMenu label="Character actions" items={heroMenuItems} />
      </div>
    </section>

    <div class="character-content-shell" class:mobile-open={mobileNavOpen}>
      <button
        type="button"
        class="ledger-mobile-trigger"
        aria-expanded={mobileNavOpen}
        aria-controls="character-section-index"
        onclick={() => (mobileNavOpen = !mobileNavOpen)}
      >
        <span>
          <small>Section</small>
          <strong>{activeTabLabel}</strong>
        </span>
        <span class="ledger-trigger-mark" aria-hidden="true"></span>
      </button>

      <div
        class="ledger-rail"
        id="character-section-index"
        role="tablist"
        aria-label="Character sections"
        style:--section-count={TAB_OPTIONS.length}
        style:--section-rows={Math.ceil(TAB_OPTIONS.length / 2)}
      >
        {#each TAB_OPTIONS as option, index (option.value)}
          <button
            type="button"
            role="tab"
            id="tab-{option.value}"
            aria-selected={activeTab === option.value}
            aria-controls={activeTab === option.value
              ? `tabpanel-${option.value}`
              : undefined}
            tabindex={activeTab === option.value ? 0 : -1}
            class:active={activeTab === option.value}
            onclick={() => selectTab(option.value)}
            onkeydown={(event) => handleTabKeydown(event, index)}
          >
            {option.label}
          </button>
        {/each}
      </div>

      <div class="board-body">
        {#if activeTab === "skills"}
          <CharacterKitPanel
            {kit}
            {travelerKits}
            bind:skillsElement
            onNeedSkillsTab={() => selectTab("skills")}
          />
        {:else if activeTab === "teams"}
          <CharacterTeamsPanel
            nameId={kit.name_id}
            characterName={kit.name}
            {mapping}
            {goodKey}
            {goodKeyMap}
            {ownedKeys}
            {ownedNameIdsSet}
          />
        {:else if activeTab === "analytics"}
          <CharacterAnalyticsPanel
            nameId={kit.name_id}
            characterName={kit.name}
            {mapping}
            {ownedNameIdsSet}
          />
        {:else}
          <CharacterBuildsPanel
            {kit}
            {builds}
            {summaryStale}
            {buildsUnavailable}
            {elColor}
            {goodKey}
            {goodKeyMap}
            {crimsonWitchLinks}
          />
        {/if}
      </div>
    </div>
  </div>
</PageShell>

{#if dev}
  <BuildResearchSheet
    bind:open={buildResearchOpen}
    focusNameId={kit.name_id}
    characterName={kit.name}
  />
{/if}

<style>
  .char-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .hero {
    overflow: hidden;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(
        in srgb,
        var(--hero-accent, var(--foreground-mid)) 35%,
        transparent
      );
  }

  .hero-bg {
    background-size: cover;
    background-position: center;
    filter: saturate(0.9);
    opacity: 0.55;
  }

  .hero-shade {
    background: linear-gradient(
      100deg,
      color-mix(in srgb, var(--background-color) 88%, transparent) 0%,
      color-mix(in srgb, var(--background-color) 45%, transparent) 50%,
      color-mix(in srgb, var(--background-color) 20%, transparent) 100%
    );
  }

  .hero-body {
    padding: 1rem 3.25rem 1rem 1rem;
  }

  .hero-menu {
    position: absolute;
    top: 0.65rem;
    right: 0.65rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .hero-menu :global(.hero-build-btn) {
    border-color: var(--accent-1);
    background: color-mix(in srgb, var(--background-color) 72%, transparent);
    color: var(--foreground-color);
  }

  .hero-portrait {
    width: clamp(5.5rem, 28vw, 9rem);
    flex-shrink: 0;
    border-radius: var(--radius-lg);
    overflow: hidden;
    filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.4));
  }

  .hero-portrait :global(img) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .hero-portrait :global(.icon-container-tcg img) {
    object-position: top center;
  }

  .hero-copy {
    position: relative;
    z-index: 1;
  }

  .hero-name-block {
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
  }

  .hero-copy :global(.hero-trail .back-link) {
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
  }

  .hero-copy :global(.hero-trail .back-link:hover) {
    color: var(--accent-1);
  }

  .hero-copy :global(.hero-trail .trail-current) {
    color: var(--foreground-color);
  }

  .hero-eyebrow {
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
  }

  /* Mixed-case hero title — deliberately not the uppercase `.page-title`. */
  .hero-title {
    font-family: var(--font-display);
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 600;
    line-height: 1.05;
    color: var(--foreground-color);
  }

  .hero-title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem 0.75rem;
  }

  .hero-beta-badge {
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.2rem 0.4rem;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 14%, transparent);
    color: var(--foreground-color);
    border: 1px solid
      color-mix(in srgb, var(--foreground-color) 32%, transparent);
  }

  /* Outlined open frame — hairlines imply a board; complete it without a fill.
     Keep overflow visible so the kit side index can stick while the page scrolls. */
  .character-content-shell {
    display: grid;
    grid-template-columns: minmax(9rem, 12rem) minmax(0, 1fr);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-lg);
  }

  .ledger-mobile-trigger {
    display: none;
  }

  .ledger-rail {
    display: flex;
    flex-direction: column;
    border-right: var(--border-width) solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  }

  .ledger-rail button {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 2.8rem;
    padding: 0.65rem var(--space-3);
    border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.1);
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    text-align: left;
    transition: var(--control-transition);
  }

  .ledger-rail button:first-child {
    border-top-left-radius: var(--radius-lg);
  }

  .ledger-rail button:last-child {
    border-bottom-left-radius: var(--radius-lg);
  }

  .ledger-rail button::before {
    position: absolute;
    inset-block: 0;
    left: 0;
    width: 2px;
    background: transparent;
    content: "";
  }

  .ledger-rail button:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .ledger-rail button.active {
    color: var(--foreground-color);
    background: var(--surface-selected);
  }

  .ledger-rail button.active::before {
    background: var(--hero-accent, var(--accent-1));
  }

  .board-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  }

  /* Panels are focus targets (tabindex="0"), and the global ring only covers
     buttons and links. */
  .board-body :global([role="tabpanel"]:focus-visible) {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  :global(.char-detail) {
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
    --border-strong: rgba(255, 255, 255, 0.45);
  }

  :global(.char-detail.no-page-anim) {
    --sk-animation: none;
    --pulse-animation: none;
  }

  @media (max-width: 640px) {
    .character-content-shell {
      display: block;
    }

    .ledger-mobile-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 3.6rem;
      padding: 0.65rem var(--space-4);
      border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.14);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      color: var(--foreground-color);
      text-align: left;
      background: var(--surface-selected);
    }

    .ledger-mobile-trigger > span:first-child {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .ledger-mobile-trigger small {
      color: var(--foreground-mid);
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .ledger-mobile-trigger strong {
      font-family: var(--font-display);
      font-size: var(--text-base);
      font-weight: 600;
    }

    .ledger-trigger-mark {
      position: relative;
      display: grid;
      place-items: center;
      width: 1.8rem;
      height: 1.8rem;
      border: var(--border-width) solid rgba(255, 255, 255, 0.22);
      border-radius: var(--radius-pill);
      color: var(--hero-accent, var(--accent-1));
    }

    .ledger-trigger-mark::before,
    .ledger-trigger-mark::after {
      position: absolute;
      width: 0.65rem;
      height: 1px;
      background: currentColor;
      content: "";
      transition: transform var(--control-duration) var(--control-ease);
    }

    .ledger-trigger-mark::after {
      transform: rotate(90deg);
    }

    .character-content-shell.mobile-open .ledger-trigger-mark::after {
      transform: rotate(90deg) scaleX(0);
    }

    .ledger-rail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      max-height: 0;
      overflow: hidden;
      border-right: 0;
      border-radius: 0;
      border-bottom: var(--border-width) solid transparent;
      opacity: 0;
      visibility: hidden;
      transform: translateY(-0.35rem);
      transition:
        max-height 260ms var(--control-ease),
        opacity 180ms var(--control-ease),
        transform 260ms var(--control-ease),
        border-color 180ms var(--control-ease),
        visibility 0s linear 260ms;
    }

    .ledger-rail button:first-child,
    .ledger-rail button:last-child {
      border-radius: 0;
    }

    .board-body {
      border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    }

    .character-content-shell.mobile-open .ledger-rail {
      /* Two-column grid on mobile, so height follows rows, not section count. */
      max-height: calc(var(--section-rows) * 2.8rem);
      border-bottom-color: rgba(255, 255, 255, 0.14);
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
      transition:
        max-height 260ms var(--control-ease),
        opacity 180ms var(--control-ease),
        transform 260ms var(--control-ease),
        border-color 180ms var(--control-ease),
        visibility 0s;
    }

    .ledger-rail button:nth-child(even) {
      border-left: var(--border-width) solid rgba(255, 255, 255, 0.1);
    }
  }

  /* Both overrides must out-specify `.character-content-shell.mobile-open
     .ledger-rail`, which sets its own transition shorthand. */
  :global(.char-detail.no-page-anim) .character-content-shell .ledger-rail,
  :global(.char-detail.no-page-anim)
    .character-content-shell.mobile-open
    .ledger-rail,
  :global(.char-detail.no-page-anim) .ledger-trigger-mark::before,
  :global(.char-detail.no-page-anim) .ledger-trigger-mark::after {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .character-content-shell .ledger-rail,
    .character-content-shell.mobile-open .ledger-rail,
    .ledger-trigger-mark::before,
    .ledger-trigger-mark::after {
      transition: none;
    }
  }

  @media (min-width: 640px) {
    .hero-body {
      padding: 1.25rem;
      padding-right: 3.5rem;
    }

    .hero-menu {
      top: 0.85rem;
      right: 0.85rem;
    }

    .hero-portrait {
      width: clamp(7rem, 22vw, 10rem);
    }
  }

  @media (min-width: 768px) {
    .hero-body {
      padding: 1.5rem 1.75rem;
      padding-right: 3.75rem;
    }

    .hero-menu {
      top: 1rem;
      right: 1.15rem;
    }

    .hero-portrait {
      width: 10.5rem;
    }
  }
</style>
