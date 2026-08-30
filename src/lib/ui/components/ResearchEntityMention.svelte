<script lang="ts">
  /**
   * Quiet inline research entity (icon + label) with Builds-style tooltips.
   * Native button trigger so HoverTooltip is keyboard-focusable (Enter/Space);
   * character deep-links live inside the tip.
   */
  import {
    entityHref,
    entityIconUrl,
  } from "$lib/research-answer";
  import type { ResearchEntity } from "$lib/research-types";
  import ArtifactTooltip from "$lib/ui/components/ArtifactTooltip.svelte";
  import HoverTooltip from "$lib/ui/components/HoverTooltip.svelte";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";

  let { entity }: { entity: ResearchEntity } = $props();

  let icon = $derived(entityIconUrl(entity));
  let href = $derived(entityHref(entity));
  let description = $derived(entity.description?.trim() || "");

  let useWeaponTip = $derived(
    entity.type === "weapon" && Boolean(entity.weapon_key),
  );
  let useArtifactTip = $derived(
    entity.type === "artifact_set" && Boolean(entity.set_key),
  );
</script>

<button
  type="button"
  class="research-entity group relative research-entity-{entity.type}"
>
  {#if icon}
    <img
      class="research-entity-icon"
      src={icon}
      alt=""
      loading="lazy"
      decoding="async"
    />
  {/if}
  <span class="meta-name research-entity-label">{entity.label}</span>

  {#if useWeaponTip}
    <WeaponTooltip weaponKey={entity.weapon_key!} />
  {:else if useArtifactTip}
    <ArtifactTooltip setKey={entity.set_key!} />
  {:else}
    <HoverTooltip class="max-w-64" label={entity.label}>
      <div class="tip-detail-text font-medium">{entity.label}</div>
      {#if description}
        <div class="tip-detail-text tip-detail-text--small mt-1 opacity-85">
          {description}
        </div>
      {/if}
      {#if href}
        <a
          class="tip-detail-text tip-detail-text--small mt-1.5 research-entity-page-link"
          {href}
        >
          View on character page
        </a>
      {/if}
    </HoverTooltip>
  {/if}
</button>

<style>
  .research-entity {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    max-width: min(100%, 11rem);
    margin: 0 0.08em;
    padding: 0;
    vertical-align: text-bottom;
    cursor: pointer;
    font: inherit;
    color: var(--foreground-color);
    line-height: 1.2;
    white-space: nowrap;
    background: transparent;
    border: 0;
  }

  .research-entity:hover .research-entity-label,
  .research-entity:focus-visible .research-entity-label {
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  .research-entity:focus-visible {
    outline: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 35%, transparent);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }

  .research-entity-icon {
    width: 1.15rem;
    height: 1.15rem;
    object-fit: contain;
    flex-shrink: 0;
    border-radius: 0.2rem;
  }

  .research-entity-label {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.85em;
    font-weight: 500;
  }

  .research-entity-page-link {
    display: inline-block;
    color: color-mix(in srgb, var(--background-color) 88%, transparent);
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  .research-entity-page-link:hover {
    color: var(--background-color);
  }
</style>
