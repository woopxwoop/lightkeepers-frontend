<script lang="ts">
  import { untrack } from "svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import UsageSeriesChart from "$lib/ui/components/UsageSeriesChart.svelte";
  import TeamHandList from "$lib/ui/components/character/TeamHandList.svelte";
  import {
    analyticsCacheKey,
    fetchCharacterAnalytics,
    getCharacterAnalyticsCached,
    isAbortError,
    isTimeoutError,
  } from "$lib/app/character-analytics";
  import {
    dimmedKeysFromMembers,
    handCharactersFromMembers,
  } from "$lib/character-teams";
  import type {
    Character,
    CharacterAnalyticsMode,
    CharacterAnalyticsPayload,
  } from "$lib/definitions";

  let {
    nameId,
    characterName,
    mapping,
    ownedNameIdsSet,
  }: {
    nameId: string;
    characterName: string;
    mapping: Map<string, Character>;
    ownedNameIdsSet: Set<string>;
  } = $props();

  const ANALYTICS_MODE_OPTIONS = [
    { value: "stygian" as const, label: "Stygian" },
    { value: "abyss" as const, label: "Abyss" },
  ];

  const INITIAL_ANALYTICS_MODE: CharacterAnalyticsMode = "stygian";
  let analyticsMode = $state<CharacterAnalyticsMode>(INITIAL_ANALYTICS_MODE);
  const seedKey = analyticsCacheKey(INITIAL_ANALYTICS_MODE, nameId);
  const seedPayload = getCharacterAnalyticsCached(seedKey);
  let analyticsPayload = $state<CharacterAnalyticsPayload | null>(seedPayload);
  let analyticsError = $state<string | null>(null);
  let analyticsLoading = $state(false);
  let analyticsKey = $state<string | null>(seedPayload ? seedKey : null);
  let analyticsAbort: AbortController | null = null;

  $effect(() => {
    const id = nameId;
    const mode = analyticsMode;
    const key = analyticsCacheKey(mode, id);
    const fromModule = getCharacterAnalyticsCached(key);
    if (fromModule) {
      // Instant paint from last success; still refetch below.
      untrack(() => {
        analyticsPayload = fromModule;
        analyticsKey = key;
        analyticsError = null;
      });
    }

    void loadAnalytics(id, mode, key);
    return () => {
      analyticsAbort?.abort();
    };
  });

  function loadAnalytics(
    id: string,
    mode: CharacterAnalyticsMode,
    key: string,
  ) {
    analyticsAbort?.abort();
    const controller = new AbortController();
    analyticsAbort = controller;

    analyticsLoading = true;
    analyticsError = null;
    if (untrack(() => analyticsKey) !== key) {
      analyticsPayload = null;
    }

    return fetchCharacterAnalytics(id, mode, controller.signal)
      .then((payload) => {
        if (analyticsAbort !== controller) return;
        if (controller.signal.aborted) {
          analyticsLoading = false;
          return;
        }
        analyticsPayload = payload;
        analyticsKey = key;
        analyticsLoading = false;
      })
      .catch((err) => {
        if (analyticsAbort !== controller) return;
        if (controller.signal.aborted || isAbortError(err)) {
          analyticsLoading = false;
          return;
        }
        analyticsLoading = false;
        analyticsError = isTimeoutError(err)
          ? "Request timed out"
          : err instanceof Error
            ? err.message
            : "Failed to load analytics";
        // Same-key refresh failed: keep the cached view; only drop state on key change.
        if (untrack(() => analyticsKey) === key) return;
        analyticsPayload = null;
        analyticsKey = null;
      });
  }

  let analyticsTeamsByVersion = $derived.by(() => {
    const payload = analyticsPayload;
    if (!payload) return [];
    const nameByVersion = new Map(
      payload.usage.map((p) => [p.version_number, p.version_name]),
    );
    const groups = new Map<number, typeof payload.teams>();
    for (const team of payload.teams) {
      const list = groups.get(team.version_number) ?? [];
      list.push(team);
      groups.set(team.version_number, list);
    }
    return [...groups.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([version_number, teams]) => {
        const version_name =
          nameByVersion.get(version_number)?.trim() || `v${version_number}`;
        return {
          version_number,
          version_name,
          teams: teams
            .slice()
            .sort((a, b) => (b.usage_rate ?? 0) - (a.usage_rate ?? 0)),
        };
      });
  });

  async function retryAnalytics() {
    const key = analyticsCacheKey(analyticsMode, nameId);
    await loadAnalytics(nameId, analyticsMode, key);
  }
