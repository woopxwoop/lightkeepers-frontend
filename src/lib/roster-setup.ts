/**
 * Shared gate for the “configure roster first” empty state.
 * Same inputs as home / Abyss / Stygian / Summary.
 */
export function needsRosterSetup(input: {
  sessionPending: boolean;
  hasSavedRoster: boolean;
  sessionData: unknown;
}): boolean {
  return (
    !input.sessionPending && !input.hasSavedRoster && !input.sessionData
  );
}
