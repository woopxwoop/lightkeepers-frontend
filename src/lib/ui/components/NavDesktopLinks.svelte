<script lang="ts">
  import { onDestroy } from "svelte";
  import { page } from "$app/state";
  import {
    abyssPath,
    isMainLinkActive,
    isSettingsPage,
    isToolLinkActive,
    isToolsPage,
    mainLinks,
    settingsLinks,
    settingsPath,
    settingsTabFromSearch,
    toolsLinks,
    type MainLink,
    type ToolsLink,
  } from "$lib/ui/nav-links";
  import { shouldArmSubmenuFirstActivation } from "$lib/ui/nav-submenu-arm";

  let {
    onSubOpenChange,
  }: {
    onSubOpenChange?: (open: boolean) => void;
  } = $props();

  let navWrapEl: HTMLElement | undefined = $state();
  let toolsHovered = $state(false);
  let settingsHovered = $state(false);
  let toolsLeaveTimeout: ReturnType<typeof setTimeout> | null = null;
  let settingsLeaveTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    onSubOpenChange?.(toolsHovered || settingsHovered);
  });

  onDestroy(() => {
    if (toolsLeaveTimeout) clearTimeout(toolsLeaveTimeout);
    if (settingsLeaveTimeout) clearTimeout(settingsLeaveTimeout);
  });

  let toolsTouchArmed = $state(false);
  let settingsTouchArmed = $state(false);
  /** Last pointerdown type on Tools/Settings — click alone has no pointerType. */
  let lastPointerType: string | null = null;

  function dismissArmedSubmenus() {
    toolsHovered = false;
    settingsHovered = false;
    toolsTouchArmed = false;
    settingsTouchArmed = false;
  }

  $effect(() => {
    if (!toolsTouchArmed && !settingsTouchArmed) return;
    function onPointerDownOutside(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target || navWrapEl?.contains(target)) return;
      dismissArmedSubmenus();
    }
    window.addEventListener("pointerdown", onPointerDownOutside, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDownOutside, true);
    };
  });

  function onToolsEnter() {
    if (toolsLeaveTimeout) {
      clearTimeout(toolsLeaveTimeout);
      toolsLeaveTimeout = null;
    }
    if (settingsLeaveTimeout) {
      clearTimeout(settingsLeaveTimeout);
      settingsLeaveTimeout = null;
    }
    toolsHovered = true;
    settingsHovered = false;
  }

  function onToolsLeave() {
    toolsLeaveTimeout = setTimeout(() => {
      toolsHovered = false;
      toolsTouchArmed = false;
    }, 120);
  }

  function onSettingsEnter() {
    if (settingsLeaveTimeout) {
      clearTimeout(settingsLeaveTimeout);
      settingsLeaveTimeout = null;
    }
    if (toolsLeaveTimeout) {
      clearTimeout(toolsLeaveTimeout);
      toolsLeaveTimeout = null;
    }
    settingsHovered = true;
    toolsHovered = false;
  }

  function onSettingsLeave() {
    settingsLeaveTimeout = setTimeout(() => {
      settingsHovered = false;
      settingsTouchArmed = false;
    }, 120);
  }

  function onMenuPointerDown(event: PointerEvent) {
    lastPointerType = event.pointerType;
  }

  function onToolsClick(event: MouseEvent) {
    const pointerType = lastPointerType;
    lastPointerType = null;
    if (
      !shouldArmSubmenuFirstActivation({
        pointerType,
        clickDetail: event.detail,
        alreadyArmed: toolsTouchArmed,
      })
    ) {
      return;
    }
    // First touch opens (even if a compatibility mouseenter already hovered).
    event.preventDefault();
    onToolsEnter();
    toolsTouchArmed = true;
    settingsTouchArmed = false;
  }

  function onSettingsClick(event: MouseEvent) {
    const pointerType = lastPointerType;
    lastPointerType = null;
    if (
      !shouldArmSubmenuFirstActivation({
        pointerType,
        clickDetail: event.detail,
        alreadyArmed: settingsTouchArmed,
      })
    ) {
      return;
    }
    event.preventDefault();
    onSettingsEnter();
    settingsTouchArmed = true;
    toolsTouchArmed = false;
  }

  function isMainActive(link: MainLink): boolean {
    return isMainLinkActive(page.url.pathname, link);
  }

  function isToolActive(link: ToolsLink): boolean {
    return isToolLinkActive(page.url.pathname, link);
  }

  const onToolsPage = $derived(isToolsPage(page.url.pathname));

  const onSettingsPage = $derived(isSettingsPage(page.url.pathname));
</script>

