<script lang="ts">
  /**
   * Research answer: short lede + site-native panels (comparison, teams, ranks, ER, rotation).
   * When `view === "build"`, mounts BuildPanel instead of the freeform stack.
   */
  import { page } from "$app/state";
  import {
    collectOwnedResearchGearKeys,
    type ResearchOwnedGearKeys,
  } from "$lib/app/research";
  import {
    loadRosterArtifacts,
    loadRosterWeapons,
  } from "$lib/app/roster-inventory";
  import { handCharactersFromMembers } from "$lib/character-teams";
  import type { Character } from "$lib/definitions";
  import { equipmentVersion } from "$lib/equipment-data";
  import {
    RESEARCH_ENTITY_SLOT_ATTR,
    citationShortLabel,
    orderCitationsForDisplay,
    preloadEntityIconData,
    renderResearchAnswer,
    renderResearchInline,
    safeExternalHref,
  } from "$lib/research-answer";
  import type {
    ResearchArtifactOption,
    ResearchCitation,
    ResearchComparison,
    ResearchEntity,
    ResearchErTarget,
    ResearchRankItem,
    ResearchRotation,
    ResearchStatPriority,
    ResearchTeamLineup,
    ResearchView,
  } from "$lib/research-types";
  import { charactersOwned } from "$lib/stores";
  import BuildPanel from "$lib/ui/components/BuildPanel.svelte";
  import ResearchEntityMention from "$lib/ui/components/ResearchEntityMention.svelte";
  import TeamCardHand from "$lib/ui/components/TeamCardHand.svelte";
  import { mount, tick, unmount } from "svelte";

  let {
    markdown,
    entities = [],
    citations = [],
    disagreements = [],
    view = null,
    focus_name_id = null,
    comparison = null,
    teams = null,
    weapon_ranks = null,
    artifact_ranks = null,
    artifact_options = null,
    stat_priority = null,
    er_targets = null,
    rotation = null,
    ownedGear = null,
  }: {
    markdown: string;
    entities?: ResearchEntity[];
    citations?: ResearchCitation[];
    disagreements?: { summary: string; citation_ids?: number[] }[];
    view?: ResearchView | null;
    focus_name_id?: string | null;
    comparison?: ResearchComparison | null;
    teams?: ResearchTeamLineup[] | null;
    weapon_ranks?: ResearchRankItem[] | null;
    artifact_ranks?: ResearchRankItem[] | null;
    artifact_options?: ResearchArtifactOption[] | null;
    stat_priority?: ResearchStatPriority | null;
    er_targets?: ResearchErTarget[] | null;
    rotation?: ResearchRotation | null;
    ownedGear?: ResearchOwnedGearKeys | null;
  } = $props();

  let buildOwnedGear = $state<ResearchOwnedGearKeys | null>(null);

  $effect(() => {
    if (view !== "build") {
      buildOwnedGear = null;
      return;
    }
    if (ownedGear) {
      buildOwnedGear = ownedGear;
      return;
    }
    const characters = $charactersOwned;
    let cancelled = false;
    void (async () => {
      let weapons = null;
      let artifacts = null;
      try {
        weapons = await loadRosterWeapons();
      } catch {
        // Soft-fail.
      }
      try {
        artifacts = await loadRosterArtifacts();
      } catch {
        // Soft-fail.
      }
      if (cancelled) return;
      buildOwnedGear = collectOwnedResearchGearKeys({
        inventoryWeapons: weapons,
        inventoryArtifacts: artifacts,
        characters,
      });
    })();
    return () => {
      cancelled = true;
    };
  });

  const citeInstanceId = $props.id();
  const citeAnchorPrefix = `ra-${citeInstanceId}-`;

  let answerRoot: HTMLDivElement | undefined = $state();

  $effect(() => {
    void preloadEntityIconData();
  });

  function comparisonBlob(c: ResearchComparison): string[] {
    const parts = [c.verdict, c.option_a.label, c.option_a.summary, c.option_b.label, c.option_b.summary];
    for (const side of [c.option_a, c.option_b]) {
      for (const b of side.bullets ?? []) parts.push(b);
    }
    return parts;
  }

  function isSafeCiteId(id: unknown): id is number {
    return typeof id === "number" && Number.isSafeInteger(id) && id >= 0;
  }

  function teamsBlob(list: ResearchTeamLineup[]): string[] {
    const parts: string[] = [];
    for (const t of list) {
      parts.push(t.label);
      if (t.notes) parts.push(t.notes);
      for (const id of t.citation_ids ?? []) {
        if (isSafeCiteId(id)) parts.push(`[[cite:${id}]]`);
      }
    }
    return parts;
  }

  function ranksBlob(list: ResearchRankItem[]): string[] {
    const parts: string[] = [];
    for (const r of list) {
      if (r.note) parts.push(r.note);
      for (const id of r.citation_ids ?? []) {
        if (isSafeCiteId(id)) parts.push(`[[cite:${id}]]`);
      }
    }
    return parts;
  }

  function erBlob(list: ResearchErTarget[]): string[] {
    const parts: string[] = [];
    for (const t of list) {
      if (t.context) parts.push(t.context);
      for (const id of t.citation_ids ?? []) {
        if (isSafeCiteId(id)) parts.push(`[[cite:${id}]]`);
      }
    }
    return parts;
  }

  function rotationBlob(r: ResearchRotation): string[] {
    const parts = [...r.steps];
    if (r.notes) parts.push(r.notes);
    for (const id of r.citation_ids ?? []) {
      if (isSafeCiteId(id)) parts.push(`[[cite:${id}]]`);
    }
    return parts;
  }

  let footnotes = $derived(
    orderCitationsForDisplay(citations, markdown, [
      ...(comparison ? comparisonBlob(comparison) : []),
      ...(teams?.length ? teamsBlob(teams) : []),
      ...(weapon_ranks?.length ? ranksBlob(weapon_ranks) : []),
      ...(artifact_ranks?.length ? ranksBlob(artifact_ranks) : []),
      ...(er_targets?.length ? erBlob(er_targets) : []),
      ...(rotation ? rotationBlob(rotation) : []),
    ]).filter((cite) => isSafeCiteId(cite.id)),
  );

  let citeNum = $derived.by(() => {
    const map = new Map<number, number>();
    let n = 0;
    for (const cite of footnotes) {
      n += 1;
      map.set(cite.id, n);
    }
    return map;
  });

  let renderOpts = $derived({
    citeAnchorPrefix,
    citeDisplayNum: citeNum,
  });

  let html = $derived.by(() => {
    void $equipmentVersion;
    return renderResearchAnswer(markdown, entities, citations, renderOpts);
  });

  let verdictHtml = $derived.by(() => {
    void $equipmentVersion;
    if (!comparison?.verdict) return null;
    return renderResearchInline(comparison.verdict, entities, citations, renderOpts);
  });

  let sides = $derived.by(() => {
    void $equipmentVersion;
    if (!comparison) return [];
    return [
      { key: "a" as const, side: comparison.option_a },
      { key: "b" as const, side: comparison.option_b },
    ].map(({ key, side }) => ({
      key,
      labelHtml: renderResearchInline(side.label, entities, citations, renderOpts),
      summaryHtml: renderResearchInline(side.summary, entities, citations, renderOpts),
      bullets: (side.bullets ?? []).map((b) =>
        renderResearchInline(b, entities, citations, renderOpts),
      ),
    }));
  });

  let entityByKey = $derived.by(() => {
    const map = new Map<string, ResearchEntity>();
    for (const e of entities) map.set(e.key, e);
    return map;
  });

  let entityByNameId = $derived.by(() => {
    const map = new Map<string, ResearchEntity>();
    for (const e of entities) {
      if (e.type === "character" && e.name_id) map.set(e.name_id, e);
    }
    return map;
  });

  let entityByWeapon = $derived.by(() => {
    const map = new Map<string, ResearchEntity>();
    for (const e of entities) {
      if (e.type === "weapon") {
        if (e.weapon_key) map.set(e.weapon_key.toLowerCase(), e);
        map.set(e.label.toLowerCase(), e);
      }
    }
    return map;
  });

  let entityBySet = $derived.by(() => {
    const map = new Map<string, ResearchEntity>();
    for (const e of entities) {
      if (e.type === "artifact_set") {
        if (e.set_key) map.set(e.set_key.toLowerCase(), e);
        map.set(e.label.toLowerCase(), e);
      }
    }
    return map;
  });

  function resolveGearEntity(
    raw: string | null | undefined,
    kind: "weapon" | "set",
    resolvedKey?: string | null,
  ): ResearchEntity | null {
    const map = kind === "weapon" ? entityByWeapon : entityBySet;
    const candidates = [resolvedKey, raw].filter(Boolean) as string[];
    for (const rawVal of candidates) {
      // Personalize sometimes appends (R1)/(R5) onto keys — strip for lookup.
      const stripped = rawVal
        .replace(/\s*[\(\[]?\s*r\s*[1-5]\s*[\)\]]?\s*$/i, "")
        .trim();
      for (const candidate of [rawVal, stripped]) {
        if (!candidate) continue;
        const key = candidate.toLowerCase();
        const compact = candidate.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
        const ent =
          map.get(key) ||
          map.get(compact) ||
          [...map.values()].find(
            (e) =>
              e.label.toLowerCase() === key ||
              (e.weapon_key ?? e.set_key ?? "").toLowerCase() === compact ||
              (e.weapon_key ?? e.set_key ?? "")
                .replace(/[^A-Za-z0-9]/g, "")
                .toLowerCase() === compact,
          );
        if (ent) return ent;
      }
    }
    return null;
  }

  function citeSups(ids: number[] | undefined): string {
    return (ids ?? [])
      .filter(isSafeCiteId)
      .map((id) => {
        const n = citeNum.get(id);
        if (!n) return "";
        return `<sup class="research-cite"><a href="#${citeAnchorPrefix}research-cite-${id}" title="Source ${n}">${n}</a></sup>`;
      })
      .join("");
  }

  let characterMap = $derived.by(() => {
    const mapping = page.data.mapping as Map<string, Character> | undefined;
    return mapping ?? new Map<string, Character>();
  });

  let lineupCards = $derived.by(() => {
    void $equipmentVersion;
    if (!teams?.length) return [];
    return teams.map((team, idx) => {
      const hand = handCharactersFromMembers(team.members, characterMap);
      const hasPortraits = hand.some((c) => c != null);
      const members = team.members.map((id) => {
        const ent = entityByNameId.get(id);
        return {
          id,
          entity: ent ?? null,
          label: ent?.label ?? id,
        };
      });
      return {
        key: `${idx}-${team.label}`,
        label: team.label,
        hand,
        hasPortraits,
        members,
        weaponEntity: resolveGearEntity(team.weapon, "weapon", team.weapon_key),
        weaponLabel: team.weapon,
        setEntity: resolveGearEntity(team.artifact_set, "set", team.set_key),
        setLabel: team.artifact_set,
        notesHtml: team.notes
          ? renderResearchInline(team.notes, entities, citations, renderOpts)
          : null,
        citeHtml: citeSups(team.citation_ids),
      };
    });
  });

  function mapRankRows(
    list: ResearchRankItem[] | null | undefined,
    kind: "weapon" | "set",
  ) {
    if (!list?.length) return [];
    return list.map((row, idx) => {
      const entity = resolveGearEntity(row.key, kind, row.key);
      return {
        key: `${kind}-${idx}-${row.rank}-${row.key}`,
        rank: row.rank,
        entity,
        label: row.key,
        noteHtml: row.note
          ? renderResearchInline(row.note, entities, citations, renderOpts)
          : null,
        citeHtml: citeSups(row.citation_ids),
      };
    });
  }

  let weaponRankRows = $derived.by(() => {
    void $equipmentVersion;
    return mapRankRows(weapon_ranks, "weapon");
  });

  let artifactRankRows = $derived.by(() => {
    void $equipmentVersion;
    return mapRankRows(artifact_ranks, "set");
  });

  function formatErRange(t: ResearchErTarget): string {
    const min = t.min_er;
    const max = t.max_er;
    if (min != null && max != null && min !== max) return `${min}–${max}%`;
    if (min != null) return `${min}%`;
    if (max != null) return `${max}%`;
    return "—";
  }

  let erRows = $derived.by(() => {
    void $equipmentVersion;
    if (!er_targets?.length) return [];
    return er_targets.map((t, idx) => {
      const ent = entityByNameId.get(t.name_id);
      return {
        key: `${idx}-${t.name_id}`,
        entity: ent ?? null,
        label: ent?.label ?? t.name_id,
        range: formatErRange(t),
        contextHtml: t.context
          ? renderResearchInline(t.context, entities, citations, renderOpts)
          : null,
        citeHtml: citeSups(t.citation_ids),
      };
    });
  });

  let rotationView = $derived.by(() => {
    void $equipmentVersion;
    if (!rotation?.steps?.length) return null;
    return {
      steps: rotation.steps.map((s) =>
        renderResearchInline(s, entities, citations, renderOpts),
      ),
      notesHtml: rotation.notes
        ? renderResearchInline(rotation.notes, entities, citations, renderOpts)
        : null,
      citeHtml: citeSups(rotation.citation_ids),
    };
  });

  /** Mount ResearchEntityMention onto slot markers left by renderResearchAnswer. */
  $effect(() => {
    if (view === "build") return;
    void html;
    void verdictHtml;
    void sides;
    void lineupCards;
    void weaponRankRows;
    void artifactRankRows;
    void erRows;
    void rotationView;
    void entityByKey;
    void $equipmentVersion;

    const root = answerRoot;
    if (!root) return;

    let cancelled = false;
    const stoppers: Array<() => void> = [];

    void tick().then(() => {
      if (cancelled || !answerRoot) return;
      const slots = answerRoot.querySelectorAll(`[${RESEARCH_ENTITY_SLOT_ATTR}]`);
      for (const el of slots) {
        if (!(el instanceof HTMLElement)) continue;
        const key = el.getAttribute(RESEARCH_ENTITY_SLOT_ATTR);
        if (!key) continue;
        const entity = entityByKey.get(key);
        if (!entity) continue;
        const instance = mount(ResearchEntityMention, {
          target: el,
          props: { entity },
        });
        if (cancelled) {
          void unmount(instance);
          continue;
        }
        stoppers.push(() => {
          void unmount(instance);
        });
      }
    });

    return () => {
      cancelled = true;
      for (const stop of stoppers) stop();
    };
  });
