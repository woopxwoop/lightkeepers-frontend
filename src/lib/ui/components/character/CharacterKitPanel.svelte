<script lang="ts">
  import { onMount, tick } from "svelte";
  import GameText from "$lib/ui/components/GameText.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import { elementColor } from "$lib/element-colors";
  import {
    availableTravelerElements,
    defaultTravelerElement,
  } from "$lib/traveler-kits";
  import { enhanceExtra, type EnhanceExtra } from "$lib/character-kit-text";
  import { getUiAssetUrl } from "$lib/utils";
  import { skillIconUrl, talentIconUrl } from "$lib/asset-urls";
  import type { CharacterKit } from "$lib/types/character-kit";

  let {
    kit,
    travelerKits,
    onNeedSkillsTab,
    skillsElement = $bindable(""),
  }: {
    kit: CharacterKit;
    travelerKits: Record<string, CharacterKit>;
    onNeedSkillsTab: () => void;
    skillsElement?: string;
  } = $props();

  const SKILL_LABELS: Record<string, string> = {
    normal: "Normal Attack",
    skill: "Elemental Skill",
    burst: "Elemental Burst",
  };

  type KitIndexEntry = {
    id: string;
    label: string;
    group: "Talents" | "Passives" | "Constellations";
  };

  /** Kit card currently flashing after an in-page talent link click. */
  let flashId = $state<string | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  /** Section highlighted in the side index while scrolling. */
  let activeIndexId = $state<string | null>(null);
  let kitMainEl: HTMLElement | null = $state(null);

  let travelerSkillElements = $derived(availableTravelerElements(travelerKits));
  let travelerSkillOptions = $derived(
    travelerSkillElements.map((element) => ({
      value: element,
      label: element,
    })),
  );

  /** Explicit pick when it still resolves, else the kit's own default. */
  let effectiveElement = $derived.by(() => {
    if (!kit.is_traveler) return "";
    if (skillsElement && travelerKits[skillsElement]) return skillsElement;
    return defaultTravelerElement(travelerKits, kit.element);
  });

  let skillsKit = $derived.by(() => {
    if (!kit.is_traveler) return kit;
    return travelerKits[effectiveElement] ?? kit;
  });
  let skillsElColor = $derived(
    elementColor(skillsKit.element, "var(--foreground-color)"),
  );

  function passiveUnlockLabel(unlock: number): string {
    if (unlock <= 0) return "Utility";
    return `Ascension ${unlock}`;
  }

  function passiveKindLabel(
    passive: (typeof skillsKit.passives)[number],
  ): string {
    if (passive.kind === "hexerei") return "Hexerei";
    if (passive.kind === "polestar") return "Polestar Field";
    return passiveUnlockLabel(passive.unlock);
  }

  let kitIndex = $derived.by((): KitIndexEntry[] => {
    const entries: KitIndexEntry[] = [];
    for (const skill of skillsKit.skills) {
      entries.push({
        id: `kit-S${skill.id}`,
        label: SKILL_LABELS[skill.type] ?? skill.type,
        group: "Talents",
      });
    }
    for (const passive of skillsKit.passives) {
      entries.push({
        id: `kit-P${passive.id}`,
        label: passiveKindLabel(passive),
        group: "Passives",
      });
    }
    for (const c of skillsKit.constellations) {
      entries.push({
        id: `kit-T${c.id}`,
        label: `Constellation ${c.index}`,
        group: "Constellations",
      });
    }
    return entries;
  });

  let kitIndexGroups = $derived.by(() => {
    const groups: {
      group: KitIndexEntry["group"];
      entries: KitIndexEntry[];
    }[] = [];
    for (const entry of kitIndex) {
      const last = groups.at(-1);
      if (last?.group === entry.group) last.entries.push(entry);
      else groups.push({ group: entry.group, entries: [entry] });
    }
    return groups;
  });

  async function flashKitTarget(hash: string) {
    if (!hash.startsWith("#kit-")) return;
    onNeedSkillsTab();
    const id = hash.slice(1);
    activeIndexId = id;
    // Clear first so re-clicking the same link restarts the animation.
    flashId = null;
    await tick();
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    requestAnimationFrame(() => {
      flashId = id;
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        if (flashId === id) flashId = null;
      }, 1800);
    });
  }

  function jumpToKit(id: string) {
    const hash = `#${id}`;
    if (window.location.hash !== hash) {
      history.pushState(null, "", hash);
    }
    void flashKitTarget(hash);
  }

  onMount(() => {
    flashKitTarget(window.location.hash);

    const onHash = () => flashKitTarget(window.location.hash);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.(
        "a.game-link",
      ) as HTMLAnchorElement | null;
      const href = a?.getAttribute("href");
      if (href?.startsWith("#kit-")) {
        queueMicrotask(() => flashKitTarget(href));
      }
    };

    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
      if (flashTimer) clearTimeout(flashTimer);
    };
  });

  // Highlight the index entry for whichever kit row is nearest the top.
  $effect(() => {
    const root = kitMainEl;
    const ids = kitIndex.map((entry) => entry.id);
    if (!root || ids.length === 0) return;

    let cancelled = false;
    let observer: IntersectionObserver | null = null;

    void tick().then(() => {
      if (cancelled) return;
      const nodes = ids
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el != null);
      if (nodes.length === 0) return;

      const visible = new Map<string, IntersectionObserverEntry>();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.set(entry.target.id, entry);
            else visible.delete(entry.target.id);
          }
          let bestId: string | null = null;
          let bestTop = Number.POSITIVE_INFINITY;
          for (const id of ids) {
            const hit = visible.get(id);
            if (!hit) continue;
            const top = hit.boundingClientRect.top;
            if (top < bestTop) {
              bestTop = top;
              bestId = id;
            }
          }
          if (bestId) activeIndexId = bestId;
        },
        {
          rootMargin: "-20% 0px -55% 0px",
          threshold: [0, 0.25, 0.5, 1],
        },
      );

      for (const node of nodes) observer.observe(node);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  });

  function iconUrl(icon: string, kind: "skill" | "talent"): string | null {
    return kind === "skill" ? skillIconUrl(icon) : talentIconUrl(icon);
  }

  /** In-page targets for `{LINK#S…}` / `P…` / `T…` (skills / passives / consts). */
  let kitLinkIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const s of skillsKit.skills) ids.add(`S${s.id}`);
    for (const p of skillsKit.passives) ids.add(`P${p.id}`);
    for (const c of skillsKit.constellations) ids.add(`T${c.id}`);
    return ids;
  });

  function resolveKitLink(ref: string): string | null {
    return kitLinkIds.has(ref) ? `#kit-${ref}` : null;
  }
