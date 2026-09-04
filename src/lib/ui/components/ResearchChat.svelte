<script lang="ts">
  /**
   * Structured research ask — Focus + topic chip + Run (no freeform prompt).
   * Build-only for now; other topics shown disabled as Soon.
   */
  import { tick } from "svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import {
    postResearchBuild,
    fetchResearchProxyHealth,
    type ResearchProxyHealth,
  } from "$lib/app/research";
  import type { ResearchLlmProvider, ResearchResponse } from "$lib/research-types";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import CharacterSearchSelect from "$lib/ui/components/CharacterSearchSelect.svelte";
  import ResearchAnswer from "$lib/ui/components/ResearchAnswer.svelte";
  import ResearchTrace from "$lib/ui/components/ResearchTrace.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import type { SelectOption } from "$lib/ui/components/Select.svelte";
  import type { Character } from "$lib/definitions";

  type ResearchTopicChip = "build" | "teams" | "rotation" | "er" | "worth_it";

  const TOPIC_CHIPS: {
    id: ResearchTopicChip;
    label: string;
    enabled: boolean;
  }[] = [
    { id: "build", label: "Build", enabled: true },
    { id: "teams", label: "Teams", enabled: false },
    { id: "rotation", label: "Rotation", enabled: false },
    { id: "er", label: "ER", enabled: false },
    { id: "worth_it", label: "Worth-it", enabled: false },
  ];

  let {
    chrome = "page",
  }: {
    /** Full page shell + Dev breadcrumb, or fill a parent sheet. */
    chrome?: "page" | "plain";
  } = $props();

  const providerOptions: SelectOption<ResearchLlmProvider>[] = [
    { value: "gemini", label: "Gemini" },
    { value: "deepseek", label: "DeepSeek" },
  ];

  let focusNameId = $state("");
  let topic = $state<ResearchTopicChip>("build");
  let llmProvider = $state<ResearchLlmProvider>("gemini");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let response = $state<ResearchResponse | null>(null);
  let proxyHealth = $state<ResearchProxyHealth | null>(null);
  let healthRefreshing = $state(false);
  let resultEl: HTMLDivElement | null = $state(null);

  async function refreshHealth() {
    healthRefreshing = true;
    try {
      const h = await fetchResearchProxyHealth();
      proxyHealth = h;
      if (h.agent.defaultLlmProvider) {
        llmProvider = h.agent.defaultLlmProvider;
      }
    } catch (err: unknown) {
      proxyHealth = {
        configured: false,
        agentUrl: null,
        agent: {
          ok: false,
          error: err instanceof Error ? err.message : "Health check failed",
        },
      };
    } finally {
      healthRefreshing = false;
    }
  }

  $effect(() => {
    void refreshHealth();
  });

  let characterOptions = $derived<SelectOption[]>(
    (page.data.characters as Character[]).map((c) => ({
      value: c.name_id,
      label: c.name ?? c.name_id,
    })),
  );

  function getCharacter(nameId: string) {
    return page.data.mapping.get(nameId);
  }

  let focusLabel = $derived.by(() => {
    if (!focusNameId) return null;
    const c = getCharacter(focusNameId);
    return c?.name ?? focusNameId;
  });

  let agentOk = $derived(proxyHealth?.agent.ok === true);

  let providerReady = $derived.by(() => {
    if (!agentOk || !proxyHealth) return false;
    if (
      llmProvider === "deepseek" &&
      proxyHealth.agent.deepseekConfigured === false
    ) {
      return false;
    }
    if (
      llmProvider === "gemini" &&
      proxyHealth.agent.geminiConfigured === false
    ) {
      return false;
    }
    return true;
  });

  let canRun = $derived(
    providerReady && !loading && Boolean(focusNameId) && topic === "build",
  );

  let healthLabel = $derived.by(() => {
    if (!proxyHealth) return "Checking agent…";
    if (!proxyHealth.configured) return "Env not configured";
    if (proxyHealth.agent.ok) {
      const providerLabel = llmProvider === "deepseek" ? "DeepSeek" : "Gemini";
      if (
        llmProvider === "deepseek" &&
        proxyHealth.agent.deepseekConfigured === false
      ) {
        return `Agent up · ${providerLabel} key missing`;
      }
      if (
        llmProvider === "gemini" &&
        proxyHealth.agent.geminiConfigured === false
      ) {
        return `Agent up · ${providerLabel} key missing`;
      }
      return `Agent connected · ${providerLabel}`;
    }
    return proxyHealth.agent.error ?? "Agent unreachable";
  });

  async function runAsk() {
    if (!canRun || !focusNameId) return;
    loading = true;
    error = null;
    response = null;
    try {
      const res = await postResearchBuild(focusNameId, {
        llm_provider: llmProvider,
      });
      response = res;
      await tick();
      resultEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      error = err instanceof Error ? err.message : "Request failed";
    } finally {
      loading = false;
    }
  }

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    void runAsk();
  }

  function selectTopic(id: ResearchTopicChip, enabled: boolean) {
    if (!enabled || loading) return;
    topic = id;
  }

  let isBuildView = $derived(response?.view === "build");
