<script lang="ts">
  import type { ResearchTrace } from "$lib/research-types";

  let { trace }: { trace: ResearchTrace } = $props();

  const phaseLabel: Record<ResearchTrace["steps"][number]["phase"], string> = {
    intent: "Intent",
    retrieve: "Retrieval",
    static: "Context",
    synthesize: "Answer",
    refuse: "Refused",
  };
</script>

<details class="research-trace">
  <summary>Research steps</summary>
  <ol class="trace-steps">
    {#each trace.steps as step, i (i)}
      <li>
        <span class="trace-phase">{phaseLabel[step.phase]}</span>
        <span class="trace-summary">{step.summary}</span>
      </li>
    {/each}
  </ol>
  {#if (trace.retrieved_preview ?? []).length > 0}
    <ul class="trace-preview">
      {#each trace.retrieved_preview ?? [] as hit, i (i)}
        <li>
          <span class="trace-hit-publisher">{hit.publisher}</span>
          <span class="trace-hit-meta">{hit.chunk_kind} · {hit.source_tier}</span>
          {#if hit.heading_path}
            <span class="trace-hit-heading">{hit.heading_path}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</details>

<style>
  .research-trace {
    margin-top: var(--space-2);
    font-size: var(--text-sm);
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
  }

  .research-trace summary {
    cursor: pointer;
    user-select: none;
  }

  .research-trace summary:hover {
    color: var(--foreground-color);
  }

  .trace-steps {
    margin: var(--space-2) 0 0;
    padding-left: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .trace-phase {
    display: inline-block;
    min-width: 4.5rem;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
  }

  .trace-summary {
    line-height: 1.45;
  }

  .trace-preview {
    margin: var(--space-2) 0 0;
    padding-left: 1.1rem;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .trace-hit-publisher {
    font-weight: 600;
    margin-right: 0.35rem;
  }

  .trace-hit-meta {
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--foreground-color) 60%, transparent);
  }

  .trace-hit-heading {
    display: block;
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
  }
</style>