</script>

{#if view === "build"}
  <BuildPanel
    focus_name_id={focus_name_id}
    {markdown}
    {entities}
    {citations}
    {disagreements}
    weapon_ranks={weapon_ranks ?? []}
    artifact_ranks={artifact_ranks ?? []}
    artifact_options={artifact_options ?? []}
    {stat_priority}
    ownedGear={ownedGear ?? buildOwnedGear}
  />
{:else}
<div class="research-answer" bind:this={answerRoot}>
  {#if disagreements.length > 0}
    <aside class="research-disagreements" aria-label="Source disagreements">
      {#each disagreements as d, i (i)}
        <p class="research-disagreement">{d.summary}</p>
      {/each}
    </aside>
  {/if}

  <div class="research-body">
    {@html html}
  </div>

  {#if sides.length > 0}
    <section class="research-comparison" aria-label="Option comparison">
      {#if verdictHtml}
        <p class="research-comparison-verdict">{@html verdictHtml}</p>
      {/if}
      <div class="research-comparison-grid">
        {#each sides as side, i (side.key)}
          {#if i === 1}
            <div class="research-comparison-vs" aria-hidden="true">vs</div>
          {/if}
          <div class="research-comparison-side">
            <h3 class="research-comparison-label">{@html side.labelHtml}</h3>
            <p class="research-comparison-summary">{@html side.summaryHtml}</p>
            {#if side.bullets.length > 0}
              <ul class="research-comparison-bullets">
                {#each side.bullets as bullet, bi (bi)}
                  <li>{@html bullet}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/if}

  {#if lineupCards.length > 0}
    <section class="research-teams" aria-label="Recommended teams">
      {#each lineupCards as team (team.key)}
        <article class="research-team-card">
          <header class="research-team-header">
            <h3 class="research-team-label">{team.label}</h3>
            {#if team.citeHtml}
              <span class="research-team-cites">{@html team.citeHtml}</span>
            {/if}
          </header>
          {#if team.hasPortraits}
            <div class="research-team-hand">
              <TeamCardHand characters={team.hand} spread="flat" />
            </div>
          {:else}
            <div class="research-team-members">
              {#each team.members as m (m.id)}
                {#if m.entity}
                  <ResearchEntityMention entity={m.entity} />
                {:else}
                  <span class="research-team-member-plain">{m.label}</span>
                {/if}
              {/each}
            </div>
          {/if}
          {#if team.weaponEntity || team.weaponLabel || team.setEntity || team.setLabel}
            <div class="research-team-gear">
              {#if team.weaponEntity}
                <ResearchEntityMention entity={team.weaponEntity} />
              {:else if team.weaponLabel}
                <span class="research-team-gear-plain">{team.weaponLabel}</span>
              {/if}
              {#if team.setEntity}
                <ResearchEntityMention entity={team.setEntity} />
              {:else if team.setLabel}
                <span class="research-team-gear-plain">{team.setLabel}</span>
              {/if}
            </div>
          {/if}
          {#if team.notesHtml}
            <p class="research-team-notes">{@html team.notesHtml}</p>
          {/if}
        </article>
      {/each}
    </section>
  {/if}

  {#snippet rankRow(row: (typeof weaponRankRows)[number])}
    <li class="research-rank-row" class:is-top={row.rank === 1}>
      <span class="research-rank-num" aria-hidden="true">{row.rank}</span>
      <div class="research-rank-body">
        <div class="research-rank-head">
          {#if row.entity}
            <ResearchEntityMention entity={row.entity} />
          {:else}
            <span class="research-rank-label">{row.label}</span>
          {/if}
          {#if row.citeHtml}
            <span>{@html row.citeHtml}</span>
          {/if}
        </div>
        {#if row.noteHtml}
          <p class="research-rank-note">{@html row.noteHtml}</p>
        {/if}
      </div>
    </li>
  {/snippet}

  {#snippet rankSection(
    title: string,
    ariaLabel: string,
    rows: typeof weaponRankRows,
  )}
    {#if rows.length > 0}
      {@const top = rows[0]}
      {@const rest = rows.slice(1)}
      <section class="research-ranks" aria-label={ariaLabel}>
        <h3 class="research-ranks-title">{title}</h3>
        <ol class="research-rank-list">
          {@render rankRow(top)}
        </ol>
        {#if rest.length > 0}
          <details class="research-ranks-more">
            <summary>
              {rest.length} more {rest.length === 1 ? "option" : "options"}
            </summary>
            <ol class="research-rank-list research-rank-list-more" start={2}>
              {#each rest as row (row.key)}
                {@render rankRow(row)}
              {/each}
            </ol>
          </details>
        {/if}
      </section>
    {/if}
  {/snippet}

  {@render rankSection("Weapons", "Weapon ranking", weaponRankRows)}
  {@render rankSection("Artifacts", "Artifact ranking", artifactRankRows)}

  {#if erRows.length > 0}
    <section class="research-er" aria-label="Energy recharge targets">
      {#each erRows as row (row.key)}
        <article class="research-er-card">
          <div class="research-er-who">
            {#if row.entity}
              <ResearchEntityMention entity={row.entity} />
            {:else}
              <span class="research-er-label">{row.label}</span>
            {/if}
            {#if row.citeHtml}
              <span>{@html row.citeHtml}</span>
            {/if}
          </div>
          <p class="research-er-range">{row.range}</p>
          {#if row.contextHtml}
            <p class="research-er-context">{@html row.contextHtml}</p>
          {/if}
        </article>
      {/each}
    </section>
  {/if}

  {#if rotationView}
    <section class="research-rotation" aria-label="Rotation">
      <ol class="research-rotation-steps">
        {#each rotationView.steps as step, i (i)}
          <li>{@html step}</li>
        {/each}
      </ol>
      {#if rotationView.notesHtml}
        <p class="research-rotation-notes">{@html rotationView.notesHtml}</p>
      {/if}
      {#if rotationView.citeHtml}
        <span class="research-rotation-cites">{@html rotationView.citeHtml}</span>
      {/if}
    </section>
  {/if}

  {#if footnotes.length > 0}
    <ol class="research-footnotes">
      {#each footnotes as cite (cite.id)}
        {@const num = citeNum.get(cite.id) ?? 0}
        {@const href = safeExternalHref(cite.url)}
        <li id="{citeAnchorPrefix}research-cite-{cite.id}" class="research-footnote">
          <span class="research-footnote-num meta-sub" aria-hidden="true">{num}</span>
          <div class="research-footnote-body">
            {#if href}
              <a
                class="research-footnote-link"
                {href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {citationShortLabel(cite)}
              </a>
            {:else}
              <span class="research-footnote-link">{citationShortLabel(cite)}</span>
            {/if}
            <p class="research-footnote-quote meta-sub">{cite.quote}</p>
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>
{/if}

<style>
  .research-answer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .research-disagreements {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0.55rem 0.7rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, #e67e22 35%, var(--border-default));
    background: color-mix(in srgb, #e67e22 8%, transparent);
  }

  .research-disagreement {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-color);
  }

  .research-body :global(p:first-child) {
    font-size: 1.02em;
    line-height: 1.5;
    color: var(--foreground-color);
  }

  .research-body :global(p) {
    margin: 0 0 0.55rem;
    line-height: 1.55;
  }

  .research-body :global(p:last-child) {
    margin-bottom: 0;
  }

  .research-body :global(ul),
  .research-body :global(ol) {
    margin: 0 0 0.55rem;
    padding-left: 1.1rem;
    line-height: 1.5;
  }

  .research-body :global(li + li) {
    margin-top: 0.25rem;
  }

  .research-body :global(strong) {
    font-weight: 600;
  }

  .research-body :global(code) {
    font-size: 0.9em;
  }

  .research-body :global(h2),
  .research-body :global(h3) {
    margin: 0.85rem 0 0.35rem;
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.35;
    color: color-mix(in srgb, var(--foreground-color) 88%, transparent);
  }

  .research-body :global(h2:first-child),
  .research-body :global(h3:first-child) {
    margin-top: 0;
  }

  .research-comparison {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: 0.75rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--surface-quiet);
  }

  .research-comparison-verdict {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    line-height: 1.45;
    color: var(--foreground-color);
    padding-bottom: 0.55rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }

  .research-comparison-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: var(--space-3);
    align-items: start;
  }

  .research-comparison-vs {
    align-self: center;
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 42%, transparent);
    padding-top: 0.35rem;
  }

  .research-comparison-side {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .research-comparison-label {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 58%, transparent);
  }

  .research-comparison-summary {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--foreground-color);
  }

  .research-comparison-bullets {
    margin: 0.15rem 0 0;
    padding-left: 1rem;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .research-comparison-bullets li + li {
    margin-top: 0.2rem;
  }

  @media (max-width: 520px) {
    .research-comparison-grid {
      grid-template-columns: 1fr;
    }

    .research-comparison-vs {
      justify-self: center;
      padding: 0;
    }
  }

  .research-teams {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .research-team-card {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.75rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--surface-quiet);
  }

  .research-team-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .research-team-label {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--foreground-color);
  }

  .research-team-hand {
    width: 100%;
    overflow: hidden;
  }

  .research-team-hand :global(.hand) {
    --card-width: clamp(4.2rem, 16vw, 6.5rem);
  }

  .research-team-hand :global(.hand-flat) {
    min-height: calc(var(--card-width) * 4 / 3 + 0.5rem);
  }

  .research-team-members {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .research-team-member-plain,
  .research-team-gear-plain,
  .research-rank-label,
  .research-er-label {
    font-size: var(--text-sm);
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
  }

  .research-team-gear {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
  }

  .research-team-notes {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .research-ranks,
  .research-er,
  .research-rotation {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0.75rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--surface-quiet);
  }

  .research-ranks-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
  }

  .research-rank-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .research-rank-row {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
  }

  .research-rank-row.is-top .research-rank-num {
    color: var(--foreground-color);
  }

  .research-ranks-more {
    margin: 0.15rem 0 0;
  }

  .research-ranks-more summary {
    cursor: pointer;
    list-style: none;
    font-size: var(--text-xs);
    font-weight: 600;
    color: color-mix(in srgb, var(--foreground-color) 58%, transparent);
    padding: 0.2rem 0;
    user-select: none;
  }

  .research-ranks-more summary::-webkit-details-marker {
    display: none;
  }

  .research-ranks-more summary::before {
    content: "▸ ";
    display: inline-block;
    transition: transform 0.12s ease;
  }

  .research-ranks-more[open] summary::before {
    transform: rotate(90deg);
  }

  .research-ranks-more summary:hover {
    color: var(--foreground-color);
  }

  .research-rank-list-more {
    margin-top: 0.45rem;
  }

  .research-rank-num {
    flex-shrink: 0;
    min-width: 1.25rem;
    font-size: var(--text-sm);
    font-weight: 700;
    color: color-mix(in srgb, var(--foreground-color) 48%, transparent);
    padding-top: 0.2rem;
  }

  .research-rank-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .research-rank-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.35rem;
  }

  .research-rank-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .research-er-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .research-er-who {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.35rem;
  }

  .research-er-range {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--foreground-color);
  }

  .research-er-context {
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .research-rotation-steps {
    margin: 0;
    padding-left: 1.25rem;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--foreground-color);
  }

  .research-rotation-steps li + li {
    margin-top: 0.35rem;
  }

  .research-rotation-notes {
    margin: 0.35rem 0 0;
    font-size: var(--text-xs);
    line-height: 1.45;
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .research-body :global(.research-entity-slot),
  .research-comparison :global(.research-entity-slot),
  .research-teams :global(.research-entity-slot),
  .research-ranks :global(.research-entity-slot),
  .research-er :global(.research-entity-slot),
  .research-rotation :global(.research-entity-slot) {
    display: contents;
  }

  .research-body :global(.research-cite),
  .research-comparison :global(.research-cite),
  .research-teams :global(.research-cite),
  .research-ranks :global(.research-cite),
  .research-er :global(.research-cite),
  .research-rotation :global(.research-cite) {
    margin-left: 0.08rem;
    font-size: 0.65em;
    line-height: 0;
    vertical-align: super;
  }

  .research-body :global(.research-cite a),
  .research-comparison :global(.research-cite a),
  .research-teams :global(.research-cite a),
  .research-ranks :global(.research-cite a),
  .research-er :global(.research-cite a),
  .research-rotation :global(.research-cite a) {
    color: var(--foreground-mid);
    text-decoration: none;
    padding: 0 0.1rem;
    border-radius: 0.15rem;
    font-weight: 500;
  }

  .research-body :global(.research-cite a:hover),
  .research-comparison :global(.research-cite a:hover),
  .research-teams :global(.research-cite a:hover),
  .research-ranks :global(.research-cite a:hover),
  .research-er :global(.research-cite a:hover),
  .research-rotation :global(.research-cite a:hover) {
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    background: color-mix(in srgb, var(--foreground-color) 6%, transparent);
  }

  .research-footnotes {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-top: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    padding-top: var(--space-2);
  }

  .research-footnote {
    display: flex;
    gap: 0.55rem;
    align-items: flex-start;
    scroll-margin-top: 5rem;
  }

  .research-footnote:target {
    background: color-mix(in srgb, var(--foreground-color) 5%, transparent);
    border-radius: var(--radius-sm);
    margin: -0.15rem;
    padding: 0.15rem;
  }

  .research-footnote-num {
    flex-shrink: 0;
    min-width: 1.1rem;
    text-align: right;
    padding-top: 0.15rem;
  }

  .research-footnote-body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .research-footnote-link {
    font-size: var(--text-xs);
    font-weight: 500;
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    text-decoration: none;
  }

  .research-footnote-link:hover {
    color: var(--foreground-color);
    text-decoration: underline;
  }

  .research-footnote-quote {
    margin: 0;
    line-height: 1.45;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
