<script lang="ts">
  import { page } from "$app/state";
  import { tick, untrack } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import IconCog from "$lib/ui/icons/IconCog.svelte";
  import IconUser from "$lib/ui/icons/IconUser.svelte";
  import IconCloudUp from "$lib/ui/icons/IconCloudUp.svelte";
  import IconMonitor from "$lib/ui/icons/IconMonitor.svelte";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import { DISCORD_INVITE_URL } from "$lib/site";
  import { acquireBodyScrollLock } from "$lib/ui/body-scroll-lock";
  import {
    isMainLinkActive,
    isPathActive,
    isSettingsPage,
    isToolLinkActive,
    isToolsPage,
    mainLinks,
    patchNotesPath,
    settingsLinks,
    settingsPath,
    settingsTabFromSearch,
    toolsLinks,
    type MainLink,
    type ToolsLink,
  } from "$lib/ui/nav-links";

  let {
    open = $bindable(false),
    onRequestHamburgerFocus,
  }: {
    open: boolean;
    onRequestHamburgerFocus?: () => void;
  } = $props();

  let toolsDrawerExpanded = $state(false);
  let settingsDrawerExpanded = $state(false);
  let drawerEl: HTMLElement | null = $state(null);
  let drawerWasOpen = false;
  let closedByNavigation = false;

  function isMainActive(link: MainLink): boolean {
    return isMainLinkActive(page.url.pathname, link);
  }

  function isToolActive(link: ToolsLink): boolean {
    return isToolLinkActive(page.url.pathname, link);
  }

  const onToolsPage = $derived(isToolsPage(page.url.pathname));

  const onSettingsPage = $derived(isSettingsPage(page.url.pathname));

  $effect(() => {
    // Include search so Settings ?tab= changes close the mobile drawer too.
    page.url.href;
    untrack(() => {
      if (open) {
        closedByNavigation = true;
        open = false;
        toolsDrawerExpanded = false;
        settingsDrawerExpanded = false;
      }
    });
  });

  function drawerFocusables(root: HTMLElement): HTMLElement[] {
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.closest("[inert]"));
  }

  $effect(() => {
    if (open) {
      drawerWasOpen = true;
      closedByNavigation = false;

      untrack(() => {
        toolsDrawerExpanded = onToolsPage;
        settingsDrawerExpanded = onSettingsPage;
      });

      const releaseScrollLock = acquireBodyScrollLock();

      tick().then(() => {
        if (drawerEl) drawerFocusables(drawerEl)[0]?.focus();
      });

      function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          open = false;
          toolsDrawerExpanded = false;
          settingsDrawerExpanded = false;
          return;
        }
        if (e.key !== "Tab" || !drawerEl) return;

        const focusable = drawerFocusables(drawerEl);
        if (focusable.length < 2) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }

      window.addEventListener("keydown", onKeydown);
      return () => {
        releaseScrollLock();
        window.removeEventListener("keydown", onKeydown);
      };
    } else if (drawerWasOpen && !closedByNavigation) {
      drawerWasOpen = false;
      onRequestHamburgerFocus?.();
    } else if (closedByNavigation) {
      drawerWasOpen = false;
      closedByNavigation = false;
    }
  });

  function closeDrawer() {
    open = false;
    toolsDrawerExpanded = false;
    settingsDrawerExpanded = false;
  }
</script>

