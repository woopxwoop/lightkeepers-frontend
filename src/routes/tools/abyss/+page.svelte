<script lang="ts">
  import {
    teamsOwned,
    allTeamsAbyss,
    abyssEnemiesBoard,
    staticBoardsLoaded,
    staticBoardsError,
    charactersOwned,
    charactersHydrated,
    teamsOwnedLoaded,
    ensureTeamsOwned,
    ensureStaticBoards,
    hasSavedRoster,
  } from "$lib/stores";
  import { solveAbyssWithFallback, SOLVER_REVISION } from "$lib/solver";
  import {
    SOLUTIONS_COUNT,
    boardSlotRate,
    filterDisplaySolutions,
    clampSolutionIndex,
    stepSolutionIndex,
    assignmentKeyFor,
    createMemo,
    rosterFingerprint,
    teamsFingerprint,
  } from "$lib/board-solutions";
  import { ownedNameIds } from "$lib/utils";
  import Team from "$lib/ui/components/Team.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Surface from "$lib/ui/components/Surface.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import type { AbyssTeam } from "$lib/definitions";
  import { getEnemyAsset } from "$lib/utils";
  import { handleKeyboardClick, handlePointerAction } from "$lib/ui/pointer";
  import { resolve } from "$app/paths";
  import { settingsPath } from "$lib/ui/nav-links";
  import { authClient } from "$lib/auth-client";
  import { needsRosterSetup } from "$lib/roster-setup";

  const SLOTS = ["top", "bottom"] as const;
  type Slot = (typeof SLOTS)[number];
  const memoSolutions = createMemo<ReturnType<typeof solveAbyssWithFallback>>();

  let { data } = $props();
  let mapping = $derived(data.mapping);
  let abyssEnemies = $derived($abyssEnemiesBoard);
  const session = authClient.useSession();

  /** Same gate as the home-page “configure roster first” card. */
  let showRosterSetup = $derived(
    needsRosterSetup({
      sessionPending: $session.isPending,
      hasSavedRoster: $hasSavedRoster,
      sessionData: $session.data,
    }),
  );

  // Meta boards + owned subset — warmed from bootstrap when possible.
  $effect(() => {
    ensureStaticBoards().catch(() => {});
    ensureTeamsOwned($charactersOwned).catch(console.error);
  });

  async function retryStaticBoards() {
    try {
      await ensureStaticBoards({ force: true });
    } catch {
      // staticBoardsError already set
    }
  }

  const halfLabel: Record<Slot, string> = {
    top: "First Half",
    bottom: "Second Half",
  };

  let selectedIndex = $state(0);

  let enemiesExpanded = $state(true);

  let hasOwnedCharacters = $derived(
    $charactersOwned.some((character) => character.isOwned),
  );

  let solutions = $derived.by(() => {
    if (hasOwnedCharacters && !$teamsOwnedLoaded) return [];
    const owned = $charactersOwned;
    const teams = $teamsOwned;
    const all = $allTeamsAbyss;
    const key = [
      SOLVER_REVISION,
      rosterFingerprint(owned),
      teamsFingerprint(teams),
      teamsFingerprint(all),
    ].join("|");
    return memoSolutions(key, () =>
      solveAbyssWithFallback(teams, all, ownedNameIds(owned), SOLUTIONS_COUNT),
    );
  });

  let displaySolutions = $derived(filterDisplaySolutions(solutions));

  let safeIndex = $derived(
    clampSolutionIndex(selectedIndex, displaySolutions.length),
  );

  $effect(() => {
    if (selectedIndex !== safeIndex) selectedIndex = safeIndex;
  });

  let solution = $derived(displaySolutions[safeIndex]);

  let loading = $derived(
    !$charactersHydrated ||
      (!$staticBoardsError &&
        !$staticBoardsLoaded &&
        $allTeamsAbyss.length === 0),
  );

  let waitingForOwned = $derived(hasOwnedCharacters && !$teamsOwnedLoaded);

  let updatedLabel = $derived.by(() => {
    if (!abyssEnemies?.openTime) return "";
    return new Date(abyssEnemies.openTime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  let metaParts = $derived(
    [
      abyssEnemies?.buffName
        ? { text: abyssEnemies.buffName, title: "Abyssal Moon blessing" }
        : null,
      updatedLabel ? { text: `Updated ${updatedLabel}` } : null,
    ].filter((part): part is { text: string; title?: string } => part !== null),
  );

  function slotRate(team: AbyssTeam, slot: Slot): number {
    return boardSlotRate(team, slot);
  }

  function assignmentKey(slot: Slot): string {
    return assignmentKeyFor(solution, slot);
  }

  function stepSolution(delta: number) {
    const next = stepSolutionIndex(safeIndex, delta, displaySolutions.length);
    if (next == null) return;
    selectedIndex = next;
  }
</script>

{#snippet halfColumn(slot: Slot)}
  {@const sideEnemies = abyssEnemies?.[slot]}
  {@const assignment = solution?.assignments.find((a) => a.slot === slot)}

  <section class="half">
    <h2 class="half-heading">{halfLabel[slot]}</h2>

    <!-- Chamber enemies — dynamic 3-chamber strip preserved -->
    <div
      id={`abyss-enemies-${slot}`}
      class="enemy-disclosure"
      class:enemy-disclosure-collapsed={!enemiesExpanded}
      aria-hidden={!enemiesExpanded}
    >
      <div class="enemy-disclosure-inner">
        <div class="chamber-strip">
          {#if sideEnemies && sideEnemies.length > 0}
            <div class="chambers">
              {#each sideEnemies as chamber}
                <div class="chamber">
                  <div class="chamber-enemies">
                    {#each chamber.enemies.slice(0, 3) as enemy}
                      {#if enemy.asset}
                        <img
                          src={getEnemyAsset(enemy.asset)}
                          alt={enemy.name}
                          title={enemy.name}
                          class="enemy-portrait"
                        />
                      {/if}
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="chamber-empty">
              <span>No enemy data</span>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="team-block">
      {#if assignment}
        <Team
          team={assignment.team}
          {mapping}
          missingCharacters={assignment.missingCharacters}
        />

        <div class="rate-row">
          <span class="rate-slot"
            >{slotRate(assignment.team, slot).toFixed(0)}% usage in this half</span
          >
        </div>
      {:else}
        <div class="panel-empty">
          <p>No team available for this side</p>
        </div>
      {/if}
    </div>
  </section>
{/snippet}

<PageShell class="gap-6">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Spiral Abyss</h1>
      <p class="page-meta">
        {#each metaParts as part, index (part.text)}
          {#if index > 0}
            <span class="page-meta-sep" aria-hidden="true">·</span>
          {/if}
          <span title={part.title}>{part.text}</span>
        {/each}
        {#if metaParts.length > 0}
          <span class="page-meta-sep" aria-hidden="true">·</span>
        {/if}
        <a class="back-link" href={resolve("/tools/abyss/summary")}>Summary</a>
      </p>
    </div>
  </header>

  {#if loading}
    <LoadingState />
  {:else if $staticBoardsError && $allTeamsAbyss.length === 0}
    <EmptyState message="Could not load Abyss teams right now.">
      {#snippet action()}
        <Button variant="secondary" onclick={retryStaticBoards}
          >Try again</Button
        >
      {/snippet}
    </EmptyState>
  {:else if waitingForOwned}
    <LoadingState variant="pulse" message="Matching your roster…" />
  {:else if showRosterSetup}
    <EmptyState
      message="Set up your roster to find Abyss clears that match what you own."
    >
      {#snippet action()}
        <a class="pulls-cta" href={settingsPath}>Configure roster</a>
      {/snippet}
    </EmptyState>
  {:else if displaySolutions.length === 0}
    <EmptyState
      message="No viable clears for your roster right now."
    >
      {#snippet action()}
        <a class="pulls-cta" href={resolve("/tools/pulls")}
          >See pull suggestions</a
        >
      {/snippet}
    </EmptyState>
  {:else}
    <Surface flush class="solution-board">
      <div class="board-head">
        <div class="board-head-left">
          <span class="eyebrow board-eyebrow">
            Solution {safeIndex + 1}
            <span class="board-eyebrow-total">of {displaySolutions.length}</span
            >
          </span>
        </div>

        <div class="board-actions">
          <button
            type="button"
            class="enemy-toggle"
            aria-expanded={enemiesExpanded}
            aria-controls="abyss-enemies-top abyss-enemies-bottom"
            aria-label={enemiesExpanded ? "Hide enemies" : "Show enemies"}
            onpointerdown={(event) =>
              handlePointerAction(event, () => {
                enemiesExpanded = !enemiesExpanded;
              })}
            onclick={(event) =>
              handleKeyboardClick(event, () => {
                enemiesExpanded = !enemiesExpanded;
              })}
          >
            <span>Enemies</span>
            <IconChevronDown size={14} strokeWidth={2.25} />
          </button>

          {#if displaySolutions.length > 1}
            <div class="pager">
              <button
                type="button"
                class="pager-btn"
                aria-label="Previous solution"
                disabled={safeIndex === 0}
                onpointerdown={(event) =>
                  handlePointerAction(event, () => stepSolution(-1))}
                onclick={(event) =>
                  handleKeyboardClick(event, () => stepSolution(-1))}
              >
                <IconChevronDown size={16} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                class="pager-btn pager-btn-next"
                aria-label="Next solution"
                disabled={safeIndex === displaySolutions.length - 1}
                onpointerdown={(event) =>
                  handlePointerAction(event, () => stepSolution(1))}
                onclick={(event) =>
                  handleKeyboardClick(event, () => stepSolution(1))}
              >
                <IconChevronDown size={16} strokeWidth={2.25} />
              </button>
            </div>
          {/if}
        </div>
      </div>

      {#key safeIndex}
        <div class="board-body motion-board-swap">
          {#each SLOTS as slot (slot)}
            <div class="board-cell" data-panel-slot={slot}>
              {#key assignmentKey(slot)}
                {@render halfColumn(slot)}
              {/key}
            </div>
          {/each}
        </div>
      {/key}
    </Surface>

    {#if solution?.isFallback && solution.neededCharacters.length > 0}
      <p class="fallback-note">
        Unable to find floor 12 clears with your roster — try teams similar to
        those suggested, or check Pull suggestions.
      </p>
    {/if}
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .page-meta {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  /* ── Solution board ─────────────────────────────────────────────── */
  /* Board hairlines are pure white — any warm tone (gold or cream) over the
     blue-tinted mid surface mixes to mud. */
  :global(.solution-board) {
    overflow: hidden;
    --border-subtle: rgba(255, 255, 255, 0.14);
    --border-default: rgba(255, 255, 255, 0.24);
    --border-strong: rgba(255, 255, 255, 0.45);
  }

  .board-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-width) solid var(--border-subtle);
    background: var(--surface-inset);
  }

  .board-head-left {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
    min-width: 0;
  }

  .board-eyebrow {
    color: var(--foreground-color);
    white-space: nowrap;
  }

  .board-eyebrow-total {
    color: var(--foreground-mid);
    font-weight: 500;
  }

  .board-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .enemy-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    height: 1.75rem;
    padding: 0 var(--space-2);
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border-default);
    background: var(--surface-raised);
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: var(--text-xs);
    font-weight: 500;
    transition: var(--control-transition);
  }

  .enemy-toggle:hover {
    color: var(--foreground-color);
    border-color: var(--border-strong);
  }

  .enemy-toggle :global(svg) {
    transition: transform var(--control-duration) var(--control-ease);
  }

  .enemy-toggle[aria-expanded="true"] :global(svg) {
    transform: rotate(180deg);
  }

  .pager {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .pager-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border-default);
    color: var(--foreground-mid);
    background: var(--surface-raised);
    transition: var(--control-transition);
  }

  /* Chevron points down by default — rotate to make left / right */
  .pager-btn :global(svg) {
    transform: rotate(90deg);
  }

  .pager-btn-next :global(svg) {
    transform: rotate(-90deg);
  }

  .pager-btn:hover:not(:disabled) {
    color: var(--accent-1);
    border-color: var(--border-strong);
  }

  .pager-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .board-body {
    display: grid;
    grid-template-columns: 1fr;
  }

  .board-cell {
    min-width: 0;
    padding: var(--space-4);
  }

  .board-cell + .board-cell {
    border-top: var(--border-width) solid var(--border-subtle);
  }

  @media (min-width: 1024px) {
    .board-body {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .board-cell + .board-cell {
      border-top: 0;
      border-left: var(--border-width) solid var(--border-subtle);
    }
  }

  .half {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .half-heading {
    margin-bottom: var(--space-3);
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .enemy-disclosure {
    display: grid;
    grid-template-rows: 1fr;
    opacity: 1;
    transition:
      grid-template-rows var(--control-duration) var(--control-ease),
      opacity var(--control-duration) var(--control-ease);
  }

  .enemy-disclosure-collapsed {
    grid-template-rows: 0fr;
    opacity: 0;
  }

  .enemy-disclosure-inner {
    min-height: 0;
    overflow: hidden;
  }

  .chamber-strip {
    padding-bottom: var(--space-3);
    border-bottom: var(--border-width) solid var(--border-default);
  }

  .chambers {
    display: flex;
  }

  .chamber {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.5rem;
  }

  .chamber-enemies {
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: 0.25rem;
  }

  .enemy-portrait {
    min-width: 2rem;
    flex-grow: 1;
    height: 4rem;
    border-radius: var(--radius-md);
    object-fit: cover;
    border: 1px solid var(--border-subtle);
  }

  .chamber-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 0;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .team-block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: var(--space-3);
  }

  .rate-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .rate-row .rate-slot {
    margin-left: auto;
    color: var(--foreground-mid);
  }

  .panel-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 2rem 0;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .fallback-note {
    font-size: var(--text-xs);
    text-align: center;
    color: var(--foreground-mid);
    line-height: 1.45;
  }

  .pulls-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.35rem 0.7rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--accent-1);
    background: var(--accent-1);
    color: var(--control-knob-on);
    font-size: var(--text-sm);
    font-weight: 600;
    text-decoration: none;
  }

  .pulls-cta:hover {
    background: color-mix(in srgb, var(--accent-1) 88%, white);
    border-color: color-mix(in srgb, var(--accent-1) 88%, white);
  }
</style>
