/**
 * Kit enhance-text helpers.
 *
 * Enhanced Excel text usually prepends the base desc then appends buff text.
 * Trailing Hexerei / Polestar Field sections often rewrite a sentence or two
 * before the heading, so `startsWith(base)` fails — extract the tail instead.
 * Kit JSON stores Hoyoverse `\\n` as two characters, not a real newline.
 */

/** Trailing Hexerei / Polestar Field section (Hoyoverse `\\n` or real newlines). */
export const ENHANCE_TAIL = new RegExp(
  "((?:\\\\r\\\\n|\\\\n|\\\\r|\\n|\\r)+((?:<color=[^>]+>)?(?:Hexerei|Radiance:\\s*Stellar-Conduct|Polestar Field)\\b[\\s\\S]*))$",
  "i",
);

export const ENHANCE_SEP = /^(?:\r\n|\r|\n|\\r\\n|\\r|\\n)+/;

export type EnhanceExtra = {
  mode: "extra" | "replace";
  text: string;
};

/**
 * Return only the new suffix when enhanced prepends the base; otherwise the
 * full rewrite. Strip separator runs between base and buff on both paths.
 */
export function enhanceExtra(
  base: string,
  enhanced: string | undefined,
): EnhanceExtra | null {
  if (!enhanced || enhanced === base) return null;
  if (enhanced.startsWith(base)) {
    const extra = enhanced.slice(base.length).replace(ENHANCE_SEP, "");
    return extra ? { mode: "extra", text: extra } : null;
  }
  const tail = enhanced.match(ENHANCE_TAIL);
  if (tail?.[1]) {
    const extra = tail[1].replace(ENHANCE_SEP, "");
    return extra ? { mode: "extra", text: extra } : null;
  }
  return { mode: "replace", text: enhanced };
}
