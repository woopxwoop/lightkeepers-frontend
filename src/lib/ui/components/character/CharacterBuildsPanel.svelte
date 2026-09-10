<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";
  import WeaponIcon from "$lib/ui/components/WeaponIcon.svelte";
  import WeaponName from "$lib/ui/components/WeaponName.svelte";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import ArtifactIcon from "$lib/ui/components/ArtifactIcon.svelte";
  import HoverTooltip from "$lib/ui/components/HoverTooltip.svelte";
  import UpgradeImpactPopover from "$lib/ui/components/UpgradeImpactPopover.svelte";
  import InvestmentBuildCard from "$lib/ui/components/InvestmentBuildCard.svelte";
  import CharacterUsefulLinks from "$lib/ui/components/character/CharacterUsefulLinks.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import IconFileSearch from "$lib/ui/icons/IconFileSearch.svelte";
  import { loadRosterArtifacts } from "$lib/app/roster-inventory";
  import {
    artifactSlotIconUrl,
    getUiAssetUrl,
    CRIMSON_WITCH_FAVICON_URL,
    statIconUrl,
    translateStatKey,
    type CrimsonWitchLink,
  } from "$lib/utils";
  import { weaponByKey, ensureEquipmentData } from "$lib/equipment-data";
  import { useEquipmentData } from "$lib/equipment-data.svelte";
  import {
    MAIN_STAT_SLOTS,
    buildExamples,
    characterBuildFromExample,
    constellationPrioritySection,
    ascensionPrioritySection,
    exampleFeaturedAndMates,
    exampleHasHighConfig,
    exampleRelevantGoodKeys,
    exampleTeamKeys,
    levelPrioritySection,
    rankWeaponsByRarityAndTeams,
    recommendedSubstatSourceLabel,
    recommendedSubstatsFromBuilds,
    sigWeaponPrioritySection,
    talentPrioritySection,
  } from "$lib/character-builds";
  import { kitIconsFromCharacterKit } from "$lib/investment-build-card";
  import { skillIconUrl, talentIconUrl } from "$lib/asset-urls";
  import type { CharacterKit } from "$lib/types/character-kit";
  import type { CharacterIndex } from "$lib/types/investment";
  import type { CharacterOwned } from "$lib/definitions";
  import type { UpgradeTier } from "$lib/upgrade-priority";

  let {
    kit,
    builds,
    summaryStale,
    buildsUnavailable = false,
    elColor,
    goodKey,
    goodKeyMap,
    crimsonWitchLinks,
  }: {
    kit: CharacterKit;
    builds: CharacterIndex | null;
    summaryStale: boolean;
    buildsUnavailable?: boolean;
    elColor: string;
    goodKey: string;
    goodKeyMap: Map<string, CharacterOwned>;
    crimsonWitchLinks: CrimsonWitchLink[];
  } = $props();

  const equipment = useEquipmentData();

  onMount(() => {
    void ensureEquipmentData().catch(() => {});
    void loadRosterArtifacts().catch(() => {});
  });

  function iconUrl(icon: string, kind: "skill" | "talent"): string | null {
    return kind === "skill" ? skillIconUrl(icon) : talentIconUrl(icon);
  }

  /** Weapons: BT strength → teams → measured sigs → rarity → name. */
  let rankedWeapons = $derived.by(() => {
    void equipment.version;
    return rankWeaponsByRarityAndTeams(
      builds?.weapons,
      (key) => weaponByKey.get(key)?.stars ?? 0,
      builds?.vertical_importance?.sig_weapons?.map((s) => s.key),
    );
  });

  let recommendedSubstats = $derived(recommendedSubstatsFromBuilds(builds));

  let talentSection = $derived(
    talentPrioritySection(builds, (kitType) => {
      const skill = kit.skills.find((s) => s.type === kitType);
      if (!skill) return null;
      return iconUrl(skill.icon, "skill") ?? getUiAssetUrl(skill.icon);
    }),
  );

  let levelSection = $derived(levelPrioritySection(builds));
  let ascensionSection = $derived(ascensionPrioritySection(builds));
  let levelIcon = $derived(getUiAssetUrl("UI_ItemIcon_104003"));
  let ascensionIcon = $derived(getUiAssetUrl("UI_ItemIcon_104104"));

  let consSection = $derived(constellationPrioritySection(builds));
  let sigSection = $derived(sigWeaponPrioritySection(builds));
  let exampleBuilds = $derived(buildExamples(builds));
  /** User pick among diversified examples; empty → highest-DPS default. */
  let examplePick = $state("");
  let exampleMenuOpen = $state(false);
  let activeExample = $derived.by(() => {
    const list = exampleBuilds;
    if (!list.length) return null;
    return list.find((e) => e.state_key === examplePick) ?? list[0] ?? null;
  });
  let exampleAlts = $derived(
    exampleBuilds.filter((e) => e.state_key !== activeExample?.state_key),
  );
  let exampleCardBuild = $derived.by(() => {
    if (!activeExample) return null;
    const tier = exampleHasHighConfig(activeExample)
      ? ("high" as const)
      : ("mid" as const);
    return characterBuildFromExample(activeExample, tier);
  });
  let exampleCardRelevantKeys = $derived.by(() => {
    if (!activeExample) return null;
    const tier = exampleHasHighConfig(activeExample)
      ? ("high" as const)
      : ("mid" as const);
    return exampleRelevantGoodKeys(activeExample, tier);
  });
  let exampleCardKit = $derived(kitIconsFromCharacterKit(kit));
  let exampleCardCharacter = $derived(goodKeyMap.get(goodKey) ?? null);
