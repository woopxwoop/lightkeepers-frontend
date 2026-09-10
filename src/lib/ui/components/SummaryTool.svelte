<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    allTeamsAbyss,
    allTeamsStygian,
    abyssEnemiesBoard,
    stygianEnemiesBoard,
    stygianScheduleBoard,
    staticBoardsLoaded,
    staticBoardsError,
    ensureStaticBoards,
    isIconCompact,
    charactersOwned,
    hasSavedRoster,
  } from "$lib/stores";
  import {
    orderMembersLeadFirst,
    pickTopMainDpsGroups,
    type InfographicSlot,
    type MainDpsTeamGroup,
  } from "$lib/infographic-teams";
  import { getEnemyAsset } from "$lib/utils";
  import type { AbyssTeam, StygianTeam } from "$lib/definitions";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import SegmentedControl from "$lib/ui/components/SegmentedControl.svelte";
  import CharacterTagSearch from "$lib/ui/components/CharacterTagSearch.svelte";
  import PageTrail from "$lib/ui/components/PageTrail.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import { handleKeyboardClick, handlePointerAction } from "$lib/ui/pointer";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import { acquireBodyScrollLock } from "$lib/ui/body-scroll-lock";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { isOwnedNameId, ownedNameIds } from "$lib/utils";
  import { abyssPath, settingsPath, stygianPath } from "$lib/ui/nav-links";
  import { authClient } from "$lib/auth-client";
  import { needsRosterSetup } from "$lib/roster-setup";
  import type { Tables } from "$lib/types/database.types";

  const ABYSS_SLOTS = ["top", "bottom"] as const;
  const STYGIAN_SLOTS = ["top", "middle", "bottom"] as const;

  const ABYSS_HALF_LABEL: Record<(typeof ABYSS_SLOTS)[number], string> = {
    top: "First Half",
    bottom: "Second Half",
  };

  type Character = Tables<"characters">;
  type BoardTeam = AbyssTeam | StygianTeam;
  type DisplayGroup = MainDpsTeamGroup<BoardTeam> & {
    primary: BoardTeam;
    alternates: BoardTeam[];
  };

  let {
    mode,
    mapping,
  }: {
    mode: "abyss" | "stygian";
    mapping: Map<string, Character>;
  } = $props();

  let activeSlot = $state<InfographicSlot>("top");
  let dpsTags = $state<string[]>([]);
  let rosterFilter = $state<"all" | "owned">("all");
  let altsModal = $state<DisplayGroup | null>(null);
  let altsPanelEl: HTMLDivElement | null = $state(null);
  let altsCloseEl: HTMLButtonElement | null = $state(null);

  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);

  /** Algorithm floors — not exposed in the public tool chrome. */
  const topN = null;
  const maxAlternates = 10;
  const minSlotRate = 40;
  const minUsageIndex = 0.2;

  onMount(() => {
    ensureStaticBoards().catch(() => {});
  });

  async function retryBoards() {
    try {
      await ensureStaticBoards({ force: true });
    } catch {
      // staticBoardsError already set
    }
  }

  let loading = $derived(
    !$staticBoardsError &&
      !$staticBoardsLoaded &&
      $allTeamsAbyss.length === 0 &&
      $allTeamsStygian.length === 0,
  );

  function withLeadFirst(team: BoardTeam, mainDps: string): BoardTeam {
    return {
      ...team,
      members: orderMembersLeadFirst(team.members ?? [], mainDps),
    };
  }

  let fourStarNameIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const c of mapping.values()) {
      if (c.rarity === 4) ids.add(c.name_id);
    }
    return ids;
  });

  function mapGroups(groups: MainDpsTeamGroup<BoardTeam>[]): DisplayGroup[] {
    return groups.map((g) => ({
      mainDps: g.mainDps,
      primary: withLeadFirst(g.primary, g.mainDps),
      alternates: g.alternates.map((t) => withLeadFirst(t, g.mainDps)),
    }));
  }

  function dpsDisplayName(mainDps: string): string {
    return mapping.get(mainDps)?.name ?? mainDps;
  }

  let ownedIds = $derived(ownedNameIds($charactersOwned));
  const session = authClient.useSession();
  /** Same gate as the home-page “configure roster first” card. */
  let showRosterSetup = $derived(
    needsRosterSetup({
      sessionPending: $session.isPending,
      hasSavedRoster: $hasSavedRoster,
      sessionData: $session.data,
    }),
  );

  let trailItems = $derived(
    mode === "abyss"
      ? [{ label: "Abyss", href: abyssPath }, { label: "Summary" }]
      : [{ label: "Stygian", href: stygianPath }, { label: "Summary" }],
  );

  const rosterFilterOptions = [
    { value: "all" as const, label: "All" },
    { value: "owned" as const, label: "Owned" },
  ];

  function teamFullyOwned(team: BoardTeam): boolean {
    const members = team.members ?? [];
    return (
      members.length > 0 &&
      members.every((member) => isOwnedNameId(member, ownedIds))
    );
  }

  /** Keep only fully owned lineups; promote the best remaining as primary. */
  function toOwnedGroups(groups: DisplayGroup[]): DisplayGroup[] {
    const next: DisplayGroup[] = [];
    for (const group of groups) {
      const ownedTeams = [group.primary, ...group.alternates].filter(
        teamFullyOwned,
      );
      if (ownedTeams.length === 0) continue;
      const [primary, ...alternates] = ownedTeams;
      next.push({
        mainDps: group.mainDps,
        primary: primary!,
        alternates,
      });
    }
    return next;
  }

  function filterGroups(pool: DisplayGroup[]): DisplayGroup[] {
    if (dpsTags.length === 0) return pool;
    return pool.filter((g) => dpsTags.includes(g.mainDps));
  }

  function columnPool(groups: DisplayGroup[]): DisplayGroup[] {
    return rosterFilter === "owned" ? toOwnedGroups(groups) : groups;
  }

  let abyssColumnsRaw = $derived.by(() => {
    const teams = $allTeamsAbyss;
    return ABYSS_SLOTS.map((slot) => ({
      slot,
      label: ABYSS_HALF_LABEL[slot],
      groups: mapGroups(
        pickTopMainDpsGroups(teams, slot, {
          topN,
          maxAlternates,
          minSlotRate,
          minUsageIndex,
          fourStarNameIds,
          requireAbyssUsageTotal: true,
        }),
      ),
      chambers: $abyssEnemiesBoard[slot] ?? [],
    }));
  });

  let stygianColumnsRaw = $derived.by(() => {
    const teams = $allTeamsStygian;
    const enemies = $stygianEnemiesBoard;
    return STYGIAN_SLOTS.map((slot) => {
      const enemy = enemies[slot];
      return {
        slot,
        label: enemy?.enemy_name ?? slotLabel(slot),
        enemy,
        groups: mapGroups(
          pickTopMainDpsGroups(teams, slot, {
            topN,
            maxAlternates,
            minSlotRate,
            minUsageIndex,
            fourStarNameIds,
          }),
        ),
      };
    });
  });

  let abyssColumnsPrepared = $derived(
    abyssColumnsRaw.map((col) => {
      const pool = columnPool(col.groups);
      return {
        ...col,
        pool,
        groups: filterGroups(pool),
      };
    }),
  );

  let stygianColumnsPrepared = $derived(
    stygianColumnsRaw.map((col) => {
      const pool = columnPool(col.groups);
      return {
        ...col,
        pool,
        groups: filterGroups(pool),
      };
    }),
  );

  let abyssColumns = $derived(abyssColumnsPrepared);
  let stygianColumns = $derived(stygianColumnsPrepared);

  /** Autocomplete pool: On-Field DPS on this mode's board (respects owned filter). */
  let dpsOptions = $derived.by(() => {
    const cols = mode === "abyss" ? abyssColumnsPrepared : stygianColumnsPrepared;
    const ids = new Set<string>();
    for (const col of cols) {
      for (const g of col.pool) ids.add(g.mainDps);
    }
    return [...ids].sort((a, b) =>
      dpsDisplayName(a).localeCompare(dpsDisplayName(b)),
    );
  });

  let activeRawGroupCount = $derived.by(() => {
    const cols = mode === "abyss" ? abyssColumnsPrepared : stygianColumnsPrepared;
    return cols.find((c) => c.slot === activeSlot)?.pool.length ?? 0;
  });

  let sideOptions = $derived.by(() => {
    if (mode === "abyss") {
      return ABYSS_SLOTS.map((slot) => ({
        value: slot,
        label: ABYSS_HALF_LABEL[slot],
      }));
    }
    return STYGIAN_SLOTS.map((slot) => ({
      value: slot,
      label: slotLabel(slot),
    }));
  });

  $effect(() => {
    const allowed = new Set(sideOptions.map((o) => o.value));
    if (!allowed.has(activeSlot)) activeSlot = "top";
  });

  let activeColumn = $derived.by(() => {
    const cols = mode === "abyss" ? abyssColumns : stygianColumns;
    return cols.find((c) => c.slot === activeSlot) ?? cols[0] ?? null;
  });

  let headerMeta = $derived.by(() => {
    if (mode === "abyss") {
      const open = $abyssEnemiesBoard.openTime
        ? new Date($abyssEnemiesBoard.openTime).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null;
      return {
        title: "Spiral Abyss",
        version: null as string | null,
        buff: $abyssEnemiesBoard.buffName,
        date: open ? `Opened ${open}` : null,
      };
    }
    const sched = $stygianScheduleBoard;
    const open = sched?.openTime
      ? new Date(sched.openTime).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;
    const version = sched?.challengeName?.trim() || null;
    return {
      title: "Stygian Onslaught",
      version,
      buff: null as string | null,
      date: open ? `Opened ${open}` : null,
    };
  });

  function slotLabel(slot: InfographicSlot): string {
    if (slot === "top") return "Field 1";
    if (slot === "middle") return "Field 2";
    return "Field 3";
  }

  function openAltsModal(group: DisplayGroup) {
    altsModal = group;
  }

  function closeAltsModal() {
    altsModal = null;
  }

  $effect(() => {
    activeSlot;
    closeAltsModal();
  });

  $effect(() => {
    if (!altsModal) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const releaseScrollLock = acquireBodyScrollLock();
    let active = true;
    void tick().then(() => {
      if (!active || !altsModal) return;
      altsCloseEl?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeAltsModal();
        return;
      }
      if (altsPanelEl) trapTabKey(event, altsPanelEl);
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKey, true);
      releaseScrollLock();
      if (previous?.isConnected) previous.focus();
    };
  });
