<script lang="ts">
  import { page } from "$app/state";
  import { dev } from "$app/environment";
  import IconPerson from "$lib/ui/icons/IconPerson.svelte";
  import IconCalendarWeek from "$lib/ui/icons/IconCalendarWeek.svelte";
  import IconFileSearch from "$lib/ui/icons/IconFileSearch.svelte";
  import NavAppsLauncher from "$lib/ui/components/NavAppsLauncher.svelte";
  import type { NavAppItem } from "$lib/ui/components/NavAppsLauncher.svelte";
  import NavDesktopLinks from "$lib/ui/components/NavDesktopLinks.svelte";
  import NavMobileDrawer from "$lib/ui/components/NavMobileDrawer.svelte";
  import { authClient } from "$lib/auth-client";
  import { backgroundVisible, toggleBackgroundVisible } from "$lib/stores";
  import { plannerItineraryOpen } from "$lib/planner-itinerary-open";
  import { researchChatOpen } from "$lib/research-chat-open";
  import { accountSettingsOpen } from "$lib/account-settings-open";
  import { homePath } from "$lib/ui/nav-links";

  const session = authClient.useSession();

  const appItems: NavAppItem[] = [
    {
      id: "itinerary",
      label: "Itinerary",
      icon: IconCalendarWeek,
      onclick: () => {
        plannerItineraryOpen.set(true);
        mobileOpen = false;
      },
    },
    ...(dev
      ? [
          {
            id: "research",
            // Provisional — rename when the product name lands.
            label: "Research",
            icon: IconFileSearch,
            onclick: () => {
              researchChatOpen.set(true);
              mobileOpen = false;
            },
          } satisfies NavAppItem,
        ]
      : []),
  ];

  let scrolled = $state(false);
  let navSubOpen = $state(false);
  let mobileOpen = $state(false);
  let hamburgerEl: HTMLButtonElement | null = $state(null);

  $effect(() => {
    const onScroll = () => {
      scrolled = window.scrollY > 30;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  });

  function openAccount() {
    accountSettingsOpen.set(true);
    mobileOpen = false;
  }
</script>

<nav
  class="nav-bar w-full fixed top-0 z-[100] flex flex-col transition-all duration-300 {scrolled
    ? 'opaque-bg'
    : 'nav-initial'}"
  class:nav-sub-open={navSubOpen}
>
  <!-- Main row -->
  <div class="nav-row flex items-center justify-between h-16">
    <div class="nav-brand shrink-0 flex items-center gap-2.5">
      <button
        type="button"
        class="nav-mark-btn"
        class:bg-on={$backgroundVisible}
        aria-pressed={$backgroundVisible}
        aria-label={$backgroundVisible
          ? "Hide lighthouse background"
          : "Show lighthouse background"}
        onclick={() => toggleBackgroundVisible(page.url.pathname)}
      >
        <img
          class="nav-mark"
          src="/lightkeepers-mark.png"
          alt=""
          width="28"
          height="28"
          decoding="async"
        />
      </button>
      <a
        href={homePath}
        class="nav-wordmark"
        aria-current={page.url.pathname === homePath ? "page" : undefined}
      >
        Lightkeepers
      </a>
    </div>

    <NavDesktopLinks onSubOpenChange={(open) => (navSubOpen = open)} />

    <div class="nav-end flex items-center gap-1">
      <NavAppsLauncher items={appItems} />
      <button
        type="button"
        class="nav-account-btn"
        aria-label="Account"
        aria-haspopup="dialog"
        aria-expanded={$accountSettingsOpen}
        onclick={openAccount}
      >
        {#if $session.data?.user?.image}
          <img
            class="nav-account-avatar"
            src={$session.data.user.image}
            alt=""
            width="32"
            height="32"
          />
        {:else}
          <IconPerson size={14} />
        {/if}
      </button>

      <!-- Hamburger button (mobile only) -->
      <button
        class="hamburger md:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        bind:this={hamburgerEl}
        onclick={() => {
          mobileOpen = !mobileOpen;
        }}
      >
        <span class="bar" class:open={mobileOpen}></span>
        <span class="bar" class:open={mobileOpen}></span>
        <span class="bar" class:open={mobileOpen}></span>
      </button>
    </div>
  </div>
</nav>

<NavMobileDrawer
  bind:open={mobileOpen}
  onRequestHamburgerFocus={() => hamburgerEl?.focus()}
/>

<style>
  .nav-bar {
    pointer-events: none;
    transition:
      background-color 0.4s ease,
      height 0.25s ease,
      border-color 0.4s ease;
    height: 4rem;
    border-bottom: var(--border-width) solid transparent;
  }

  .nav-row {
    padding-left: var(--page-gutter);
    padding-right: var(--page-gutter);
  }

  .nav-bar.nav-sub-open {
    height: 6.5rem;
  }

  .nav-initial {
    background: color-mix(in srgb, black 10%, transparent);
  }

  .opaque-bg {
    background: color-mix(in srgb, var(--background-color) 88%, transparent);
    backdrop-filter: blur(12px);
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .nav-brand {
    pointer-events: auto;
  }

  .nav-mark-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
  }

  .nav-wordmark {
    font-family: var(--font-brand);
    font-size: var(--text-lg);
    font-weight: 600;
    letter-spacing: var(--tracking-brand);
    color: var(--foreground-color);
    text-decoration: none;
    transition: color var(--control-duration) var(--control-ease);
  }

  .nav-wordmark:hover {
    color: var(--accent-1);
  }

  /* Designed mark is dark-on-black — invert so it reads on the nav. */
  .nav-mark {
    width: 1.75rem;
    height: 1.75rem;
    object-fit: contain;
    filter: invert(1);
    transition: opacity 0.2s ease;
  }

  .nav-mark-btn:not(.bg-on) .nav-mark {
    opacity: 0.55;
  }

  .nav-mark-btn:hover .nav-mark {
    opacity: 0.85;
  }

  .nav-mark-btn:not(.bg-on):hover .nav-mark {
    opacity: 0.75;
  }

  .nav-bar > div {
    pointer-events: auto;
  }

  .nav-account-btn {
    pointer-events: auto;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-radius: 999px;
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    background: none;
    color: var(--foreground-mid);
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;
    transition:
      color var(--control-duration) var(--control-ease),
      background-color var(--control-duration) var(--control-ease),
      border-color var(--control-duration) var(--control-ease);
  }

  .nav-account-btn:hover,
  .nav-account-btn[aria-expanded="true"] {
    color: var(--foreground-color);
    border-color: rgba(255, 255, 255, 0.4);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .nav-account-avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* ── Hamburger ── */
  .hamburger {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    padding: 0.5rem;
    margin-right: -0.25rem;
    background: none;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background-color var(--control-duration) var(--control-ease);
  }

  .hamburger:hover {
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .bar {
    display: block;
    width: 22px;
    height: 2px;
    background: var(--foreground-color);
    border-radius: 2px;
    transition:
      transform 0.25s ease,
      opacity 0.25s ease;
    transform-origin: center;
  }

  .bar:nth-child(1).open {
    transform: translateY(7px) rotate(45deg);
  }
  .bar:nth-child(2).open {
    opacity: 0;
    transform: scaleX(0);
  }
  .bar:nth-child(3).open {
    transform: translateY(-7px) rotate(-45deg);
  }
</style>