</script>

<div
  role="tabpanel"
  id="tabpanel-analytics"
  aria-labelledby="tab-analytics"
  tabindex="0"
>
  <section class="board-section">
    <div class="teams-head">
      <div class="teams-label">
        <span class="teams-label-text" id="analytics-mode-label">Usage:</span>
        <Select
          id="analytics-mode-trigger"
          options={ANALYTICS_MODE_OPTIONS}
          bind:value={analyticsMode}
          bare
          aria-labelledby="analytics-mode-label analytics-mode-trigger"
        />
      </div>
    </div>

    {#if analyticsError && !analyticsPayload}
      <EmptyState message="Could not load usage history right now.">
        {#snippet action()}
          <Button variant="secondary" onclick={retryAnalytics}>Try again</Button
          >
        {/snippet}
      </EmptyState>
    {:else if analyticsPayload && analyticsKey === analyticsCacheKey(analyticsMode, nameId)}
      <div class="analytics-payload" class:is-refreshing={analyticsLoading}>
        {#if analyticsLoading}
          <p class="analytics-refresh meta-sub" aria-live="polite">
            Refreshing…
          </p>
        {:else if analyticsError}
          <p class="analytics-refresh meta-sub" role="status">
            {analyticsError}
          </p>
        {/if}
        {#if analyticsPayload.usage.length === 0}
          <EmptyState message="No usage history for {characterName} yet." />
        {:else}
          <div class="analytics-chart">
            <UsageSeriesChart points={analyticsPayload.usage} />
          </div>
        {/if}
        {#if analyticsTeamsByVersion.length > 0}
          <div class="analytics-teams">
            <h2 class="section-title">Top teams by version</h2>
            {#each analyticsTeamsByVersion as group (group.version_number)}
              <section class="analytics-version">
                <h3 class="meta-name">{group.version_name}</h3>
                <TeamHandList>
                  {#each group.teams as team, i (team.team_key ?? `${group.version_number}-${i}`)}
                    <li class="team-hand-row">
                      <TeamCardHand
                        characters={handCharactersFromMembers(
                          team.members ?? [],
                          mapping,
                        )}
                        dimmedKeys={dimmedKeysFromMembers(
                          team.members ?? [],
                          ownedNameIdsSet,
                        )}
                        spread="flat"
                      />
                      <div class="team-hand-footer">
                        <span class="team-hand-meta">
                          <span class="team-hand-rank">#{i + 1}</span>
                          <span>{(team.usage_rate ?? 0).toFixed(1)}% usage</span
                          >
                        </span>
                      </div>
                    </li>
                  {/each}
                </TeamHandList>
              </section>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <LoadingState variant="pulse" message="Loading usage history…" />
    {/if}
  </section>
</div>

<style>
  .section-title {
    margin-bottom: var(--space-3);
  }

  .board-section {
    padding: var(--space-4);
  }

  .teams-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-3);
    margin-bottom: var(--space-3);
  }

  .teams-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .teams-label-text {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .analytics-payload {
    position: relative;
  }

  .analytics-payload.is-refreshing {
    opacity: 0.72;
  }

  .analytics-refresh {
    margin: 0 0 var(--space-2);
  }

  .analytics-chart {
    margin-top: var(--space-2);
  }

  .analytics-teams {
    margin-top: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .analytics-version {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
