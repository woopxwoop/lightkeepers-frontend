<script lang="ts">
  import type { Character } from "$lib/definitions";
  import { elementColor } from "$lib/element-colors";
  import {
    collapseRotationEvents,
    DEFAULT_ROTATION_WINDOW_S,
    detectRotationWindow,
    formatRotationPlaintext,
    layoutFieldOccupancy,
    layoutRotationMarkers,
    loopBoundaryLeftPxs,
    markersForCharacter,
    rotationAxisBands,
    rotationHasSetupPrefix,
    rotationSegmentLabel,
    spansForCharacter,
  } from "$lib/rotation-timeline";
  import { resolveScriptSampleAlignment } from "$lib/rotation-script";
  import type { RotationSample } from "$lib/types/investment";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import SegmentedControl from "$lib/ui/components/SegmentedControl.svelte";

  let {
    sample,
    characterByKey,
    script = null,
  }: {
    sample: RotationSample;
    characterByKey: Map<string, Character>;
    script?: string | null;
  } = $props();

  type ViewMode = "timeline" | "text";
  const VIEW_OPTIONS = [
    { value: "timeline" as const, label: "Timeline" },
    { value: "text" as const, label: "Text" },
  ];

  let viewMode = $state<ViewMode>("timeline");
  let viewportWidthPx = $state(0);

  let scriptAlignment = $derived(
    resolveScriptSampleAlignment(sample.events, script, sample.characters),
  );
  let annotatedEvents = $derived(scriptAlignment.events);
  let rotationWindow = $derived(
    detectRotationWindow(annotatedEvents, DEFAULT_ROTATION_WINDOW_S, {
      ...(script?.trim()
        ? {
            script,
            characters: sample.characters,
            scriptMatch: scriptAlignment.loopMatch,
          }
        : {}),
    }),
  );
  let collapsed = $derived(collapseRotationEvents(annotatedEvents));
  let layout = $derived(
    layoutRotationMarkers(collapsed, sample.duration_s, {
      viewportWidthPx: viewportWidthPx > 0 ? viewportWidthPx : 640,
      fitThroughT: rotationWindow.endS,
    }),
  );
  let occupancy = $derived(
    layoutFieldOccupancy(layout.markers, layout.trackWidthPx),
  );
  let boundaryLeftPxs = $derived(
    loopBoundaryLeftPxs(layout.markers, rotationWindow.loopEndsS),
  );
  let laneKeys = $derived.by(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const key of sample.characters) {
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
    for (const event of annotatedEvents) {
      const key = event.char;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
    return keys;
  });
  let laneIndexByKey = $derived(
    new Map(laneKeys.map((key, i) => [key, i])),
  );
  let lanes = $derived(
    laneKeys.map((key) => ({
      key,
      character: characterByKey.get(key),
      markers: markersForCharacter(layout.markers, key).filter(
        (m) => m.event.action !== "swap",
      ),
      spans: spansForCharacter(occupancy.spans, key),
    })),
  );
  let handoffs = $derived(
    occupancy.handoffs.flatMap((h, i) => {
      const fromIndex = laneIndexByKey.get(h.fromChar);
      const toIndex = laneIndexByKey.get(h.toChar);
      if (fromIndex == null || toIndex == null) return [];
      const span = Math.abs(toIndex - fromIndex);
      if (span < 1) return [];
      return [
        {
          i,
          xPx: h.xPx,
          topIndex: Math.min(fromIndex, toIndex),
          span,
          accent: elementColor(
            characterByKey.get(h.fromChar)?.element,
            "var(--foreground-mid)",
          ),
        },
      ];
    }),
  );
  let plaintext = $derived(
    formatRotationPlaintext(collapsed, {
      resolveName: (key) => characterByKey.get(key)?.name ?? key,
      loopEndsS: rotationWindow.loopEndsS,
    }),
  );
  let hasSetup = $derived(
    rotationHasSetupPrefix(
      rotationWindow.loopEndS,
      rotationWindow.loopEndsS,
    ),
  );
  let axisBands = $derived(
    rotationAxisBands(boundaryLeftPxs, layout.trackWidthPx, hasSetup),
  );

  function cssLengthPx(value: string, fallbackPx: number): number {
    const trimmed = value.trim();
    if (!trimmed) return fallbackPx;
    if (trimmed.endsWith("px")) {
      const n = Number.parseFloat(trimmed);
      return Number.isFinite(n) ? n : fallbackPx;
    }
    if (trimmed.endsWith("rem")) {
      const n = Number.parseFloat(trimmed);
      const root = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      return Number.isFinite(n) && Number.isFinite(root) ? n * root : fallbackPx;
    }
    return fallbackPx;
  }

  const measureViewport = (node: HTMLDivElement) => {
    const apply = () => {
      const root = node.closest(".rotation");
      const style =
        root instanceof HTMLElement ? getComputedStyle(root) : null;
      const headW = style
        ? cssLengthPx(style.getPropertyValue("--lane-head-w"), 144)
        : 144;
      const scrollPad = style
        ? cssLengthPx(style.getPropertyValue("--lane-scroll-pad"), 8)
        : 8;
      const gridGap = style
        ? cssLengthPx(style.getPropertyValue("--lane-grid-gap"), 8)
        : 8;
      const w = Math.floor(
        node.clientWidth - scrollPad * 2 - headW - gridGap,
      );
      if (w > 0) viewportWidthPx = w;
    };
    const ro = new ResizeObserver(apply);
    ro.observe(node);
    apply();
    return () => ro.disconnect();
  };