</script>

{#snippet talentRow(row: {
  name: string;
  icon: string | null;
  rank?: number;
  priority?: UpgradeTier;
  kind?: "talent" | "level";
  priorityLabel?: string;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  teams?: number;
})}
  <li class="talent-priority-row" data-priority={row.priority}>
    {#if row.rank != null}
      <span class="talent-priority-rank" style="color: {elColor};"
        >{row.rank}</span
      >
    {/if}
    {#if row.icon}
      <img
        src={row.icon}
        alt=""
        class="kit-icon talent-priority-icon shrink-0"
        loading="lazy"
      />
    {/if}
    <div class="talent-priority-copy">
      <div class="talent-priority-name">{row.name}</div>
      {#if row.kind != null && row.priority != null && row.priorityLabel != null}
        <UpgradeImpactPopover
          label={row.priorityLabel}
          tier={row.priority}
          kind={row.kind}
          mean={row.mean}
          median={row.median}
          min={row.min}
          max={row.max}
          teams={row.teams}
        />
      {/if}
    </div>
  </li>
{/snippet}

{#snippet consRow(row: {
  cons: number;
  priority: UpgradeTier;
  priorityLabel: string;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  teams?: number;
})}
  {@const constellation = kit.constellations.find((c) => c.index === row.cons)}
  {@const icon = constellation
    ? (iconUrl(constellation.icon, "talent") ??
      getUiAssetUrl(constellation.icon))
    : null}
  <li class="talent-priority-row" data-priority={row.priority}>
    <span class="talent-priority-rank" style="color: {elColor};"
      >C{row.cons}</span
    >
    {#if icon}
      <img
        src={icon}
        alt=""
        class="kit-icon talent-priority-icon shrink-0"
        loading="lazy"
      />
    {/if}
    <div class="talent-priority-copy">
      <div class="talent-priority-name">
        {constellation?.name ?? `C${row.cons}`}
      </div>
      <UpgradeImpactPopover
        label={row.priorityLabel}
        tier={row.priority}
        kind="constellation"
        mean={row.mean}
        median={row.median}
        min={row.min}
        max={row.max}
        teams={row.teams}
      />
    </div>
  </li>
{/snippet}

{#snippet sigRow(row: {
  key: string;
  priority: UpgradeTier;
  priorityLabel: string;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  teams?: number;
})}
  <li class="talent-priority-row" data-priority={row.priority}>
    <span class="kit-icon talent-priority-icon shrink-0">
      <WeaponIcon
        weaponKey={row.key}
        alt=""
        class="h-full w-full object-contain"
      />
    </span>
    <div class="talent-priority-copy">
      <div class="talent-priority-name">
        <WeaponName weaponKey={row.key} />
      </div>
      <UpgradeImpactPopover
        label={row.priorityLabel}
        tier={row.priority}
        kind="signature"
        mean={row.mean}
        median={row.median}
        min={row.min}
        max={row.max}
        teams={row.teams}
      />
    </div>
  </li>
{/snippet}

