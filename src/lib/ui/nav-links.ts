import { resolve } from "$app/paths";

export const homePath = resolve("/");
export const abyssPath = resolve("/tools/abyss");
export const stygianPath = resolve("/tools/stygian");
export const pullsPath = resolve("/tools/pulls");
export const plannerPath = resolve("/tools/planner");
export const teamsPath = resolve("/teams");
export const charactersPath = resolve("/characters");
export const settingsPath = resolve("/settings");
export const patchNotesPath = resolve("/patch-notes");
export const toolsPrefixPath = resolve("/tools");

export const toolsLinks = [
  {
    label: "Abyss",
    path: abyssPath,
    match: "prefix" as const,
    preload: "hover" as const,
  },
  {
    label: "Stygian",
    path: stygianPath,
    match: "prefix" as const,
    preload: "hover" as const,
  },
  { label: "Pulls", path: pullsPath, match: "exact" as const },
  {
    label: "Planner",
    path: plannerPath,
    match: "prefix" as const,
  },
] as const;

export const settingsLinks = [
  {
    label: "Roster",
    path: settingsPath,
    tab: "roster",
    icon: "users" as const,
  },
  {
    label: "Account",
    path: resolve(`/settings?tab=account`),
    tab: "account",
    icon: "cloud" as const,
  },
  {
    label: "Display",
    path: resolve(`/settings?tab=display`),
    tab: "display",
    icon: "monitor" as const,
  },
] as const;

export const mainLinks = [
  { label: "Teams", path: teamsPath, match: "prefix" as const },
  { label: "Characters", path: charactersPath, match: "prefix" as const },
] as const;

export type ToolsLink = (typeof toolsLinks)[number];
export type SettingsLink = (typeof settingsLinks)[number];
export type MainLink = (typeof mainLinks)[number];

export function isPathActive(
  pathname: string,
  path: string,
  match: "exact" | "prefix",
): boolean {
  if (match === "exact") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function isMainLinkActive(pathname: string, link: MainLink): boolean {
  return isPathActive(pathname, link.path, link.match);
}

export function isToolLinkActive(pathname: string, link: ToolsLink): boolean {
  return isPathActive(pathname, link.path, link.match);
}

export function isToolsPage(pathname: string): boolean {
  return isPathActive(pathname, toolsPrefixPath, "prefix");
}

export function isSettingsPage(pathname: string): boolean {
  return isPathActive(pathname, settingsPath, "prefix");
}

/** Settings drawer/submenu tab; missing `tab` defaults to roster. */
export function settingsTabFromSearch(searchParams: URLSearchParams): string {
  return searchParams.get("tab") ?? "roster";
}