{#if open}
  <div
    class="drawer-backdrop"
    role="presentation"
    transition:fade={{ duration: 200 }}
    onclick={closeDrawer}
  ></div>
{/if}

{#if open}
  <div
    class="drawer"
    role="dialog"
    aria-modal="true"
    aria-label="Navigation menu"
    bind:this={drawerEl}
    transition:fly={{
      x: prefersReducedMotion.current ? 0 : 300,
      duration: prefersReducedMotion.current ? 0 : 280,
    }}
  >
    <button
      type="button"
      class="drawer-close"
      onclick={closeDrawer}
      aria-label="Close navigation menu"
    >
      <IconX size={18} strokeWidth={2.25} />
    </button>
    <nav class="drawer-nav" aria-label="Primary">
      <p class="eyebrow drawer-section-label">Navigate</p>

      <div class="drawer-group">
        <button
          type="button"
          class="drawer-item drawer-group-toggle"
          class:is-active={onToolsPage && !toolsDrawerExpanded}
          style="--i: 0"
          aria-expanded={toolsDrawerExpanded}
          onclick={() => {
            toolsDrawerExpanded = !toolsDrawerExpanded;
            if (toolsDrawerExpanded) settingsDrawerExpanded = false;
          }}
        >
          <span class="drawer-item-label">Tools</span>
          <span
            class="drawer-chevron"
            class:drawer-chevron-open={toolsDrawerExpanded}
            aria-hidden="true"
          >
            <IconChevronDown size={14} strokeWidth={2.25} />
          </span>
        </button>

        <div
          class="drawer-sub"
          class:drawer-sub-open={toolsDrawerExpanded}
          inert={!toolsDrawerExpanded}
        >
          {#each toolsLinks as link, i}
            <a
              href={link.path}
              class="drawer-item drawer-item-sub"
              class:is-active={isToolActive(link)}
              style="--i: {1 + i}"
              data-sveltekit-preload-data={"preload" in link
                ? link.preload
                : undefined}
              aria-current={isToolActive(link) ? "page" : undefined}
            >
              <span class="drawer-item-label">{link.label}</span>
            </a>
          {/each}
        </div>
      </div>

      {#each mainLinks as link, i}
        <a
          href={link.path}
          class="drawer-item"
          class:is-active={isMainActive(link)}
          style="--i: {toolsLinks.length + 1 + i}"
          aria-current={isMainActive(link) ? "page" : undefined}
        >
          <span class="drawer-item-label">{link.label}</span>
        </a>
      {/each}

      <div class="drawer-group">
        <p class="eyebrow drawer-section-label">Account</p>
        <button
          type="button"
          class="drawer-item drawer-group-toggle"
          class:is-active={onSettingsPage && !settingsDrawerExpanded}
          style="--i: {toolsLinks.length + 1 + mainLinks.length}"
          aria-expanded={settingsDrawerExpanded}
          aria-current={onSettingsPage ? "page" : undefined}
          onclick={() => {
            settingsDrawerExpanded = !settingsDrawerExpanded;
            if (settingsDrawerExpanded) toolsDrawerExpanded = false;
          }}
        >
          <span class="drawer-item-icon" aria-hidden="true">
            <IconCog size={18} />
          </span>
          <span class="drawer-item-label">Settings</span>
          <span
            class="drawer-chevron"
            class:drawer-chevron-open={settingsDrawerExpanded}
            aria-hidden="true"
          >
            <IconChevronDown size={14} strokeWidth={2.25} />
          </span>
        </button>

        <div
          class="drawer-sub"
          class:drawer-sub-open={settingsDrawerExpanded}
          inert={!settingsDrawerExpanded}
        >
          {#each settingsLinks as link, i}
            {@const activeTab = settingsTabFromSearch(page.url.searchParams)}
            {@const subActive = onSettingsPage && activeTab === link.tab}
            <a
              href={link.path}
              class="drawer-item drawer-item-sub"
              class:is-active={subActive}
              style="--i: {toolsLinks.length + 2 + mainLinks.length + i}"
              aria-current={subActive ? "page" : undefined}
            >
              <span class="drawer-item-icon" aria-hidden="true">
                {#if link.icon === "users"}
                  <IconUser size={16} />
                {:else if link.icon === "cloud"}
                  <IconCloudUp size={16} />
                {:else}
                  <IconMonitor size={16} />
                {/if}
              </span>
              <span class="drawer-item-label">{link.label}</span>
            </a>
          {/each}
        </div>
      </div>
    </nav>

    <div class="drawer-foot">
      <a
        class="drawer-item"
        href={patchNotesPath}
        class:is-active={isPathActive(
          page.url.pathname,
          patchNotesPath,
          "prefix",
        )}
      >
        <span class="drawer-item-label">Patch notes</span>
      </a>
      <a
        class="drawer-item"
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="drawer-item-icon" aria-hidden="true">
          <img
            src="https://api.lightkeepers.moe/site/guoba_lightkeepers.webp"
            alt=""
            class="drawer-guoba"
          />
        </span>
        <span class="drawer-item-label">Discord</span>
      </a>
    </div>
  </div>
{/if}

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: color-mix(in srgb, black 55%, transparent);
    backdrop-filter: blur(2px);
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    width: min(300px, 88vw);
    height: 100%;
    padding: 4.75rem 0 1rem;
    overflow: hidden;
    background: var(--surface-raised);
    /* Cream hairline on mid surface — never washed gold */
    border-left: var(--border-width) solid var(--border-control-quiet);
    box-shadow: -16px 0 48px color-mix(in srgb, black 50%, transparent);
  }

  .drawer-nav {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0 0.5rem;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .drawer-close {
    display: grid;
    place-items: center;
    align-self: flex-end;
    width: 2.25rem;
    height: 2.25rem;
    margin: 0 0.5rem 0.35rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    flex-shrink: 0;
    z-index: 1;
  }

  .drawer-close:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .drawer-nav::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  .drawer-section-label {
    margin: 0.35rem 0.75rem 0.4rem;
    font-size: 0.68rem;
    color: color-mix(in srgb, var(--foreground-mid) 70%, transparent);
  }

  .drawer-group .drawer-section-label {
    margin-top: 1rem;
    padding-top: 0.85rem;
    border-top: var(--border-width) solid var(--border-control-quiet);
  }

  .drawer-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.78rem 0.9rem;
    border-radius: var(--radius-md);
    font-family: var(--font-display);
    font-size: var(--text-base);
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--foreground-mid);
    text-decoration: none;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    transition:
      color var(--control-duration) var(--control-ease),
      background-color var(--control-duration) var(--control-ease);
    animation: drawer-item-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(40ms * var(--i, 0));
  }

  .drawer-item:hover {
    color: var(--foreground-color);
    background: color-mix(in srgb, var(--foreground-color) 7%, transparent);
  }

  .drawer-item.is-active {
    color: var(--accent-2);
    background: var(--surface-selected);
  }

  .drawer-item.is-active::before {
    content: "";
    position: absolute;
    left: 0.2rem;
    top: 22%;
    bottom: 22%;
    width: 2px;
    border-radius: var(--radius-pill);
    background: var(--accent-1);
  }

  .drawer-item-icon {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    color: currentColor;
    flex: 0 0 auto;
  }

  .drawer-item-label {
    flex: 1 1 auto;
    min-width: 0;
  }

  .drawer-group {
    display: flex;
    flex-direction: column;
  }

  .drawer-chevron {
    margin-left: auto;
    flex-shrink: 0;
    transition: transform 0.2s ease;
    color: currentColor;
    opacity: 0.75;
  }

  .drawer-chevron-open {
    transform: rotate(180deg);
  }

  .drawer-sub {
    display: flex;
    flex-direction: column;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.25s ease;
  }

  .drawer-sub-open {
    max-height: 16rem;
  }

  .drawer-item-sub {
    padding-left: 1.15rem;
    font-size: var(--text-md);
  }

  .drawer-foot {
    position: relative;
    z-index: 1;
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.15rem;
    padding: 0.85rem 0.75rem 0.85rem;
    border-top: var(--border-width) solid var(--border-control-quiet);
  }

  .drawer-guoba {
    width: 22px;
    height: 22px;
    object-fit: contain;
    display: block;
  }

  @keyframes drawer-item-in {
    from {
      opacity: 0;
      transform: translateX(10px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .drawer-item {
      animation: none;
    }
  }
</style>