</script>

{#snippet descriptionBlock(base: string, enhance: EnhanceExtra | null)}
  {#if enhance?.mode === "replace"}
    <GameText
      text={enhance.text}
      class="text-xs"
      resolveLink={resolveKitLink}
    />
  {:else}
    <GameText text={base} class="text-xs" resolveLink={resolveKitLink} />
    {#if enhance}
      <GameText
        text={enhance.text}
        class="text-xs mt-1.5"
        resolveLink={resolveKitLink}
      />
    {/if}
  {/if}
{/snippet}

<div
  role="tabpanel"
  id="tabpanel-skills"
  aria-labelledby="tab-skills"
  tabindex="0"
  class="kit-panel"
  style="--kit-flash: {skillsElColor};"
>
  <div class="kit-main" bind:this={kitMainEl}>
    {#if kit.is_traveler && travelerSkillOptions.length > 0}
      <section class="board-section">
        <div class="skills-head">
          <div class="skills-label">
            <span class="skills-label-text" id="skills-element-label"
              >Element:</span
            >
            <Select
              id="skills-element-trigger"
              options={travelerSkillOptions}
              bind:value={
                () => effectiveElement, (next) => (skillsElement = next)
              }
              bare
              aria-labelledby="skills-element-label skills-element-trigger"
            />
          </div>
        </div>
      </section>
    {/if}
    <section class="board-section">
      <h2 class="section-title">Talents</h2>
      <div class="kit-list">
        {#each skillsKit.skills as skill (skill.id)}
          {@const icon =
            iconUrl(skill.icon, "skill") ?? getUiAssetUrl(skill.icon)}
          {@const skillEnhance = enhanceExtra(
            skill.description,
            skill.enhanceDescription,
          )}
          <article
            id="kit-S{skill.id}"
            class="kit-row"
            class:kit-row-flash={flashId === `kit-S${skill.id}`}
          >
            {#if icon}
              <img src={icon} alt="" class="kit-icon shrink-0" loading="lazy" />
            {/if}
            <div class="kit-copy">
              <div class="kit-heading">
                <h3 class="card-title">{skill.name}</h3>
                <span class="card-kicker">
                  {SKILL_LABELS[skill.type] ?? skill.type}
                </span>
              </div>
              {@render descriptionBlock(skill.description, skillEnhance)}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="board-section">
      <h2 class="section-title">Passives</h2>
      <div class="kit-list">
        {#each skillsKit.passives as passive (passive.id)}
          {@const icon =
            iconUrl(passive.icon, "talent") ?? getUiAssetUrl(passive.icon)}
          {@const passiveEnhance = enhanceExtra(
            passive.description,
            passive.enhanceDescription,
          )}
          <article
            id="kit-P{passive.id}"
            class="kit-row"
            class:kit-row-flash={flashId === `kit-P${passive.id}`}
          >
            {#if icon}
              <img src={icon} alt="" class="kit-icon shrink-0" loading="lazy" />
            {/if}
            <div class="kit-copy">
              <div class="kit-heading">
                <h3 class="card-title">{passive.name}</h3>
                <span class="card-kicker">{passiveKindLabel(passive)}</span>
              </div>
              {@render descriptionBlock(passive.description, passiveEnhance)}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="board-section">
      <h2 class="section-title">Constellations</h2>
      <div class="kit-list">
        {#each skillsKit.constellations as c (c.id)}
          {@const icon = iconUrl(c.icon, "talent") ?? getUiAssetUrl(c.icon)}
          {@const constEnhance = enhanceExtra(
            c.description,
            c.enhanceDescription,
          )}
          <article
            id="kit-T{c.id}"
            class="kit-row"
            class:kit-row-flash={flashId === `kit-T${c.id}`}
          >
            {#if icon}
              <img src={icon} alt="" class="kit-icon shrink-0" loading="lazy" />
            {/if}
            <div class="kit-copy">
              <div class="kit-heading">
                <span class="const-index" style="color: {skillsElColor};">
                  C{c.index}
                </span>
                <h3 class="card-title">{c.name}</h3>
              </div>
              {@render descriptionBlock(c.description, constEnhance)}
            </div>
          </article>
        {/each}
      </div>
    </section>
  </div>

  {#if kitIndex.length > 0}
    <nav class="kit-index" aria-label="Jump to kit section">
      {#each kitIndexGroups as { group, entries } (group)}
        <div class="kit-index-group">
          <span class="kit-index-heading">{group}</span>
          {#each entries as entry (entry.id)}
            <button
              type="button"
              class="kit-index-link"
              class:active={activeIndexId === entry.id}
              aria-current={activeIndexId === entry.id ? "location" : undefined}
              onclick={() => jumpToKit(entry.id)}
            >
              {entry.label}
            </button>
          {/each}
        </div>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .kit-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .kit-main {
    min-width: 0;
  }

  .kit-index {
    order: -1;
    position: sticky;
    top: 4rem;
    z-index: 5;
    display: flex;
    gap: 0.75rem;
    padding: 0.65rem var(--space-4);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    border-bottom: var(--border-width) solid rgba(255, 255, 255, 0.1);
    scrollbar-width: thin;
    scrollbar-color: color-mix(
        in srgb,
        var(--foreground-color) 22%,
        transparent
      )
      transparent;
    background: color-mix(in srgb, var(--background-mid) 92%, transparent);
  }

  .kit-index::-webkit-scrollbar {
    width: 0.55rem;
    height: 0.55rem;
  }

  .kit-index::-webkit-scrollbar-track {
    background: transparent;
  }

  .kit-index::-webkit-scrollbar-thumb {
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .kit-index::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--foreground-color) 36%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .kit-index-group {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.35rem;
  }

  .kit-index-heading {
    display: none;
  }

  .kit-index-link {
    flex-shrink: 0;
    padding: 0.3rem 0.55rem;
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    border-radius: var(--radius-sm);
    color: var(--foreground-mid);
    font-family: var(--font-display);
    font-size: 0.65rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    white-space: nowrap;
    transition: var(--control-transition);
  }

  .kit-index-link:hover {
    color: var(--foreground-color);
    border-color: rgba(255, 255, 255, 0.28);
  }

  .kit-index-link.active {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--kit-flash) 55%, transparent);
    background: color-mix(in srgb, var(--kit-flash) 12%, transparent);
  }

  .kit-index-link:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .section-title {
    margin-bottom: var(--space-3);
  }

  .board-section {
    padding: var(--space-4);
  }

  .card-title {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--foreground-color);
  }

  .card-kicker,
  .const-index {
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .const-index {
    font-weight: 600;
  }

  .skills-head {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .skills-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
  }

  .skills-label-text {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-weight: 500;
    letter-spacing: var(--tracking-eyebrow);
    text-transform: uppercase;
    color: var(--foreground-mid);
  }

  .kit-list {
    display: flex;
    flex-direction: column;
  }

  .kit-row {
    display: flex;
    gap: 0.75rem;
    padding: 0.85rem 0;
    /* Nav + sticky mobile index chips. */
    scroll-margin-top: 7.5rem;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .kit-row + .kit-row {
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.1);
  }

  .kit-copy {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .kit-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
  }

  .kit-icon {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--background-color) 70%, transparent);
  }

  .kit-row-flash {
    margin-inline: calc(-1 * var(--space-4));
    padding-inline: var(--space-4);
    background: color-mix(in srgb, var(--kit-flash) 12%, transparent);
    box-shadow: inset 2px 0 0
      color-mix(in srgb, var(--kit-flash) 65%, transparent);
    animation: kit-target-flash 1.6s ease-out;
  }

  @keyframes kit-target-flash {
    0% {
      box-shadow: inset 2px 0 0
        color-mix(in srgb, var(--kit-flash) 0%, transparent);
    }
    35% {
      box-shadow: inset 3px 0 0
        color-mix(in srgb, var(--kit-flash) 80%, transparent);
    }
    100% {
      box-shadow: inset 2px 0 0
        color-mix(in srgb, var(--kit-flash) 65%, transparent);
    }
  }

  /* Side rail once the board has room beside the kit copy. */
  @media (min-width: 960px) {
    .kit-panel {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(9.5rem, 11.5rem);
      align-items: start;
    }

    .kit-index {
      order: 0;
      position: sticky;
      top: 5rem;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      max-height: calc(100vh - 6rem);
      padding: var(--space-4) var(--space-3);
      overflow-x: visible;
      overflow-y: auto;
      border-bottom: 0;
      border-left: var(--border-width) solid rgba(255, 255, 255, 0.14);
      background: transparent;
    }

    .kit-index-group {
      flex-direction: column;
      align-items: stretch;
      gap: 0.1rem;
    }

    .kit-index-heading {
      display: block;
      margin-bottom: 0.2rem;
      padding-inline: 0.55rem;
      color: color-mix(in srgb, var(--foreground-color) 42%, transparent);
      font-family: var(--font-display);
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .kit-index-link {
      position: relative;
      width: 100%;
      padding: 0.4rem 0.55rem;
      border: 0;
      border-radius: 0;
      color: var(--foreground-mid);
      text-align: left;
      letter-spacing: 0.03em;
      white-space: normal;
    }

    .kit-index-link::before {
      position: absolute;
      inset-block: 0.15rem;
      left: 0;
      width: 2px;
      background: transparent;
      content: "";
    }

    .kit-index-link:hover {
      color: var(--foreground-color);
      background: var(--surface-quiet);
    }

    .kit-index-link.active {
      color: var(--foreground-color);
      background: var(--surface-selected);
      border-color: transparent;
    }

    .kit-index-link.active::before {
      background: var(--kit-flash);
    }

    .kit-row {
      scroll-margin-top: 5.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .kit-row-flash {
      animation: none;
    }
  }
</style>