<div
  class="hidden md:flex items-center gap-6 relative"
  bind:this={navWrapEl}
>
  <div class="nav-menu-item">
    <a
      href={abyssPath}
      class="nav-link"
      aria-expanded={toolsHovered}
      aria-current={onToolsPage ? "page" : undefined}
      onmouseenter={onToolsEnter}
      onmouseleave={onToolsLeave}
      onfocus={onToolsEnter}
      onblur={onToolsLeave}
      onpointerdown={onMenuPointerDown}
      onclick={onToolsClick}>Tools</a
    >

    <div
      class="nav-sub-row"
      class:nav-sub-row-open={toolsHovered}
      inert={!toolsHovered}
      role="presentation"
      onmouseenter={onToolsEnter}
      onmouseleave={onToolsLeave}
      onfocusin={onToolsEnter}
      onfocusout={onToolsLeave}
    >
      {#each toolsLinks as link}
        <a
          href={link.path}
          class="nav-sub-link"
          data-sveltekit-preload-data={"preload" in link
            ? link.preload
            : undefined}
          aria-current={isToolActive(link) ? "page" : undefined}>{link.label}</a
        >
      {/each}
    </div>
  </div>

  {#each mainLinks as link}
    <a
      href={link.path}
      class="nav-link"
      aria-current={isMainActive(link) ? "page" : undefined}>{link.label}</a
    >
  {/each}

  <div class="nav-menu-item">
    <a
      href={settingsPath}
      class="nav-link"
      aria-expanded={settingsHovered}
      aria-current={onSettingsPage ? "page" : undefined}
      onmouseenter={onSettingsEnter}
      onmouseleave={onSettingsLeave}
      onfocus={onSettingsEnter}
      onblur={onSettingsLeave}
      onpointerdown={onMenuPointerDown}
      onclick={onSettingsClick}>Settings</a
    >

    <div
      class="nav-sub-row"
      class:nav-sub-row-open={settingsHovered}
      inert={!settingsHovered}
      role="presentation"
      onmouseenter={onSettingsEnter}
      onmouseleave={onSettingsLeave}
      onfocusin={onSettingsEnter}
      onfocusout={onSettingsLeave}
    >
      {#each settingsLinks as link}
        {@const activeTab = settingsTabFromSearch(page.url.searchParams)}
        <a
          href={link.path}
          class="nav-sub-link"
          aria-current={onSettingsPage && activeTab === link.tab
            ? "page"
            : undefined}>{link.label}</a
        >
      {/each}
    </div>
  </div>
</div>

<style>
  .nav-link {
    position: relative;
    padding-bottom: 2px;
    font-family: var(--font-display);
    font-size: var(--text-md);
    font-weight: 500;
    letter-spacing: 0.01em;
    line-height: 1.25;
    color: var(--foreground-mid);
    text-decoration: none;
    transition: color var(--control-duration) var(--control-ease);
    pointer-events: auto;
  }

  /* Gold underline bar. */
  .nav-link::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1.5px;
    pointer-events: none;
    background: var(--accent-1);
    opacity: 0;
    transform: scaleX(0.55);
    transform-origin: center;
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .nav-link:hover,
  .nav-link[aria-current="page"] {
    color: var(--foreground-color);
  }

  .nav-link:hover::after,
  .nav-link[aria-current="page"]::after {
    opacity: 1;
    transform: scaleX(1);
  }

  /* ── Hover sub-row (Tools / Settings) ── */
  .nav-menu-item {
    position: relative;
    display: flex;
    align-items: center;
    /* Match other nav-link flex items so the parent doesn't sit low */
    align-self: center;
  }

  .nav-sub-row {
    position: absolute;
    left: 50%;
    top: 100%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding-top: var(--space-4);
    padding-bottom: var(--space-2);
    white-space: nowrap;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
    transition:
      max-height 0.2s ease,
      opacity 0.2s ease;
  }

  .nav-sub-row.nav-sub-row-open {
    max-height: 2.5rem;
    opacity: 1;
    overflow: visible;
    pointer-events: auto;
  }

  .nav-sub-link {
    font-size: var(--text-md);
    letter-spacing: 0.03em;
    font-family: var(--font-display);
    font-weight: 500;
    color: var(--foreground-mid);
    text-decoration: none;
    transition: color var(--control-duration) var(--control-ease);
    pointer-events: auto;
  }

  .nav-sub-link:hover,
  .nav-sub-link[aria-current="page"] {
    color: var(--foreground-color);
  }

  @media (prefers-reduced-motion: reduce) {
    .nav-link::after {
      transition: none;
    }
  }
</style>
