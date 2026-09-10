<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    active = false,
    class: className = "",
    children,
    type = "button",
    ...rest
  }: {
    active?: boolean;
    class?: string;
    children?: Snippet;
    type?: "button" | "submit" | "reset";
  } & Omit<HTMLButtonAttributes, "children" | "class" | "type"> = $props();
</script>

<button class="chip {className}" class:chip-active={active} {type} {...rest}>
  {@render children?.()}
</button>

<style>
  .chip {
    font-size: var(--text-xs);
    padding: 0.2rem 0.55rem;
    border-radius: var(--radius-pill);
    border: var(--border-width) solid var(--border-control-quiet);
    color: var(--foreground-mid);
    background: transparent;
    transition: var(--control-transition);
  }

  .chip:hover:not(:disabled):not(.chip-active) {
    color: var(--foreground-color);
    background: var(--surface-quiet);
    border-color: color-mix(in srgb, var(--foreground-color) 32%, transparent);
  }

  .chip:active:not(:disabled):not(.chip-active) {
    background: color-mix(in srgb, var(--foreground-color) 12%, transparent);
    border-color: color-mix(in srgb, var(--foreground-color) 40%, transparent);
  }

  .chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chip-active {
    color: var(--accent-1);
    border-color: var(--accent-1);
    background: color-mix(in srgb, var(--foreground-color) 8%, transparent);
  }

  .chip-active:hover:not(:disabled) {
    color: var(--accent-1);
    border-color: var(--accent-1);
    background: color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }
</style>