</script>

{#snippet featuredTeam(team: BoardTeam, alt = false)}
  {@const members = team.members ?? []}
  {@const lead = members[0]}
  {@const supports = members.slice(1, 4)}
  <div class="featured-team" class:featured-team-alt={alt}>
    <div
      class="featured-slot featured-lead"
      class:featured-slot-compact={$isIconCompact}
    >
      <div class="featured-slot-art">
        {#if lead}
          <CharacterIcon character={mapping.get(lead)} />
        {/if}
      </div>
    </div>
    <div class="featured-supports">
      {#each supports as member, i (i)}
        <div
          class="featured-slot featured-support"
          class:featured-slot-compact={$isIconCompact}
        >
          <div class="featured-slot-art">
            <CharacterIcon character={mapping.get(member)} />
          </div>
        </div>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet dpsGroup(_slot: InfographicSlot, group: DisplayGroup)}
  <li class="dps-group">
    <div class="team-body">
      {#if group.alternates.length > 0}
        <div class="dps-tools">
          <button
            type="button"
            class="expand-btn"
            aria-haspopup="dialog"
            aria-label={`Show ${group.alternates.length} alternate ${dpsDisplayName(group.mainDps)} teams`}
            onpointerdown={(e) =>
              handlePointerAction(e, () => openAltsModal(group))}
            onclick={(e) => handleKeyboardClick(e, () => openAltsModal(group))}
          >
            <span
              >{group.alternates.length} alt{group.alternates.length === 1
                ? ""
                : "s"}</span
            >
          </button>
        </div>
      {/if}
      {@render featuredTeam(group.primary)}
    </div>
  </li>
{/snippet}

<PageShell class="gap-6">
  <header class="page-head">
    <PageTrail items={trailItems} />
    <div class="page-head-text">
      <h1 class="page-title">
        {mode === "abyss" ? "Abyss Summary" : "Stygian Summary"}
      </h1>
    </div>
  </header>

  <div class="controls">
    <div class="controls-row">
      <SegmentedControl
        options={sideOptions}
        bind:value={activeSlot}
        aria-label={mode === "abyss" ? "Abyss half" : "Stygian field"}
      />
      <SegmentedControl
        options={rosterFilterOptions}
        bind:value={rosterFilter}
        aria-label="Roster filter"
      />
      {#if showRosterSetup}
        <a class="back-link roster-setup-link" href={settingsPath}
          >Configure roster</a
        >
      {/if}
    </div>
    <div class="filter-block">
      <CharacterTagSearch
        bind:tags={dpsTags}
        options={dpsOptions}
        getLabel={dpsDisplayName}
        getCharacter={(id) => mapping.get(id)}
        countLabel="{activeColumn?.groups.length ?? 0} of {activeRawGroupCount}"
        placeholder="Filter by On-Field DPS…"
        aria-label="Filter by On-Field DPS"
      />
    </div>
  </div>

  {#if loading}
    <LoadingState variant="pulse" message="Loading meta boards…" />
  {:else if $staticBoardsError && $allTeamsAbyss.length === 0 && $allTeamsStygian.length === 0}
    <EmptyState message="Could not load static boards.">
      {#snippet action()}
        <Button variant="secondary" onclick={retryBoards}>Try again</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <div class="export-stage">
      <div
        id="summary-export"
        class="summary"
        class:summary-abyss={mode === "abyss"}
        class:summary-stygian={mode === "stygian"}
      >
        <header class="info-head">
          <div class="info-titles">
            <h2 class="info-title">
              {headerMeta.title}
              {#if activeColumn && mode === "abyss"}
                <span class="info-side">{activeColumn.label}</span>
              {/if}
            </h2>
            {#if headerMeta.version || headerMeta.buff || headerMeta.date}
              <p class="info-sub">
                {#if headerMeta.version}
                  <span class="info-version">{headerMeta.version}</span>
                {/if}
                {#if headerMeta.version && (headerMeta.buff || headerMeta.date)}
                  <span class="info-sep">·</span>
                {/if}
                {#if headerMeta.buff}
                  <span>{headerMeta.buff}</span>
                {/if}
                {#if headerMeta.buff && headerMeta.date}
                  <span class="info-sep">·</span>
                {/if}
                {#if headerMeta.date}
                  <span>{headerMeta.date}</span>
                {/if}
              </p>
            {/if}
          </div>
          {#if activeColumn && mode === "abyss" && "chambers" in activeColumn && activeColumn.chambers.length > 0}
            <div class="info-enemies" aria-hidden="true">
              {#each activeColumn.chambers as chamber}
                <div class="chamber">
                  {#each chamber.enemies.slice(0, 3) as enemy}
                    {#if enemy.asset}
                      <img
                        src={getEnemyAsset(enemy.asset)}
                        alt=""
                        class="enemy-thumb"
                      />
                    {/if}
                  {/each}
                </div>
              {/each}
            </div>
          {:else if activeColumn && mode === "stygian"}
            <div class="info-enemies info-enemies-boss">
              {#if "enemy" in activeColumn && activeColumn.enemy?.asset}
                <img
                  src={getEnemyAsset(activeColumn.enemy.asset)}
                  alt=""
                  class="boss-thumb"
                />
              {/if}
            </div>
          {/if}
          <div class="brand">
            <img
              class="brand-mark"
              src="/lightkeepers-mark.png"
              alt=""
              width="36"
              height="36"
            />
            <span class="brand-name">Lightkeepers</span>
          </div>
        </header>

        {#if activeColumn}
          <section
            class="column column-solo"
            aria-label={mode === "abyss"
              ? activeColumn.label
              : slotLabel(activeColumn.slot)}
          >
            <ul class="team-list">
              {#each activeColumn.groups as group (group.mainDps)}
                {@render dpsGroup(activeColumn.slot, group)}
              {:else}
                <li class="team-empty">
                  No On-Field DPS teams clear the filters.
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        <footer class="info-foot">lightkeepers.moe/tools/{mode}/summary</footer>
      </div>
    </div>
  {/if}
</PageShell>

{#if altsModal}
  <div class="alts-root">
    <button
      type="button"
      class="alts-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={closeAltsModal}
      transition:fade={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="alts-panel"
      bind:this={altsPanelEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="alts-modal-title"
      tabindex="-1"
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <header class="alts-head">
        <h2 id="alts-modal-title" class="section-title">
          {dpsDisplayName(altsModal.mainDps)} teams
        </h2>
        <button
          type="button"
          class="alts-close"
          bind:this={altsCloseEl}
          onclick={closeAltsModal}
          aria-label="Close"
        >
          <IconX size={16} />
        </button>
      </header>
      <p class="section-lede">
        {1 + altsModal.alternates.length} team{altsModal.alternates.length === 0
          ? ""
          : "s"} for {dpsDisplayName(altsModal.mainDps)}.
      </p>
      <ul class="alts-grid">
        <li class="alts-grid-item">
          {@render featuredTeam(altsModal.primary)}
        </li>
        {#each altsModal.alternates as alt, j (alt.team_key ?? j)}
          <li class="alts-grid-item">
            {@render featuredTeam(alt, true)}
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3) var(--space-4);
  }

  .roster-setup-link {
    align-self: center;
  }

  .filter-block {
    min-width: 0;
  }

  .export-stage {
    width: 100%;
    min-width: 0;
    padding-bottom: var(--space-4);
  }

  .summary {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    margin: 0 auto;
    padding: 1rem 0.85rem 0.85rem;
    background: var(--background-color);
    color: var(--foreground-color);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    /* clip (not hidden): avoid creating a scrollport that traps page scroll on
       tall summaries when scrollHeight === clientHeight (esp. touch / trackpad). */
    overflow: clip;
    container-type: inline-size;
    container-name: info;
  }

  .info-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.85rem;
    padding-bottom: 0.7rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
  }

  .summary-stygian .info-head {
    margin-bottom: 0.45rem;
    padding-block: 0.1rem 0.25rem;
  }

  .info-enemies {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    gap: 0.45rem 0.55rem;
    flex-shrink: 0;
  }

  .info-enemies-boss {
    gap: 0;
    width: clamp(2.75rem, 8vw, 3.75rem);
    height: clamp(2.75rem, 8vw, 3.75rem);
    overflow: hidden;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .boss-thumb {
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform: scale(1.4);
    transform-origin: center;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
    margin-left: auto;
  }

  .brand-mark {
    display: block;
    width: 1.85rem;
    height: 1.85rem;
    filter: invert(1);
  }

  .brand-name {
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .info-titles {
    min-width: 0;
    flex: 0 1 auto;
  }

  @container info (max-width: 720px) {
    .info-head {
      flex-direction: column;
      flex-wrap: nowrap;
      align-items: flex-start;
      gap: 0.45rem;
    }

    .brand {
      order: -1;
      margin-left: 0;
    }

    .info-titles,
    .info-enemies {
      width: 100%;
    }
  }

  .info-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem 0.55rem;
  }

  .info-side {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .info-version {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--foreground-color);
  }

  .info-sub,
  .team-empty,
  .info-foot {
    margin: 0.15rem 0 0;
    font-size: 0.72rem;
    color: var(--foreground-mid);
  }

  .info-sep {
    opacity: 0.55;
  }

  .chamber {
    display: flex;
    gap: 0.2rem;
    min-width: 0;
  }

  .enemy-thumb {
    width: 2.35rem;
    height: 2.35rem;
    object-fit: contain;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .column-solo {
    min-width: 0;
    overflow: clip;
    width: 100%;
  }

  .team-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem 0.7rem;
    min-width: 0;
  }

  @container info (max-width: 900px) {
    .team-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @container info (max-width: 640px) {
    .team-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .dps-group,
  .team-empty {
    min-width: 0;
  }

  .team-empty {
    grid-column: 1 / -1;
  }

  .team-body {
    position: relative;
    min-width: 0;
    overflow: hidden;
  }

  .dps-tools {
    position: absolute;
    top: 0.15rem;
    right: 0.15rem;
    z-index: 2;
  }

  .featured-team {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    gap: 0.22rem;
    align-items: stretch;
    width: 100%;
    min-width: 0;
  }

  .featured-team-alt {
    opacity: 0.82;
  }

  .expand-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    flex-shrink: 0;
    padding: 0.08rem 0.25rem;
    border-radius: var(--radius-sm);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    background: color-mix(in srgb, var(--background-color) 82%, transparent);
    color: var(--foreground-mid);
    font: inherit;
    font-size: 0.6rem;
    cursor: pointer;
  }

  .featured-supports {
    display: grid;
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: 0.18rem;
    min-width: 0;
    min-height: 0;
  }

  .featured-slot {
    position: relative;
    width: 100%;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--background-mid);
  }

  .featured-lead {
    aspect-ratio: 3 / 4;
  }

  .featured-lead.featured-slot-compact {
    aspect-ratio: 1;
  }

  .featured-support {
    min-height: 0;
  }

  .featured-support .featured-slot-art {
    filter: brightness(0.55) saturate(0.75);
  }

  .featured-slot-art {
    position: absolute;
    inset: 0;
  }

  .info-foot {
    margin-top: 0.85rem;
    padding-top: 0.55rem;
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    text-align: right;
  }

  .alts-root {
    position: fixed;
    inset: 0;
    z-index: 130;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .alts-backdrop {
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

  .alts-panel {
    position: relative;
    z-index: 1;
    width: min(42rem, 100%);
    max-height: min(40rem, calc(100vh - 2rem));
    overflow: auto;
    padding: 1rem 1.1rem 1.1rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid rgba(255, 255, 255, 0.18);
    background: var(--background-mid);
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    scrollbar-width: thin;
    scrollbar-color: color-mix(
        in srgb,
        var(--foreground-color) 22%,
        transparent
      )
      transparent;
  }

  .alts-panel::-webkit-scrollbar {
    width: 0.55rem;
  }

  .alts-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .alts-panel::-webkit-scrollbar-thumb {
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .alts-panel::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--foreground-color) 36%, transparent);
    background-clip: padding-box;
  }

  .alts-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .alts-head .section-title {
    margin: 0;
  }

  .alts-close {
    width: 1.85rem;
    height: 1.85rem;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .alts-close:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .alts-panel .section-lede {
    margin: 0;
  }

  .alts-grid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .alts-grid-item {
    min-width: 0;
  }

  @media (max-width: 36rem) {
    .alts-root {
      padding: 0.65rem 1.15rem;
    }

    .alts-panel {
      width: min(22rem, 100%);
      max-height: min(32rem, calc(100vh - 1.3rem));
      padding: 0.75rem 0.85rem 0.85rem;
      gap: 0.45rem;
      border-radius: var(--radius-md);
    }

    .alts-grid {
      gap: 0.4rem;
    }
  }
</style>