</script>

{#snippet healthPill()}
  <p
    class="health-pill"
    class:health-ok={agentOk}
    class:health-bad={proxyHealth !== null && !agentOk}
    title={proxyHealth?.agentUrl ?? undefined}
  >
    <span class="health-dot" aria-hidden="true"></span>
    {healthLabel}
    {#if proxyHealth !== null && !agentOk}
      <button
        type="button"
        class="health-retry"
        disabled={healthRefreshing}
        onclick={() => void refreshHealth()}
      >
        {healthRefreshing ? "Retrying…" : "Retry"}
      </button>
    {/if}
  </p>
{/snippet}

{#snippet askBody()}
  <div class="ask-body">
    <form class="ask-form" onsubmit={onSubmit}>
      <div class="ask-lede">
        <h2 class="section-title">Research</h2>
        <p class="section-lede">
          Pick a character and a topic. Build returns ranked weapons, artifacts,
          and stats — no freeform prompt.
        </p>
      </div>

      <div class="ask-controls">
        <div class="ask-field ask-focus">
          <span class="focus-label">Focus</span>
          <CharacterSearchSelect
            bind:value={focusNameId}
            options={characterOptions}
            getCharacter={getCharacter}
            placeholder="Select character"
            aria-label="Focus character"
            class="focus-select"
          />
        </div>
        <div class="ask-field">
          <span class="focus-label">Model</span>
          <Select
            bind:value={llmProvider}
            options={providerOptions}
            fit="value"
            aria-label="LLM provider"
            class="provider-select"
          />
        </div>
      </div>

      <div class="ask-topics" role="group" aria-label="Research topic">
        <span class="focus-label">Topic</span>
        <div class="topic-chips">
          {#each TOPIC_CHIPS as chip (chip.id)}
            <button
              type="button"
              class="topic-chip"
              class:is-selected={topic === chip.id}
              class:is-soon={!chip.enabled}
              disabled={!chip.enabled || loading}
              aria-pressed={topic === chip.id}
              onclick={() => selectTopic(chip.id, chip.enabled)}
            >
              {chip.label}
              {#if !chip.enabled}
                <span class="topic-soon">Soon</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <div class="ask-actions">
        <Button type="submit" variant="primary" disabled={!canRun}>
          {#if loading}
            Running…
          {:else}
            Run
          {/if}
        </Button>
        {#if !focusNameId}
          <p class="ask-hint meta-sub">Select a focus character to run Build.</p>
        {:else if !providerReady}
          <p class="ask-hint meta-sub">Agent must be connected before Run.</p>
        {/if}
      </div>
    </form>

    <div class="ask-result" bind:this={resultEl} aria-live="polite">
      {#if loading}
        <div class="ask-state" aria-busy="true" aria-label="Researching">
          <span class="thinking-dot"></span>
          <span class="thinking-dot"></span>
          <span class="thinking-dot"></span>
        </div>
      {:else if error}
        <div class="ask-state ask-error" role="alert">
          <p class="section-title">Couldn’t load research</p>
          <p class="section-lede">{error}</p>
          <Button variant="secondary" onclick={() => void runAsk()}>Retry</Button>
        </div>
      {:else if response && isBuildView}
        <div class="ask-result-meta">
          <span class="meta-sub">Build</span>
          {#if focusLabel}
            <span class="page-meta-sep" aria-hidden="true">·</span>
            <span class="meta-sub">{focusLabel}</span>
          {/if}
          <span class="page-meta-sep" aria-hidden="true">·</span>
          <span class="confidence confidence-{response.confidence}">
            {response.confidence}
            {#if response.thin_corpus}
              · thin corpus
            {/if}
          </span>
        </div>
        <ResearchAnswer
          markdown={response.answer_markdown}
          entities={response.entities ?? []}
          citations={response.citations}
          disagreements={response.disagreements ?? []}
          view={response.view ?? null}
          focus_name_id={response.focus_name_id ?? focusNameId}
          comparison={null}
          teams={null}
          weapon_ranks={response.weapon_ranks ?? []}
          artifact_ranks={response.artifact_ranks ?? []}
          artifact_options={response.artifact_options ?? []}
          stat_priority={response.stat_priority ?? null}
          er_targets={null}
          rotation={null}
        />
        {#if response.trace}
          <ResearchTrace trace={response.trace} />
        {/if}
      {:else if response}
        <div class="ask-state ask-error" role="alert">
          <p class="section-title">Unexpected response</p>
          <p class="section-lede">
            Agent did not return a Build view. Retry Build.
          </p>
          <Button variant="secondary" onclick={() => void runAsk()}>Retry</Button>
        </div>
      {:else}
        <div class="ask-empty">
          <p class="section-lede">
            Choose a focus character, leave topic on Build, then Run.
          </p>
        </div>
      {/if}
    </div>
  </div>
{/snippet}

{#if chrome === "page"}
  <PageShell class="ask-page">
    <header class="ask-top">
      <div class="ask-top-text">
        <a class="back-link" href={resolve("/dev")}>Dev</a>
        <span class="page-meta-sep" aria-hidden="true">/</span>
        <h1 class="ask-title">Research</h1>
      </div>
      {@render healthPill()}
    </header>
    {@render askBody()}
  </PageShell>
{:else}
  <div class="ask-plain">
    <header class="ask-top ask-top-plain">
      {@render healthPill()}
    </header>
    {@render askBody()}
  </div>
{/if}

<style>
  :global(.page-shell.ask-page) {
    gap: 0;
    max-width: 48rem;
    margin-inline: auto;
    min-height: calc(100dvh - 6rem);
    padding-bottom: var(--space-4);
  }

  .ask-plain {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 0;
  }

  .ask-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) 0 var(--space-2);
    flex-shrink: 0;
  }

  .ask-top-plain {
    justify-content: flex-end;
    padding-top: 0;
    padding-bottom: var(--space-1);
  }

  .ask-top-text {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 0;
  }

  .ask-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--foreground-color);
  }

  .health-pill {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--foreground-color) 62%, transparent);
  }

  .health-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--foreground-color) 35%, transparent);
  }

  .health-ok .health-dot {
    background: #2ecc71;
  }

  .health-bad .health-dot {
    background: #e67e22;
  }

  .health-retry {
    margin: 0;
    margin-left: 0.15rem;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    font-size: inherit;
    color: var(--foreground-color);
    text-decoration: underline;
    cursor: pointer;
  }

  .health-retry:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ask-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: var(--space-4);
    overflow: auto;
  }

  .ask-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .ask-lede .section-title,
  .ask-lede .section-lede {
    margin: 0;
  }

  .ask-lede .section-lede {
    margin-top: 0.35rem;
  }

  .ask-controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: flex-end;
  }

  .ask-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
  }

  .ask-focus {
    flex: 1 1 12rem;
  }

  .focus-label {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
  }

  .ask-field :global(.focus-select),
  .ask-field :global(.provider-select) {
    min-width: 9rem;
  }

  .ask-topics {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .topic-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .topic-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 22%, transparent);
    background: transparent;
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 600;
    color: color-mix(in srgb, var(--foreground-color) 78%, transparent);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .topic-chip.is-selected {
    border-color: var(--accent-1);
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--accent-1) 10%, transparent);
  }

  .topic-chip:hover:not(:disabled) {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 38%, transparent);
  }

  .topic-chip:disabled {
    cursor: not-allowed;
    border-color: color-mix(in srgb, var(--foreground-color) 14%, transparent);
    color: color-mix(in srgb, var(--foreground-color) 42%, transparent);
  }

  .topic-soon {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.75;
  }

  .ask-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .ask-hint {
    margin: 0;
  }

  .ask-result {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 6rem;
  }

  .ask-result-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.35rem;
  }

  .confidence {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
  }

  .confidence-high {
    color: #2ecc71;
  }

  .confidence-medium {
    color: color-mix(in srgb, var(--foreground-color) 72%, transparent);
  }

  .confidence-low,
  .confidence-none {
    color: #e67e22;
  }

  .ask-empty {
    padding: 0.5rem 0;
  }

  .ask-empty .section-lede {
    margin: 0;
  }

  .ask-state {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding: 0.75rem 0;
  }

  .ask-state[aria-busy="true"] {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    min-height: 5rem;
    gap: 0.4rem;
  }

  .ask-state .section-title,
  .ask-state .section-lede {
    margin: 0;
  }

  .thinking-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--foreground-color) 45%, transparent);
    animation: ask-pulse 1s ease-in-out infinite;
  }

  .thinking-dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .thinking-dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes ask-pulse {
    0%,
    100% {
      opacity: 0.35;
      transform: translateY(0);
    }
    50% {
      opacity: 1;
      transform: translateY(-0.15rem);
    }
  }
</style>