</script>

<div class="rotation">
  <div class="rotation-toolbar">
    <SegmentedControl
      options={VIEW_OPTIONS}
      bind:value={viewMode}
      aria-label="Rotation view"
      class="view-toggle"
    />
  </div>

  {#if viewMode === "timeline"}
    <div class="lanes-panel">
      <div
        class="lanes-scroll"
        role="region"
        tabindex="0"
        aria-label="Rotation sample"
        {@attach measureViewport}
      >
        <div
          class="lane axis-lane"
          style:--track-w="{layout.trackWidthPx}px"
        >
          <div class="lane-head axis-head"></div>
          <div class="lane-track axis-track">
            {#each axisBands as band, i (`ax${i}:${band.label}:${band.leftPx}`)}
              <span
                class="axis-band"
                style:left="{band.leftPx}px"
                style:width="{band.widthPx}px"
              >
                {band.label}
              </span>
            {/each}
            {#each boundaryLeftPxs as x, bi (`axb${bi}:${x}`)}
              <span
                class="loop-boundary"
                style:left="{x}px"
                aria-hidden="true"
              ></span>
            {/each}
          </div>
        </div>
        <div
          class="char-lanes"
          style:--track-w="{layout.trackWidthPx}px"
        >
        {#each lanes as lane (lane.key)}
          {@const who = lane.character?.name ?? lane.key}
          {@const accent = elementColor(
            lane.character?.element,
            "var(--border-control-quiet)",
          )}
          <div
            class="lane"
            style:--lane-accent={accent}
            style:--track-w="{layout.trackWidthPx}px"
          >
            <div class="lane-head">
              {#if lane.character}
                <span class="lane-icon">
                  <CharacterIcon
                    character={lane.character}
                    zoom={0.85}
                    loading="lazy"
                  />
                </span>
              {/if}
              <span class="lane-name">{who}</span>
            </div>
            <div class="lane-track">
              {#each lane.spans as span, si (`fs${si}:${span.leftPx}`)}
                <span
                  class="field-line"
                  style:left="{span.leftPx}px"
                  style:width="{span.widthPx}px"
                  title="{who} on field"
                  aria-hidden="true"
                ></span>
              {/each}
              {#each boundaryLeftPxs as x, bi (`b${bi}:${x}`)}
                <span
                  class="loop-boundary"
                  style:left="{x}px"
                  title={rotationSegmentLabel(bi + 1, hasSetup)}
                  aria-hidden="true"
                ></span>
              {/each}
              {#each lane.markers as marker, i (`${i}:${marker.event.t}:${marker.event.action}:${marker.event.count}`)}
                <span
                  class="marker"
                  role="img"
                  class:marker-skill={
                    marker.event.action === "skill" ||
                    marker.event.action === "hold_skill"
                  }
                  class:marker-burst={marker.event.action === "burst"}
                  style:left="{marker.leftPx}px"
                  style:width="{marker.widthPx}px"
                  title="{who} {marker.label} · {marker.event.t.toFixed(1)}s"
                  aria-label="{who} {marker.label} · {marker.event.t.toFixed(1)}s"
                >
                  {marker.label}
                </span>
              {/each}
            </div>
          </div>
        {/each}
          {#if handoffs.length > 0}
            <div class="swap-links" aria-hidden="true">
              {#each handoffs as h (`sw${h.i}`)}
                <span
                  class="swap-link"
                  style:left="{h.xPx}px"
                  style:top="calc({h.topIndex + 0.5} * var(--lane-h))"
                  style:height="calc({h.span} * var(--lane-h))"
                  style:--swap-accent={h.accent}
                ></span>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="plaintext" aria-label="Rotation sample text (Test)">
      {#each plaintext as line, i (`t${i}`)}
        {#if i > 0}
          <hr class="rotation-split" />
        {/if}
        <p class="segment-label">{rotationSegmentLabel(i, hasSetup)}</p>
        <p class="plaintext-line">{line}</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .rotation {
    --lane-head-w: 9rem;
    --lane-grid-gap: 0.5rem;
    --lane-scroll-pad: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .rotation-toolbar {
    display: flex;
    justify-content: flex-end;
  }

  .rotation-toolbar :global(.view-toggle) {
    font-size: var(--text-xs);
  }

  .rotation-toolbar :global(.view-toggle .segment) {
    padding: 0.25rem 0.65rem;
    font-size: var(--text-xs);
  }

  .lanes-panel {
    border: var(--border-width) solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--surface-quiet);
    padding: var(--space-2) 0;
  }

  .lanes-scroll {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    padding: 0 var(--lane-scroll-pad);
  }

  .char-lanes {
    --lane-h: 3.1rem;
    position: relative;
    width: max-content;
    min-width: 100%;
  }

  .lane {
    display: grid;
    grid-template-columns: var(--lane-head-w) var(--track-w, max-content);
    gap: var(--lane-grid-gap);
    align-items: center;
    min-height: 2.5rem;
    padding: 0.3rem 0;
    width: max-content;
    min-width: 100%;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 10%, transparent);
  }

  .char-lanes > .lane {
    position: relative;
    z-index: 1;
    height: var(--lane-h);
    min-height: var(--lane-h);
    padding: 0;
    box-sizing: border-box;
  }

  .char-lanes > .lane:last-of-type {
    border-bottom: none;
  }

  .axis-lane {
    min-height: 1.15rem;
    padding-top: 0;
    padding-bottom: 0.15rem;
    border-bottom: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 16%, transparent);
  }

  .axis-head {
    min-height: 1.15rem;
  }

  .axis-track {
    height: 1.15rem;
    border-left-color: transparent;
    background: none;
  }

  .axis-band {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 0 0.25rem;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    white-space: nowrap;
    pointer-events: none;
  }

  .lane-head {
    position: sticky;
    left: 0;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    margin-left: calc(-1 * var(--lane-scroll-pad));
    padding-left: var(--lane-scroll-pad);
    padding-right: 0.35rem;
    background: linear-gradient(
      to right,
      var(--surface-quiet) 75%,
      color-mix(in srgb, var(--surface-quiet) 0%, transparent)
    );
  }

  .lane-icon {
    width: 2rem;
    height: 2rem;
    overflow: hidden;
    border-radius: 0.2rem;
    flex-shrink: 0;
    background: var(--background-mid);
  }

  .lane-name {
    font-size: var(--text-sm);
    color: var(--foreground-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lane-track {
    position: relative;
    height: 2.15rem;
    width: var(--track-w);
    min-width: var(--track-w);
    border-left: 2px solid var(--lane-accent, var(--border-control-quiet));
    background: linear-gradient(
      to bottom,
      transparent 46%,
      color-mix(in srgb, var(--foreground-color) 12%, transparent) 46%,
      color-mix(in srgb, var(--foreground-color) 12%, transparent) 54%,
      transparent 54%
    );
  }

  .field-line {
    position: absolute;
    top: 50%;
    z-index: 0;
    height: 3px;
    transform: translateY(-50%);
    border-radius: 1px;
    background: var(--lane-accent, var(--foreground-color));
    pointer-events: none;
  }

  .swap-links {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(var(--lane-head-w) + var(--lane-grid-gap));
    z-index: 0;
    width: var(--track-w);
    overflow: visible;
    pointer-events: none;
  }

  .swap-link {
    position: absolute;
    width: 0;
    border-left: 2px dotted var(--swap-accent, var(--foreground-mid));
    transform: translateX(-1px);
  }

  .loop-boundary {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 2;
    width: 0;
    border-left: 1px dashed
      color-mix(in srgb, var(--foreground-color) 45%, transparent);
    pointer-events: none;
    transform: translateX(-0.5px);
  }

  .marker {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    box-sizing: border-box;
    padding: 0.2rem 0.25rem;
    border: var(--border-width) solid var(--border-control-quiet);
    border-radius: var(--radius-sm);
    background: var(--background-mid);
    color: var(--foreground-color);
    font-size: 0.75rem;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
  }

  .marker-skill {
    border-color: var(--accent-1);
  }

  .marker-burst {
    border-color: var(--accent-1);
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--accent-1) 18%, var(--background-mid));
  }

  .plaintext {
    margin: 0;
    max-height: 28rem;
    overflow: auto;
    padding: var(--space-3);
    border: var(--border-width) solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--surface-quiet);
    color: var(--foreground-mid);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  .plaintext-line {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .segment-label {
    margin: 0 0 0.2rem;
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .rotation-split {
    margin: 0.65rem 0;
    border: none;
    border-top: 1px solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
  }

  @media (max-width: 640px) {
    .rotation {
      --lane-head-w: 7rem;
      --lane-grid-gap: 0.25rem;
    }
  }
</style>