<div
  role="tabpanel"
  id="tabpanel-builds"
  aria-labelledby="tab-builds"
  tabindex="0"
>
  {#if builds}
    <section class="board-section">
      <h2 class="section-title">Weapons</h2>
      {#if rankedWeapons.length === 0}
        <p class="muted-note">No weapon data yet.</p>
      {:else}
        <div class="equip-grid">
          {#each rankedWeapons as w (w.key)}
            <div class="equip-tile relative group">
              <div class="equip-icon-wrap">
                <WeaponIcon weaponKey={w.key} class="equip-icon" />
              </div>
              <WeaponTooltip weaponKey={w.key} />
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="board-section">
      <h2 class="section-title">Artifact sets</h2>
      {#if !builds.sets?.length}
        <p class="muted-note">No set data yet.</p>
      {:else}
        <div class="equip-grid">
          {#each builds.sets as s}
            <div class="equip-tile relative group">
              <div class="equip-icon-wrap">
                <ArtifactIcon setKey={s.key} class="equip-icon" />
                {#if s.count}
                  <div class="piece-badge">
                    <span style="color: {elColor};">{s.count}pc</span>
                  </div>
                {/if}
              </div>
              <ArtifactTooltip setKey={s.key} pieceCount={s.count ?? null} />
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="board-section">
      <h2 class="section-title">Main stats</h2>
      <div class="main-stats">
        {#each MAIN_STAT_SLOTS as slot}
          <div class="main-stat-col">
            <h3 class="slot-label">
              <img
                src={artifactSlotIconUrl(slot.key)}
                alt=""
                class="stat-icon main-stat-icon shrink-0"
                loading="lazy"
              />
              {slot.label}
            </h3>
            {#if (builds.main_stats?.[slot.key] ?? []).length === 0}
              <p class="muted-note">—</p>
            {:else}
              <ul class="stat-list">
                {#each builds.main_stats?.[slot.key] ?? [] as stat}
                  {@const icon = statIconUrl(stat.key)}
                  <li class="main-stat-item">
                    <span class="flex items-center gap-1.5 min-w-0">
                      {#if icon}
                        <img
                          src={icon}
                          alt=""
                          class="stat-icon main-stat-icon shrink-0"
                          loading="lazy"
                        />
                      {/if}
                      <span class="stat-name">{translateStatKey(stat.key)}</span
                      >
                    </span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <section class="board-section">
      <h2 class="section-title">Recommended substats</h2>
      {#if recommendedSubstats.length === 0}
        <p class="muted-note">No substat data yet.</p>
      {:else}
        <div class="substat-row">
          {#each recommendedSubstats as roll}
            {@const icon = statIconUrl(roll.key)}
            <button
              type="button"
              class="stat-chip group relative flex items-center justify-center"
              class:is-main={roll.matchesMain}
              style={roll.matchesMain ? `border-color: ${elColor}` : undefined}
              aria-label={translateStatKey(roll.key)}
            >
              {#if icon}
                <img src={icon} alt="" class="stat-icon" loading="lazy" />
              {:else}
                <span class="stat-chip-fallback">
                  {translateStatKey(roll.key)}
                </span>
              {/if}
              <HoverTooltip class="max-w-56" label={translateStatKey(roll.key)}>
                <div class="tip-detail-text font-medium">
                  {translateStatKey(roll.key)}
                </div>
                {#if roll.matchesMain}
                  <div
                    class="tip-detail-text tip-detail-text--small mt-1 opacity-85"
                  >
                    Also a main on {roll.mainSlots.join(" / ")}
                  </div>
                {/if}
                {#if roll.mean > 0}
                  {@const teams = roll.teams}
                  <div
                    class="tip-detail-text tip-detail-text--small mt-1 opacity-85"
                  >
                    {roll.mean.toFixed(1)}
                    {recommendedSubstatSourceLabel(roll.source)} · {teams} team{teams ===
                    1
                      ? ""
                      : "s"}
                  </div>
                {/if}
              </HoverTooltip>
            </button>
          {/each}
        </div>
      {/if}
    </section>

    {#if talentSection || levelSection || consSection || sigSection}
      <div class="invest-grid">
        <div class="invest-col">
          {#if talentSection}
            <section class="board-section">
              <h2 class="section-title">
                Talent priority
                {#if talentSection.source === "guide" && talentSection.simMissing}
                  <span class="meta-sub">(no simulation data yet)</span>
                {/if}
              </h2>
              <ul class="talent-priority-list">
                {#if talentSection.source === "sim"}
                  {#each talentSection.rows as row, i}
                    {@render talentRow({
                      name: row.label,
                      icon: row.icon,
                      rank: i + 1,
                      priority: row.priority,
                      kind: "talent",
                      priorityLabel: row.priorityLabel,
                      mean: row.mean,
                      median: row.median,
                      min: row.min,
                      max: row.max,
                      teams: row.teams,
                    })}
                  {/each}
                {:else}
                  {#each talentSection.rows as row, i}
                    {@render talentRow({
                      name: row.label,
                      icon: row.icon,
                      rank: i + 1,
                    })}
                  {/each}
                {/if}
              </ul>
            </section>
          {/if}

          {#if levelSection || ascensionSection}
            <section class="board-section">
              <h2 class="section-title">
                Character level
                {#if levelSection?.source === "guide" && levelSection.simMissing && !ascensionSection}
                  <span class="meta-sub">(no simulation data yet)</span>
                {/if}
              </h2>
              <ul class="talent-priority-list">
                {#if levelSection}
                  {#if levelSection.source === "sim"}
                    {@render talentRow({
                      name: "Level 90",
                      icon: levelIcon,
                      priority: levelSection.row.priority,
                      kind: "level",
                      priorityLabel: levelSection.row.priorityLabel,
                      mean: levelSection.row.mean,
                      median: levelSection.row.median,
                      min: levelSection.row.min,
                      max: levelSection.row.max,
                      teams: levelSection.row.teams,
                    })}
                  {:else}
                    {@render talentRow({
                      name: "Level 90",
                      icon: levelIcon,
                      priority: levelSection.priority,
                      kind: "level",
                      priorityLabel: levelSection.priorityLabel,
                    })}
                  {/if}
                {/if}
                {#if ascensionSection?.source === "sim"}
                  {@render talentRow({
                    name: "Ascension 6",
                    icon: ascensionIcon,
                    priority: ascensionSection.row.priority,
                    kind: "level",
                    priorityLabel: ascensionSection.row.priorityLabel,
                    mean: ascensionSection.row.mean,
                    median: ascensionSection.row.median,
                    min: ascensionSection.row.min,
                    max: ascensionSection.row.max,
                    teams: ascensionSection.row.teams,
                  })}
                {/if}
              </ul>
            </section>
          {/if}
        </div>

        <div class="invest-col">
          {#if consSection}
            <section class="board-section">
              <h2 class="section-title">
                Constellation Impact
                {#if consSection.source === "guide" && consSection.simMissing}
                  <span class="meta-sub">(no simulation data yet)</span>
                {/if}
              </h2>
              <ul class="talent-priority-list">
                {#if consSection.source === "sim"}
                  {#each consSection.rows as row}
                    {@render consRow({
                      cons: row.cons,
                      priority: row.priority,
                      priorityLabel: row.priorityLabel,
                      mean: row.mean_pct_gain,
                      median: row.median_pct_gain,
                      min: row.min_pct_gain,
                      max: row.max_pct_gain,
                      teams: row.teams,
                    })}
                  {/each}
                {:else}
                  {#each consSection.rows as row}
                    {@render consRow(row)}
                  {/each}
                {/if}
              </ul>
            </section>
          {/if}

          {#if sigSection}
            <section class="board-section">
              <h2 class="section-title">
                Signature weapon impact
                {#if sigSection.source === "guide" && sigSection.simMissing}
                  <span class="meta-sub">(no simulation data yet)</span>
                {/if}
              </h2>
              <ul class="talent-priority-list">
                {#if sigSection.source === "sim"}
                  {#each sigSection.rows as row}
                    {@render sigRow({
                      key: row.key,
                      priority: row.priority,
                      priorityLabel: row.priorityLabel,
                      mean: row.mean_pct_gain,
                      median: row.median_pct_gain,
                      min: row.min_pct_gain,
                      max: row.max_pct_gain,
                      teams: row.teams,
                    })}
                  {/each}
                {:else}
                  {#each sigSection.rows as row}
                    {@render sigRow(row)}
                  {/each}
                {/if}
              </ul>
            </section>
          {/if}
        </div>
      </div>
    {/if}

    {#if activeExample}
      {@const activeSplit = exampleFeaturedAndMates(
        exampleTeamKeys(activeExample),
        goodKey,
      )}
      <section class="board-section">
        <h2 class="section-title">Stat goals</h2>
        <p class="section-lede">
          DPS stat goals assume very high artifact investment. A lot of supports
          only care about ER (and Crit Rate if running a Favonius weapon)
        </p>
        <div class="example-build pt-4">
          <div class="example-build-context">
            <div class="example-picker-primary">
              <div class="example-picker-main">
                <div
                  class="example-picker-grid example-picker-grid--selected"
                  role="group"
                  aria-label="Selected team"
                >
                  <div
                    class="example-picker-slot example-picker-slot--featured"
                  >
                    {#if activeSplit.featured}
                      {@const featured = goodKeyMap.get(activeSplit.featured)}
                      {#if featured}
                        <CharacterIcon
                          character={featured}
                          iconStyle="tcg"
                          loading="lazy"
                        />
                      {/if}
                    {/if}
                  </div>
                  {#each activeSplit.mates as mateKey, i (mateKey ?? `active-empty-${i}`)}
                    <div class="example-picker-slot">
                      {#if mateKey}
                        {@const mate = goodKeyMap.get(mateKey)}
                        {#if mate}
                          <CharacterIcon
                            character={mate}
                            iconStyle="tcg"
                            loading="lazy"
                          />
                        {/if}
                      {/if}
                    </div>
                  {/each}
                </div>

                {#if exampleAlts.length > 0}
                  <div
                    class="example-picker-alts-shell"
                    class:open={exampleMenuOpen}
                    id="example-picker-alts"
                    style="--alt-count: {exampleAlts.length}"
                    aria-hidden={!exampleMenuOpen}
                  >
                    <div class="example-picker-alts-clip">
                      <ol class="example-picker-alts">
                        {#each exampleAlts as example, ti (example.state_key)}
                          {@const split = exampleFeaturedAndMates(
                            exampleTeamKeys(example),
                            goodKey,
                          )}
                          <li class="example-picker-alt-wrap" style="--i: {ti}">
                            <button
                              type="button"
                              class="example-picker-alt"
                              aria-label={`Select ${example.team_name}`}
                              tabindex={exampleMenuOpen ? 0 : -1}
                              onclick={() => {
                                examplePick = example.state_key;
                                exampleMenuOpen = false;
                              }}
                            >
                              <div class="example-picker-grid">
                                <div
                                  class="example-picker-slot example-picker-slot--spacer"
                                  aria-hidden="true"
                                ></div>
                                <div class="example-picker-mate-row">
                                  {#each split.mates as mateKey, i (mateKey ?? `alt-${example.state_key}-${i}`)}
                                    <div class="example-picker-slot">
                                      {#if mateKey}
                                        {@const mate = goodKeyMap.get(mateKey)}
                                        {#if mate}
                                          <CharacterIcon
                                            character={mate}
                                            iconStyle="tcg"
                                            loading="lazy"
                                          />
                                        {/if}
                                      {/if}
                                    </div>
                                  {/each}
                                </div>
                              </div>
                            </button>
                          </li>
                        {/each}
                      </ol>
                    </div>
                  </div>
                {/if}
              </div>
              <div class="example-picker-actions">
                <a
                  class="example-picker-action"
                  href={resolve(`/teams/${activeExample.team_key}`)}
                  aria-label="View team details"
                  title="View team details"
                >
                  <IconFileSearch size={18} />
                </a>
                {#if exampleAlts.length > 0}
                  <button
                    type="button"
                    class="example-picker-action"
                    class:open={exampleMenuOpen}
                    aria-expanded={exampleMenuOpen}
                    aria-controls="example-picker-alts"
                    aria-label={exampleMenuOpen
                      ? "Hide other example teams"
                      : "Show other example teams"}
                    onclick={() => (exampleMenuOpen = !exampleMenuOpen)}
                  >
                    <IconCog size={18} />
                  </button>
                {/if}
              </div>
            </div>
          </div>

          {#if exampleCardBuild}
            <InvestmentBuildCard
              build={exampleCardBuild}
              character={exampleCardCharacter}
              kit={exampleCardKit}
              relevantKeys={exampleCardRelevantKeys}
              class="example-build-card"
            />
          {/if}
        </div>
      </section>
    {/if}

    {#if builds.notes}
      <section class="board-section notes-section">
        <h2 class="section-title">Notes</h2>
        <p class="build-notes">{builds.notes}</p>
      </section>
    {/if}
  {:else}
    <section class="board-section">
      <p class="muted-note builds-empty-msg">
        {#if buildsUnavailable}
          Could not load builds right now.
        {:else if summaryStale}
          {kit.name}'s Lightkeepers build numbers are outdated after a recent
          kit change.
        {:else}
          No Lightkeepers build summary for {kit.name} yet.
        {/if}
      </p>
      {#if crimsonWitchLinks.length === 1 && crimsonWitchLinks[0]}
        <p class="builds-try">
          <span>Try:</span>
          <a
            class="useful-link-cta"
            href={crimsonWitchLinks[0].url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              class="useful-link-icon"
              src={CRIMSON_WITCH_FAVICON_URL}
              alt=""
              width="32"
              height="32"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            Crimson Witch build guide
          </a>
        </p>
      {:else if crimsonWitchLinks.length > 1}
        <p class="builds-try">Try:</p>
        <CharacterUsefulLinks links={crimsonWitchLinks} />
      {/if}
    </section>
  {/if}
</div>

<style>
  .section-title {
    margin-bottom: var(--space-3);
  }

  .board-section {
    padding: var(--space-4);
  }

  .slot-label {
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-mid);
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
  }

  .muted-note {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .builds-empty-msg {
    margin-bottom: var(--space-4);
    font-size: var(--text-sm);
  }

  .builds-try {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem 0.65rem;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .useful-link-icon {
    width: 2.5rem;
    height: 2.5rem;
    object-fit: contain;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
  }

  .useful-link-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--accent-1);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .useful-link-cta .useful-link-icon {
    width: 2rem;
    height: 2rem;
  }

  .useful-link-cta:hover {
    color: color-mix(in srgb, var(--accent-1) 85%, white);
  }

  .build-notes {
    font-size: var(--text-sm);
    color: var(--foreground-mid);
    line-height: 1.55;
    max-width: 42rem;
    white-space: pre-wrap;
  }

  .example-build {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    column-gap: var(--space-5);
    row-gap: var(--space-4);
    align-items: start;
  }

  .example-build-context {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .example-build :global(.example-build-card) {
    min-width: 0;
  }

  .example-build :global(.example-build-card .build-grid) {
    min-height: 16.5rem;
  }

  .example-build :global(.example-build-card .build-art--portrait) {
    width: 10rem;
  }

  .example-build :global(.example-build-card .build-art--enka) {
    width: 9.25rem;
  }

  @media (max-width: 640px) {
    .example-build :global(.example-build-card .build-grid) {
      min-height: 14rem;
    }

    .example-build :global(.example-build-card .build-art--portrait) {
      width: 7rem;
    }

    .example-build :global(.example-build-card .build-art--enka) {
      width: 6.5rem;
    }
  }

  .example-picker-primary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: 0.5rem;
    align-items: start;
  }

  @media (max-width: 840px) {
    .example-build {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .example-picker-main {
    display: contents;
  }

  .example-picker-grid--selected {
    grid-column: 1;
    grid-row: 1;
  }

  .example-picker-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.3rem;
    width: 100%;
  }

  .example-picker-slot {
    position: relative;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: var(--background-mid);
  }

  .example-picker-slot--featured {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 55%,
      rgba(255, 255, 255, 0.2)
    );
  }

  .example-picker-slot--spacer {
    visibility: hidden;
    border: none;
    background: transparent;
  }

  .example-picker-actions {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .example-picker-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    text-decoration: none;
    transition:
      color 280ms ease,
      border-color 280ms ease;
  }

  .example-picker-action :global(svg) {
    transition: transform 480ms cubic-bezier(0.22, 1, 0.36, 1);
    transform-origin: center;
  }

  .example-picker-action:hover,
  .example-picker-action.open {
    color: var(--accent-1);
    border-color: color-mix(
      in srgb,
      var(--accent-1) 45%,
      rgba(255, 255, 255, 0.14)
    );
  }

  .example-picker-action.open :global(svg) {
    transform: rotate(90deg);
  }

  .example-picker-alts-shell {
    grid-column: 1;
    grid-row: 2;
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 520ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .example-picker-alts-shell.open {
    grid-template-rows: 1fr;
  }

  .example-picker-alts-clip {
    overflow: hidden;
    min-height: 0;
  }

  .example-picker-alts {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin: 0;
    padding: 0.45rem 0 0.15rem;
    list-style: none;
  }

  .example-picker-alt-wrap {
    transform: translateY(-0.65rem);
    opacity: 0.25;
    transition:
      transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 420ms ease;
    transition-delay: calc((var(--alt-count, 1) - 1 - var(--i, 0)) * 45ms);
  }

  .example-picker-alts-shell.open .example-picker-alt-wrap {
    transform: translateY(0);
    opacity: 1;
    transition-delay: calc(var(--i, 0) * 55ms);
  }

  .example-picker-alt {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .example-picker-mate-row {
    grid-column: 2 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.3rem;
    padding: 0.28rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.16);
    background: color-mix(in srgb, var(--background-mid) 88%, transparent);
  }

  .example-picker-alt:hover .example-picker-mate-row,
  .example-picker-alt:focus-visible .example-picker-mate-row {
    border-color: color-mix(
      in srgb,
      var(--accent-1) 50%,
      rgba(255, 255, 255, 0.2)
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .example-picker-action :global(svg),
    .example-picker-alts-shell,
    .example-picker-alt-wrap {
      transition: none;
    }
  }

  .stat-name {
    color: var(--foreground-color);
    font-size: var(--text-xs);
  }

  .main-stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .invest-grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .invest-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  @media (min-width: 1024px) {
    .invest-grid {
      grid-template-columns: 1fr 1fr;
    }

    .invest-col + .invest-col {
      border-left: var(--border-width) solid rgba(255, 255, 255, 0.1);
    }
  }

  .kit-icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--background-color) 70%, transparent);
  }

  .equip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .equip-tile {
    width: 4.5rem;
    overflow: hidden;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .equip-icon-wrap {
    width: 4.5rem;
    height: 4.5rem;
    position: relative;
  }

  .equip-icon-wrap :global(.equip-icon) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .piece-badge {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: flex-end;
    padding: 1rem 0.35rem 0.35rem;
    background: linear-gradient(
      transparent,
      color-mix(in srgb, var(--background-color) 85%, transparent)
    );
    z-index: 10;
  }

  .piece-badge span {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    line-height: 1.1;
  }

  .main-stats {
    display: grid;
    gap: var(--space-3);
  }

  @media (min-width: 640px) {
    .main-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
    }

    .main-stat-col + .main-stat-col {
      border-left: var(--border-width) solid rgba(255, 255, 255, 0.14);
      padding-left: var(--space-3);
      margin-left: var(--space-3);
    }
  }

  .substat-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stat-chip {
    width: 2.75rem;
    height: 2.75rem;
    padding: 0.55rem;
    border-radius: var(--radius-md);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.24);
    cursor: pointer;
  }

  .stat-chip-fallback {
    font-size: 0.65rem;
    padding: 0.15rem;
    text-align: center;
    line-height: 1.15;
    color: var(--foreground-mid);
  }

  .talent-priority-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .talent-priority-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0;
  }

  .talent-priority-row + .talent-priority-row {
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.1);
  }

  .talent-priority-rank {
    font-size: 0.85rem;
    font-weight: 700;
    width: 1.25rem;
    text-align: center;
    flex-shrink: 0;
  }

  .talent-priority-icon {
    width: 40px;
    height: 40px;
  }

  .talent-priority-copy {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .talent-priority-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--foreground-color);
  }

  .stat-icon {
    width: 100%;
    height: 100%;
  }

  .main-stat-icon {
    width: 0.95rem;
    height: 0.95rem;
  }
</style>
