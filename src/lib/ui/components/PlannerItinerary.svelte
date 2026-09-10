<script lang="ts">
  /**
   * Farming itinerary — starred planner goals, domains / bosses.
   * The nav sheet mounts the plain layout as a large overlay.
   */
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import { loadUpgradeCosts } from "$lib/app/upgrade-costs";
  import {
    getRosterWeaponsCached,
    loadRosterWeapons,
  } from "$lib/app/roster-inventory";
  import {
    aggregateGoalCosts,
    cloneGoal,
    emptyGoalsState,
    findGoal,
    moveGoal,
    parseGoalsState,
    replaceGoal,
    starredGoals,
    toggleGoalStarred,
  } from "$lib/calculator-goals";
  import {
    autofillCharacterGoalState,
    goalsHaveUnsavedChanges,
    hydrateGoalsState,
    readGoalsIfChanged,
    saveGoalsState,
  } from "$lib/calculator-goals-lifecycle";
  import {
    captureGoals,
    goalsLocalRevision,
    readGoalsLocal,
  } from "$lib/calculator-goals-snapshot";
  import { authClient } from "$lib/auth-client";
  import type { Character, CharacterPortraitRef } from "$lib/definitions";
  import {
    appendCatalogCharacterGoal,
    appendCatalogWeaponGoal,
    pickModalCharacter,
    plannerCharacterOptions,
    plannerWeaponOptions,
  } from "$lib/planner-goal-edits";
  import {
    FARM_KIND_LABEL,
    farmMaterialContributors,
    farmPlacesFromMaterials,
    farmPlacesOfKind,
    farmTodayColumn,
    farmWeekDays,
    faceMaterialOnPlaces,
    todayWeekday,
    uniqueGoalsOnPlaces,
    type FarmGoalRef,
    type FarmPlace,
    type FarmPlaceMaterial,
  } from "$lib/planner-itinerary";
  import { assetUrl } from "$lib/asset-urls";
  import { charactersOwned } from "$lib/stores";
  import { ownedNameIds } from "$lib/utils";
  import type { CalculatorGoalsState } from "$lib/types/calculator-goals";
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import GoalConfigureModal from "$lib/ui/components/GoalConfigureModal.svelte";
  import GoalPickModal from "$lib/ui/components/GoalPickModal.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import IconCalendarDay from "$lib/ui/icons/IconCalendarDay.svelte";
  import IconCalendarWeek from "$lib/ui/icons/IconCalendarWeek.svelte";
  import PlannerItineraryGoalsModal from "$lib/ui/components/PlannerItineraryGoalsModal.svelte";
  import Button from "$lib/ui/components/Button.svelte";

  let {
    chrome = "card",
    showEmpty = false,
    showHeading = true,
  }: {
    chrome?: "card" | "plain";
    /** When no goals, still render the picker CTA. */
    showEmpty?: boolean;
    showHeading?: boolean;
  } = $props();

  const plannerPath = resolve("/tools/planner");
  const session = authClient.useSession();

  let goalsState = $state<CalculatorGoalsState>(emptyGoalsState());
  let hydrated = $state(false);
  let catalog = $state<UpgradeCostsCatalog | null>(null);
  let catalogError = $state("");
  let weekExpanded = $state(false);
  let weekdayTick = $state(0);
  let pickingGoals = $state(false);
  let picking = $state<"character" | "weapon" | null>(null);
  let pickQuery = $state("");
  let sortOwnedFirst = $state(true);
  let configuringId = $state<string | null>(null);
  let pendingRemoveIds = $state(new Set<string>());
  let addError = $state("");
  let autofillSeq = 0;
  let savedSnapshot = $state("");
  let isSaving = $state(false);
  let saveError = $state("");

  let goals = $derived(goalsState.goals);
  let savedGoals = $derived.by(() => {
    if (!savedSnapshot) return goalsState.goals;
    try {
      return parseGoalsState(JSON.parse(savedSnapshot) as unknown).goals;
    } catch {
      return goalsState.goals;
    }
  });
  let hasUnsavedChanges = $derived(
    goalsHaveUnsavedChanges({
      hydrated,
      state: goalsState,
      savedSnapshot,
      pendingRemoveIds,
    }),
  );
  let focusedGoals = $derived(starredGoals(savedGoals));

  function ensureCatalog() {
    if (catalog || catalogError) return;
    void loadUpgradeCosts()
      .then((data) => {
        catalog = data;
      })
      .catch((e) => {
        catalogError = (e as Error)?.message ?? "Couldn’t load upgrade costs";
      });
  }

  function applySavedGoals(next: CalculatorGoalsState) {
    goalsState = next;
    ensureCatalog();
  }

  function commitSaved(next: CalculatorGoalsState) {
    const pending = captureGoals(next);
    savedSnapshot = pending.json;
    applySavedGoals(pending.state);
  }

  function cancelEdits() {
    try {
      applySavedGoals(parseGoalsState(JSON.parse(savedSnapshot) as unknown));
      pendingRemoveIds = new Set();
      saveError = "";
    } catch {
      /* ignore */
    }
  }

  function closePicker() {
    if (hasUnsavedChanges) cancelEdits();
    pickingGoals = false;
    picking = null;
    pickQuery = "";
    configuringId = null;
    pendingRemoveIds = new Set();
    addError = "";
    saveError = "";
  }

  function openPicker() {
    pickingGoals = true;
    addError = "";
    ensureCatalog();
    void loadRosterWeapons().catch(() => {});
  }

  onMount(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      weekdayTick += 1;
      if (hydrated && !hasUnsavedChanges && !pickingGoals) {
        const pending = readGoalsIfChanged(savedSnapshot);
        if (pending) commitSaved(pending.state);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    void (async () => {
      try {
        const { data: sess } = await authClient.getSession();
        const pending = await hydrateGoalsState(Boolean(sess));
        commitSaved(pending.state);
      } catch {
        commitSaved(readGoalsLocal());
      }
      hydrated = true;
      ensureCatalog();
      void loadRosterWeapons().catch(() => {});
    })();

    return () => document.removeEventListener("visibilitychange", onVisible);
  });

  /** Same-tab sync when the planner page persists goals. */
  $effect(() => {
    void $goalsLocalRevision;
    if (!hydrated || hasUnsavedChanges || pickingGoals) return;
    const pending = readGoalsIfChanged(savedSnapshot);
    if (!pending) return;
    commitSaved(pending.state);
  });

  function toggleStar(id: string) {
    const current = findGoal(goalsState, id);
    if (!current) return;
    applySavedGoals(replaceGoal(goalsState, toggleGoalStarred(current)));
  }

  function starAll() {
    applySavedGoals({
      ...goalsState,
      goals: goalsState.goals.map((g) => {
        const next = cloneGoal(g);
        next.starred = true;
        return next;
      }),
    });
  }

  function starNone() {
    applySavedGoals({
      ...goalsState,
      goals: goalsState.goals.map((g) => {
        const next = cloneGoal(g);
        delete next.starred;
        return next;
      }),
    });
  }

  function reorderGoals(from: number, to: number) {
    applySavedGoals(moveGoal(goalsState, from, to));
  }

  let ownedIds = $derived(ownedNameIds($charactersOwned));
  let characterOptions = $derived(
    plannerCharacterOptions(catalog, ownedIds, sortOwnedFirst),
  );
  let weaponOptions = $derived(plannerWeaponOptions(catalog));
  let pickOptions = $derived(
    picking === "weapon" ? weaponOptions : characterOptions,
  );
  let configuringGoal = $derived(
    configuringId ? findGoal(goalsState, configuringId) : null,
  );

  function portraitFor(nameId: string) {
    return pickModalCharacter(nameId, catalog, $charactersOwned);
  }

  function beginPick(kind: "character" | "weapon") {
    addError = "";
    configuringId = null;
    picking = kind;
    pickQuery = "";
    ensureCatalog();
    void loadRosterWeapons().catch(() => {});
  }

  function cancelPick() {
    picking = null;
    pickQuery = "";
  }

  function choosePick(value: string) {
    if (picking === "character") addCharacterWith(value);
    else if (picking === "weapon") addWeaponWith(Number(value));
  }

  async function autofillCharacterTarget(nameId: string, goalId: string) {
    if (!catalog) return;
    const seq = ++autofillSeq;
    const next = await autofillCharacterGoalState({
      state: goalsState,
      catalog,
      nameId,
      goalId,
    });
    if (seq !== autofillSeq || !next) return;
    applySavedGoals(next);
  }

  function addCharacterWith(nameId: string) {
    if (!catalog) return;
    cancelPick();
    const result = appendCatalogCharacterGoal(goalsState, catalog, nameId, {
      owned: $charactersOwned,
      weapons: getRosterWeaponsCached(),
      starred: true,
    });
    if (!result.ok) {
      addError = result.error;
      return;
    }
    addError = "";
    applySavedGoals(result.state);
    configuringId = result.goal.id;
    void autofillCharacterTarget(
      result.goal.kind === "character" ? result.goal.name_id : nameId,
      result.goal.id,
    );
  }

  function addWeaponWith(weaponId: number) {
    if (!catalog) return;
    cancelPick();
    const result = appendCatalogWeaponGoal(goalsState, catalog, weaponId, {
      owned: $charactersOwned,
      weapons: getRosterWeaponsCached(),
      starred: true,
    });
    if (!result.ok) {
      addError = result.error;
      return;
    }
    addError = "";
    applySavedGoals(result.state);
    configuringId = result.goal.id;
  }

  function openConfigure(id: string) {
    if (pendingRemoveIds.has(id)) return;
    cancelPick();
    configuringId = id;
  }

  function closeConfigure() {
    configuringId = null;
  }

  function deleteGoal(id: string) {
    if (configuringId === id) configuringId = null;
    addError = "";
    const next = new Set(pendingRemoveIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    pendingRemoveIds = next;
  }

  async function saveStars() {
    if (isSaving || !hasUnsavedChanges) return;
    isSaving = true;
    saveError = "";
    const result = await saveGoalsState({
      state: goalsState,
      pendingRemoveIds,
      savedSnapshot,
      cloud: Boolean($session.data),
    });
    if (!result.ok) {
      saveError = result.message;
      isSaving = false;
      return;
    }
    pendingRemoveIds = new Set();
    savedSnapshot = result.capture.json;
    applySavedGoals(result.capture.state);
    pickingGoals = false;
    picking = null;
    configuringId = null;
    addError = "";
    isSaving = false;
  }

  let focusedMaterials = $derived.by((): Record<string, number> => {
    if (!catalog || focusedGoals.length === 0) return {};
    return aggregateGoalCosts(focusedGoals, catalog).materials;
  });

  let places = $derived.by(() => {
    if (!catalog || focusedGoals.length === 0) return [];
    return farmPlacesFromMaterials(focusedMaterials, catalog);
  });

  let contributors = $derived.by(() => {
    if (!catalog || focusedGoals.length === 0) {
      return new Map<string, FarmGoalRef[]>();
    }
    return farmMaterialContributors(focusedGoals, catalog, focusedMaterials);
  });

  let today = $derived.by(() => {
    weekdayTick;
    return todayWeekday();
  });
  let week = $derived(farmWeekDays(places, today));
  let todayCol = $derived(farmTodayColumn(places, today));
  let shownWeek = $derived(weekExpanded ? week : [todayCol]);
  let hasDomainWeek = $derived(places.some((p) => p.kind === "domain"));
  let weeklyPlaces = $derived(farmPlacesOfKind(places, "weekly"));
  let bossPlaces = $derived(farmPlacesOfKind(places, "boss"));

  function placeIdentity(place: FarmPlace): string {
    return `${place.kind}:${place.name}:${place.days?.join("/") ?? ""}`;
  }

  let mapping = $derived(
    (page.data.mapping as Map<string, Character> | undefined) ??
      new Map<string, Character>(),
  );

  function characterFor(g: FarmGoalRef): CharacterPortraitRef | undefined {
    if (!g.name_id) return undefined;
    return (
      mapping.get(g.name_id) ?? {
        name_id: g.name_id,
        name: g.name,
        element:
          catalog?.characters.find((c) => c.name_id === g.name_id)?.element ??
          "",
      }
    );
  }

  function onGoalArtError(
    el: HTMLImageElement,
    fallback: string | null | undefined,
  ) {
    if (!fallback || el.dataset.fallback === "1") {
      el.style.display = "none";
      return;
    }
    el.dataset.fallback = "1";
    el.src = fallback;
  }
</script>

{#if hydrated && (goals.length > 0 || showEmpty)}
  {@const needsGoalSetup = goals.length === 0 || focusedGoals.length === 0}
  <section
    class="itinerary"
    class:itinerary-card={chrome === "card"}
    class:itinerary-empty-state={needsGoalSetup}
  >
    {#if !needsGoalSetup && (showHeading || !hasDomainWeek)}
      <div class="itinerary-head">
        {#if showHeading}
          <a class="back-link itinerary-planner" href={plannerPath}
            >View full planner</a
          >
        {:else}
          <span class="itinerary-head-spacer"></span>
        {/if}
        {#if !hasDomainWeek && goals.length > 0 && focusedGoals.length > 0}
          <button
            type="button"
            class="goal-trigger"
            aria-haspopup="dialog"
            aria-expanded={pickingGoals}
            onclick={openPicker}
          >
            Edit goals
          </button>
        {/if}
      </div>
    {/if}

    {#if goals.length === 0}
      <div class="itinerary-empty">
        <p class="itinerary-empty-copy">
          Create a character or weapon goal to see what’s available to farm.
        </p>
        <Button
          variant="primary"
          aria-haspopup="dialog"
          aria-expanded={pickingGoals}
          onclick={openPicker}
        >
          Create a goal
        </Button>
      </div>
    {:else if focusedGoals.length === 0}
      <div class="itinerary-empty">
        <p class="itinerary-empty-copy">
          Star your highest priority goals to include them here.
        </p>
        <Button
          variant="primary"
          aria-haspopup="dialog"
          aria-expanded={pickingGoals}
          onclick={openPicker}
        >
          Star goals
        </Button>
      </div>
    {:else if !catalog && !catalogError}
      <LoadingState message="Loading upgrade costs…" />
    {:else if catalogError}
      <p class="section-lede">{catalogError}</p>
    {:else if !hasDomainWeek && weeklyPlaces.length === 0 && bossPlaces.length === 0}
      <p class="section-lede">Nothing to farm for these goals.</p>
    {:else}
      <div class="farm-sections">
        {#if hasDomainWeek}
          <section class="farm-section">
            <div class="farm-section-head">
              <h3 class="eyebrow">Open domains today</h3>
              <div class="farm-section-tools">
                <button
                  type="button"
                  class="goal-trigger"
                  aria-haspopup="dialog"
                  aria-expanded={pickingGoals}
                  onclick={openPicker}
                >
                  Edit goals
                </button>
                <div
                  class="view-toggle"
                  role="group"
                  aria-label="Domain calendar view"
                >
                  <button
                    type="button"
                    class="view-btn"
                    class:is-on={!weekExpanded}
                    aria-pressed={!weekExpanded}
                    aria-label="Today"
                    onclick={() => (weekExpanded = false)}
                  >
                    <IconCalendarDay size={16} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    class="view-btn"
                    class:is-on={weekExpanded}
                    aria-pressed={weekExpanded}
                    aria-label="Week"
                    onclick={() => (weekExpanded = true)}
                  >
                    <IconCalendarWeek size={16} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
            </div>
            <div class="farm-week" class:is-collapsed={!weekExpanded}>
              {#each shownWeek as col (col.day)}
                {@const who = uniqueGoalsOnPlaces(col.places, contributors)}
                <div
                  class="farm-day"
                  class:farm-day-today={col.today}
                  aria-current={col.today ? "date" : undefined}
                >
                  <p class="eyebrow farm-day-head">{col.day}</p>
                  <ul class="farm-day-places">
                    {#each who as g (g.id)}
                      {@const mat = faceMaterialOnPlaces(
                        g,
                        col.places,
                        contributors,
                      )}
                      <li>{@render goalFace(g, mat)}</li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        {#if weeklyPlaces.length > 0}
          <section class="farm-section">
            <h3 class="eyebrow">{FARM_KIND_LABEL.weekly}</h3>
            {@render placeRows(weeklyPlaces)}
          </section>
        {/if}
        {#if bossPlaces.length > 0}
          <section class="farm-section">
            <h3 class="eyebrow">{FARM_KIND_LABEL.boss}</h3>
            {@render placeRows(bossPlaces)}
          </section>
        {/if}
      </div>
    {/if}
  </section>
{/if}

{#snippet placeRows(list: FarmPlace[])}
  <ul class="place-list">
    {#each list as place (placeIdentity(place))}
      {@const who = uniqueGoalsOnPlaces([place], contributors)}
      <li class="place-row">
        <span class="meta-name place-text">{place.name}</span>
        <div class="place-icons">
          {#if place.icon && assetUrl(place.icon)}
            <img
              class="place-boss"
              src={assetUrl(place.icon) ?? ""}
              alt=""
              title={place.name}
              width="80"
              height="80"
              loading="lazy"
              onerror={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          {/if}
          <div class="place-faces">
            {#each who as g (g.id)}
              {@const mat = faceMaterialOnPlaces(g, [place], contributors)}
              {@render goalFace(g, mat)}
            {/each}
          </div>
        </div>
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet goalFace(g: FarmGoalRef, mat: FarmPlaceMaterial | null = null)}
  {@const character = characterFor(g)}
  {@const matSrc = mat ? assetUrl(mat.icon) : null}
  <div
    class="farm-face"
    title={mat ? `${g.name} · ${mat.name}` : g.name}
  >
    {#if matSrc}
      <img
        class="farm-face-mat"
        src={matSrc}
        alt=""
        width="22"
        height="22"
        loading="lazy"
        onerror={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    {/if}
    {#if character}
      <CharacterIcon {character} loading="lazy" />
    {:else if g.icon}
      <img
        class="farm-face-splash"
        src={g.icon}
        alt={g.name}
        width="64"
        height="86"
        loading="lazy"
        onerror={(e) =>
          onGoalArtError(e.currentTarget as HTMLImageElement, g.fallbackIcon)}
      />
    {:else}
      <span class="farm-face-fallback"></span>
    {/if}
  </div>
{/snippet}

<PlannerItineraryGoalsModal
  open={pickingGoals}
  {goals}
  {catalog}
  dirty={hasUnsavedChanges}
  saving={isSaving}
  {saveError}
  {addError}
  removedIds={pendingRemoveIds}
  suspendKeys={picking !== null || configuringId !== null}
  onClose={closePicker}
  onStar={toggleStar}
  onReorder={reorderGoals}
  onStarAll={starAll}
  onStarNone={starNone}
  onAddCharacter={() => beginPick("character")}
  onAddWeapon={() => beginPick("weapon")}
  onConfigure={openConfigure}
  onRemove={deleteGoal}
  onSave={() => void saveStars()}
  onCancel={closePicker}
/>
<GoalConfigureModal
  open={configuringId !== null && !!configuringGoal}
  goal={configuringGoal}
  {catalog}
  {characterOptions}
  {weaponOptions}
  getCharacter={portraitFor}
  onClose={closeConfigure}
  onChange={(next) => applySavedGoals(replaceGoal(goalsState, next))}
  onAutofillCharacter={(nameId, goalId) =>
    void autofillCharacterTarget(nameId, goalId)}
/>
<GoalPickModal
  open={picking !== null}
  kind={picking ?? "character"}
  {catalog}
  options={pickOptions}
  bind:query={pickQuery}
  bind:sortOwnedFirst
  {ownedIds}
  roster={$charactersOwned}
  getCharacter={portraitFor}
  onClose={cancelPick}
  onChoose={choosePick}
/>

<style>
  .itinerary {
    --farm-face: 64px;
    --farm-boss: 80px;
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
    min-width: 0;
  }

  @media (min-width: 768px) {
    .itinerary {
      --farm-face: 80px;
      --farm-boss: 96px;
    }
  }

  .itinerary-card {
    padding: 1rem 1.1rem 1.15rem;
    border-radius: var(--radius-lg);
    background: var(--background-mid);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .itinerary-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem 0.85rem;
  }

  .itinerary-head-spacer {
    flex: 1;
    min-width: 0;
  }

  .itinerary-planner {
    flex: 1;
    min-width: 0;
    margin: 0;
  }

  .itinerary-empty-state {
    flex: 1;
    min-height: min(22rem, 55vh);
    justify-content: center;
    align-items: center;
  }

  .itinerary-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
    max-width: 22rem;
    margin-inline: auto;
    padding: 0.5rem 1rem;
  }

  .itinerary-empty-copy {
    margin: 0;
    font-size: var(--text-base);
    line-height: 1.45;
    color: var(--foreground-color);
  }

  .goal-trigger {
    width: fit-content;
    min-height: 2rem;
    margin: 0;
    padding: 0.3rem 0.7rem;
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    border-radius: var(--radius-md);
    background: none;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    cursor: pointer;
    flex-shrink: 0;
  }

  .itinerary-head .goal-trigger {
    margin-left: auto;
  }

  .goal-trigger:hover,
  .goal-trigger[aria-expanded="true"] {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 32%, transparent);
  }

  .farm-sections {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .farm-section {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    min-width: 0;
  }

  .farm-section + .farm-section {
    padding-top: 1.35rem;
    border-top: var(--border-width) solid var(--border-subtle);
  }

  .farm-section > .eyebrow,
  .farm-section-head .eyebrow {
    margin: 0;
  }

  .farm-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .farm-section-tools {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    flex-shrink: 0;
  }

  .view-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
  }

  .view-btn {
    display: grid;
    place-items: center;
    width: 1.85rem;
    height: 1.85rem;
    margin: 0;
    padding: 0;
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .view-btn:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .view-btn.is-on {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 22%, transparent);
    background: var(--surface-quiet);
  }

  .farm-week {
    --farm-face: 48px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    min-width: 0;
  }

  @media (min-width: 768px) {
    .farm-week {
      --farm-face: 64px;
    }
  }

  .farm-week.is-collapsed {
    --farm-face: 64px;
    display: flex;
  }

  @media (min-width: 768px) {
    .farm-week.is-collapsed {
      --farm-face: 80px;
    }
  }

  .farm-week.is-collapsed .farm-day {
    flex: 1;
    min-width: 0;
    border-left: none;
    align-items: center;
    gap: 0.85rem;
    padding: 1rem 0.35rem 1.15rem;
  }

  .farm-week.is-collapsed .farm-day-places {
    justify-content: center;
    align-content: center;
    gap: 0.45rem;
    flex: 1;
  }

  .farm-day {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    padding: 0.55rem 0.25rem 0.7rem;
    border-left: var(--border-width) solid var(--border-subtle);
  }

  .farm-day:first-child {
    border-left: none;
  }

  .farm-day-today {
    background: color-mix(
      in srgb,
      var(--foreground-color) 7%,
      var(--background-color)
    );
    box-shadow: inset 0 0 0 1px var(--accent-1);
  }

  .farm-day-head {
    margin: 0;
    text-align: center;
  }

  .farm-day-today .farm-day-head {
    color: var(--foreground-color);
  }

  .farm-day-places {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-content: center;
    align-items: center;
    gap: 0.3rem;
    flex: 1;
  }

  .farm-day-places li {
    flex: 0 0 auto;
    line-height: 0;
  }

  .farm-face {
    position: relative;
    width: var(--farm-face);
    overflow: hidden;
    border-radius: var(--radius-md);
    flex-shrink: 0;
    background: var(--surface-quiet);
    outline: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    outline-offset: -1px;
    line-height: 0;
  }

  .farm-face-mat {
    position: absolute;
    right: 0.15rem;
    bottom: 0.15rem;
    top: auto;
    left: auto;
    z-index: 1;
    width: calc(var(--farm-face) * 0.38);
    height: calc(var(--farm-face) * 0.38);
    border-radius: var(--radius-sm);
    object-fit: cover;
    background: color-mix(in srgb, var(--background-color) 72%, transparent);
    outline: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 28%, transparent);
    outline-offset: -1px;
    pointer-events: none;
  }

  .farm-face :global(.icon-root) {
    display: block;
  }

  .farm-face-splash,
  .farm-face-fallback {
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
  }

  .farm-face-splash {
    object-fit: cover;
    object-position: center 38%;
    transform-origin: 50% 38%;
    transform: scale(1.55);
  }

  .farm-face-fallback {
    background: color-mix(in srgb, var(--foreground-color) 16%, transparent);
  }

  .place-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.1rem;
  }

  @media (min-width: 768px) {
    .place-list {
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
      gap: 1.25rem 1.75rem;
    }
  }

  .place-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.45rem;
    min-width: 0;
  }

  .place-icons {
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    min-width: 0;
  }

  .place-boss {
    width: var(--farm-boss);
    height: var(--farm-boss);
    object-fit: contain;
    flex-shrink: 0;
  }

  .place-faces {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    min-width: 0;
  }

  .place-text {
    max-width: 100%;
  }
</style>
