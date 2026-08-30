<script lang="ts">
  /**
   * TC research chat — page chrome or plain (Apps sheet).
   */
  import { tick } from "svelte";
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
  import {
    buildResearchPersonalization,
    postResearchChat,
    fetchResearchProxyHealth,
    type ResearchProxyHealth,
  } from "$lib/app/research";
  import { loadRosterWeapons } from "$lib/app/roster-inventory";
  import type {
    ResearchAnswerStyle,
    ResearchLlmProvider,
    ResearchRequest,
    ResearchResponse,
  } from "$lib/research-types";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import CharacterSearchSelect from "$lib/ui/components/CharacterSearchSelect.svelte";
  import ResearchAnswer from "$lib/ui/components/ResearchAnswer.svelte";
  import ResearchTrace from "$lib/ui/components/ResearchTrace.svelte";
  import Select from "$lib/ui/components/Select.svelte";
  import type { SelectOption } from "$lib/ui/components/Select.svelte";
  import Toggle from "$lib/ui/components/Toggle.svelte";
  import type { Character } from "$lib/definitions";
  import { charactersHydrated, charactersOwned } from "$lib/stores";
  import { get } from "svelte/store";

  type ChatTurn =
    | { id: string; role: "user"; text: string }
    | {
        id: string;
        role: "assistant";
        response?: ResearchResponse;
        error?: string;
      };

  let {
    chrome = "page",
  }: {
    /** Full page shell + Dev breadcrumb, or fill a parent sheet. */
    chrome?: "page" | "plain";
  } = $props();

  const examples = [
    "What does Hu Tao C1 do and is it worth it vs Staff of Homa?",
    "How should I play Hu Tao rotation with Xingqiu?",
    "What ER does Xingqiu need in Hu Tao double hydro?",
  ];

  const questionFieldId = $props.id();

  const providerOptions: SelectOption<ResearchLlmProvider>[] = [
    { value: "gemini", label: "Gemini" },
    { value: "deepseek", label: "DeepSeek" },
  ];

  const styleOptions: SelectOption<ResearchAnswerStyle>[] = [
    { value: "concise", label: "Concise" },
    { value: "normal", label: "Normal" },
    { value: "verbose", label: "Verbose" },
  ];

  let focusNameId = $state("");
  let llmProvider = $state<ResearchLlmProvider>("gemini");
  let answerStyle = $state<ResearchAnswerStyle>("concise");
  let personalize = $state(false);
  let personalizeInited = $state(false);
  let draft = $state("");
  let loading = $state(false);
  let turns = $state<ChatTurn[]>([]);
  let proxyHealth = $state<ResearchProxyHealth | null>(null);
  let threadEl: HTMLDivElement | null = $state(null);
  let composerEl: HTMLTextAreaElement | null = $state(null);

  let healthRefreshing = $state(false);

  let hasOwnedRoster = $derived($charactersOwned.some((c) => c.isOwned));

  $effect(() => {
    if (personalizeInited) return;
    if (!$charactersHydrated) return;
    personalize = hasOwnedRoster;
    personalizeInited = true;
  });

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

  let canAsk = $derived(providerReady && !loading);
  let canSend = $derived(canAsk && draft.trim().length > 0);

  let healthLabel = $derived.by(() => {
    if (!proxyHealth) return "Checking agent…";
    if (!proxyHealth.configured) return "Env not configured";
    if (proxyHealth.agent.ok) {
      const providerLabel = llmProvider === "deepseek" ? "DeepSeek" : "Gemini";
      if (llmProvider === "deepseek" && proxyHealth.agent.deepseekConfigured === false) {
        return `Agent up · ${providerLabel} key missing`;
      }
      if (llmProvider === "gemini" && proxyHealth.agent.geminiConfigured === false) {
        return `Agent up · ${providerLabel} key missing`;
      }
      return `Agent connected · ${providerLabel}`;
    }
    return proxyHealth.agent.error ?? "Agent unreachable";
  });

  async function scrollToBottom() {
    await tick();
    threadEl?.scrollTo({ top: threadEl.scrollHeight, behavior: "smooth" });
  }

  async function buildRequest(question: string): Promise<ResearchRequest> {
    const body: ResearchRequest = {
      question_kind: "ask",
      question,
      focus_name_ids: focusNameId ? [focusNameId] : [],
      llm_provider: llmProvider,
      answer_style: answerStyle,
    };

    if (!personalize) {
      body.personalize = false;
      return body;
    }

    let inventoryWeapons = null;
    try {
      inventoryWeapons = await loadRosterWeapons();
    } catch {
      // Soft-fail: still send owned characters without inventory extras.
    }

    const fields = buildResearchPersonalization({
      characters: get(charactersOwned),
      inventoryWeapons,
    });
    return { ...body, ...fields };
  }

  async function sendQuestion(text: string) {
    const question = text.trim();
    if (!question || !canAsk) return;

    const userId = crypto.randomUUID();
    turns = [...turns, { id: userId, role: "user", text: question }];
    draft = "";
    loading = true;
    void scrollToBottom();

    const assistantId = crypto.randomUUID();
    try {
      const response = await postResearchChat(await buildRequest(question));
      turns = [...turns, { id: assistantId, role: "assistant", response }];
    } catch (err) {
      turns = [
        ...turns,
        {
          id: assistantId,
          role: "assistant",
          error: err instanceof Error ? err.message : "Request failed",
        },
      ];
    } finally {
      loading = false;
      void scrollToBottom();
      composerEl?.focus();
    }
  }

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    void sendQuestion(draft);
  }

  function onComposerKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.isComposing) return;
    event.preventDefault();
    void sendQuestion(draft);
  }
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

