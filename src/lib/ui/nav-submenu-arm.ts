/**
 * First-tap submenu arming for desktop Tools/Settings links.
 * Only genuine touch activations arm; mouse and keyboard navigate normally.
 */

export function shouldArmSubmenuFirstActivation(input: {
  /** `PointerEvent.pointerType` from the initiating pointerdown, if any. */
  pointerType: string | null | undefined;
  /** `MouseEvent.detail` on click — 0 is keyboard / synthetic activation. */
  clickDetail: number;
  alreadyArmed: boolean;
}): boolean {
  if (input.alreadyArmed) return false;
  if (input.clickDetail === 0) return false;
  return input.pointerType === "touch";
}
