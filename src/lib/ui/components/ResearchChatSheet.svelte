<script lang="ts">
  import { tick } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { researchChatOpen } from "$lib/research-chat-open";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import { acquireBodyScrollLock } from "$lib/ui/body-scroll-lock";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import ResearchChat from "$lib/ui/components/ResearchChat.svelte";

  let panelEl: HTMLDivElement | null = $state(null);
  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);
  let closedByNavigate = false;

  function close() {
    researchChatOpen.set(false);
  }

  afterNavigate(() => {
    if (!$researchChatOpen) return;
    closedByNavigate = true;
    close();
  });

  $effect(() => {
    if (!$researchChatOpen) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const releaseScrollLock = acquireBodyScrollLock();
    let active = true;
    void tick().then(() => {
      if (!active || !$researchChatOpen) return;
      panelEl?.querySelector<HTMLElement>(".sheet-close")?.focus();
    });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (panelEl) trapTabKey(e, panelEl);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      active = false;
      releaseScrollLock();
      window.removeEventListener("keydown", onKey);
      const skipFocus = closedByNavigate;
      closedByNavigate = false;
      if (previous?.isConnected && !skipFocus) previous.focus();
    };
  });
</script>

{#if $researchChatOpen}
  <div class="sheet-root">
    <button
      type="button"
      class="sheet-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={close}
      transition:fade={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="sheet-panel"
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="research-chat-title"
      tabindex="-1"
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <div class="sheet-head">
        <h2 id="research-chat-title" class="sheet-title">Research</h2>
        <button
          type="button"
          class="sheet-close"
          onclick={close}
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
      </div>
      <div class="sheet-body">
        <ResearchChat chrome="plain" />
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet-root {
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .sheet-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 62%, transparent);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .sheet-panel {
    position: relative;
    z-index: 1;
    width: min(92vw, 44rem);
    height: min(88vh, 52rem);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem 0.85rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--background-color);
    box-shadow: 0 22px 56px color-mix(in oklab, black 50%, transparent);
    pointer-events: auto;
  }

  .sheet-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .sheet-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--foreground-color);
  }

  .sheet-close {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    flex-shrink: 0;
  }

  .sheet-close:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .sheet-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0 0.1rem 0.15rem;
  }

  .sheet-body :global(.ask-plain) {
    flex: 1;
    min-height: 0;
  }
</style>