{#snippet chatBody()}
  <div class="chat-body">
    <div class="thread" bind:this={threadEl} aria-live="polite">
      {#if turns.length === 0 && !loading}
        <div class="empty">
          <h2 class="section-title">Ask a research question</h2>
          <p class="section-lede">
            Builds, rotations, constellations, ER — grounded in the TC corpus.
          </p>
          <div class="examples">
            {#each examples as example (example)}
              <button
                type="button"
                class="example"
                disabled={!canAsk}
                onclick={() => void sendQuestion(example)}
              >
                {example}
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="messages">
          {#each turns as turn (turn.id)}
            {#if turn.role === "user"}
              <div class="row row-user">
                <div class="bubble-user">{turn.text}</div>
              </div>
            {:else if turn.error}
              <div class="row row-assistant">
                <div class="msg-error">
                  <p class="msg-error-label">Request failed</p>
                  <p class="msg-error-text">{turn.error}</p>
                </div>
              </div>
            {:else if turn.response}
              <div class="row row-assistant">
                <div class="msg-assistant">
                  <div class="msg-meta">
                    <span class="msg-role">Research</span>
                    <span class="msg-meta-sep" aria-hidden="true">·</span>
                    <span class="confidence confidence-{turn.response.confidence}">
                      {turn.response.confidence}
                      {#if turn.response.thin_corpus}
                        · thin corpus
                      {/if}
                    </span>
                  </div>
                  <ResearchAnswer
                    markdown={turn.response.answer_markdown}
                    entities={turn.response.entities ?? []}
                    citations={turn.response.citations}
                    disagreements={turn.response.disagreements ?? []}
                    comparison={turn.response.comparison ?? null}
                    teams={turn.response.teams ?? null}
                    weapon_ranks={turn.response.weapon_ranks ?? null}
                    artifact_ranks={turn.response.artifact_ranks ?? null}
                    er_targets={turn.response.er_targets ?? null}
                    rotation={turn.response.rotation ?? null}
                  />
                  {#if turn.response.trace}
                    <ResearchTrace trace={turn.response.trace} />
                  {/if}
                </div>
              </div>
            {/if}
          {/each}

          {#if loading}
            <div class="row row-assistant" aria-busy="true">
              <div class="thinking" aria-label="Researching">
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
                <span class="thinking-dot"></span>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <form class="composer" onsubmit={onSubmit}>
      <div class="composer-controls">
        <div class="composer-focus">
          <span class="focus-label">Focus</span>
          <CharacterSearchSelect
            bind:value={focusNameId}
            options={characterOptions}
            getCharacter={getCharacter}
            placeholder="Any character"
            aria-label="Focus character"
            class="focus-select"
          />
        </div>
        <div class="composer-provider">
          <span class="focus-label">Model</span>
          <Select
            bind:value={llmProvider}
            options={providerOptions}
            fit="value"
            aria-label="LLM provider"
            class="provider-select"
          />
        </div>
        <div class="composer-provider">
          <span class="focus-label">Style</span>
          <Select
            bind:value={answerStyle}
            options={styleOptions}
            fit="value"
            aria-label="Answer style"
            class="style-select"
          />
        </div>
        <div class="composer-provider composer-personalize">
          <span class="focus-label">Roster</span>
          <Toggle
            bind:pressed={personalize}
            disabled={loading || !hasOwnedRoster}
            aria-label="Personalize with roster"
          />
        </div>
      </div>
      <div class="composer-box">
        <textarea
          id={questionFieldId}
          bind:this={composerEl}
          bind:value={draft}
          rows="1"
          placeholder="Ask about a character, constellation, rotation, ER…"
          disabled={loading}
          aria-label="Question"
          onkeydown={onComposerKeydown}
        ></textarea>
        <Button
          type="submit"
          variant="primary"
          class="send-btn"
          disabled={!canSend}
          aria-label={loading ? "Sending" : "Send"}
        >
          {#if loading}
            …
          {:else}
            ↑
          {/if}
        </Button>
      </div>
      <p class="composer-hint">
        Enter to send · Shift+Enter for newline
        <span class="page-meta-sep" aria-hidden="true">·</span>
        Tunnel <code>8081</code> → agent
      </p>
    </form>
  </div>
{/snippet}

{#if chrome === "page"}
  <PageShell class="chat-page">
    <header class="chat-top">
      <div class="chat-top-text">
        <a class="back-link" href={resolve("/dev")}>Dev</a>
        <span class="page-meta-sep" aria-hidden="true">/</span>
        <h1 class="chat-title">Research</h1>
      </div>
      {@render healthPill()}
    </header>
    {@render chatBody()}
  </PageShell>
{:else}
  <div class="chat-plain">
    <header class="chat-top chat-top-plain">
      {@render healthPill()}
    </header>
    {@render chatBody()}
  </div>
{/if}

<style>
  :global(.page-shell.chat-page) {
    gap: 0;
    max-width: 48rem;
    margin-inline: auto;
    min-height: calc(100dvh - 6rem);
    padding-bottom: 0;
  }

  .chat-plain {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 0;
  }

  .chat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) 0 var(--space-2);
    flex-shrink: 0;
  }

  .chat-top-plain {
    justify-content: flex-end;
    padding-top: 0;
    padding-bottom: var(--space-1);
  }

  .chat-top-text {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 0;
  }

  .chat-title {
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

  .chat-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: var(--space-3);
  }

  .thread {
    flex: 1;
    min-height: 12rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    scrollbar-gutter: stable;
  }

  .empty {
    margin: auto;
    width: min(100%, 28rem);
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
    padding: var(--space-6) var(--space-2);
    text-align: center;
  }

  .empty :global(.section-title) {
    margin: 0;
  }

  .empty :global(.section-lede) {
    margin: 0;
    line-height: 1.45;
  }

  .examples {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .example {
    text-align: left;
    font: inherit;
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--foreground-color);
    background: var(--surface-quiet);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    border-radius: var(--radius-lg);
    padding: 0.7rem 0.85rem;
    cursor: pointer;
    transition: var(--control-transition);
  }

  .example:hover:not(:disabled) {
    border-color: var(--accent-1);
    background: color-mix(in srgb, var(--accent-1) 8%, transparent);
  }

  .example:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .messages {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-3) 0 var(--space-4);
  }

  .row {
    display: flex;
    width: 100%;
  }

  .row-user {
    justify-content: flex-end;
  }

  .row-assistant {
    justify-content: flex-start;
  }

  .bubble-user {
    max-width: min(85%, 28rem);
    padding: 0.65rem 0.9rem;
    border-radius: 1.1rem 1.1rem var(--radius-sm) 1.1rem;
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    color: var(--foreground-color);
    white-space: pre-wrap;
    line-height: 1.5;
    font-size: var(--text-base);
  }

  .msg-assistant {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .msg-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem 0.65rem;
  }

  .msg-role {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
  }

  .msg-meta-sep {
    color: color-mix(in srgb, var(--foreground-color) 35%, transparent);
    font-size: var(--text-xs);
  }

  .confidence {
    font-size: var(--text-xs);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .confidence-high {
    color: #2ecc71;
  }

  .confidence-medium {
    color: #f1c40f;
  }

  .confidence-low,
  .confidence-none {
    color: #e67e22;
  }

  .msg-error {
    width: 100%;
    padding: 0.75rem 0.9rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, #c0392b 35%, var(--border-default));
    background: color-mix(in srgb, #c0392b 8%, transparent);
  }

  .msg-error-label {
    margin: 0 0 0.25rem;
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #e74c3c;
  }

  .msg-error-text {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .thinking {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.15rem;
  }

  .thinking-dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: color-mix(in srgb, var(--foreground-color) 45%, transparent);
    animation: thinking-pulse 1.1s ease-in-out infinite;
  }

  .thinking-dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .thinking-dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes thinking-pulse {
    0%,
    80%,
    100% {
      opacity: 0.35;
      transform: translateY(0);
    }
    40% {
      opacity: 1;
      transform: translateY(-0.15rem);
    }
  }

  .composer {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2) 0 0;
    background: linear-gradient(
      to top,
      var(--background-color) 72%,
      transparent
    );
  }

  .composer-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .composer-focus {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1 1 12rem;
    min-width: 0;
  }

  .composer-provider {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 0 0 auto;
  }

  .composer-provider :global(.provider-select),
  .composer-provider :global(.style-select) {
    min-width: 7.5rem;
  }

  .focus-label {
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--foreground-color) 55%, transparent);
    flex-shrink: 0;
  }

  .composer-focus :global(.focus-select) {
    flex: 1;
    max-width: 18rem;
  }

  .composer-box {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: var(--space-2);
    padding: 0.55rem 0.55rem 0.55rem 0.85rem;
    border-radius: 1.15rem;
    background: var(--surface-raised);
    border: var(--border-width) solid var(--accent-1);
    box-shadow: 0 8px 28px color-mix(in srgb, black 28%, transparent);
  }

  .composer-box:focus-within {
    outline: 2px solid color-mix(in srgb, var(--accent-1) 40%, transparent);
    outline-offset: 1px;
  }

  .composer-box textarea {
    width: 100%;
    min-height: 1.5rem;
    max-height: 10rem;
    resize: none;
    border: none;
    background: transparent;
    color: var(--foreground-color);
    font: inherit;
    font-size: var(--text-base);
    line-height: 1.45;
    padding: 0.35rem 0;
    field-sizing: content;
  }

  .composer-box textarea:focus {
    outline: none;
  }

  .composer-box textarea:disabled {
    opacity: 0.65;
  }

  .composer-box :global(.send-btn) {
    width: 2.1rem;
    height: 2.1rem;
    padding: 0;
    border-radius: var(--radius-pill);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    line-height: 1;
  }

  .composer-hint {
    margin: 0;
    font-size: var(--text-xs);
    color: color-mix(in srgb, var(--foreground-color) 48%, transparent);
  }

  .composer-hint code {
    font-size: inherit;
  }

  @media (max-width: 640px) {
    :global(.page-shell.chat-page) {
      max-width: none;
      min-height: calc(100dvh - 5rem);
    }

    .bubble-user {
      max-width: 92%;
    }

    .health-pill {
      max-width: 9rem;
    }
  }
</style>
