import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enhanceExtra } from "./character-kit-text.ts";

describe("enhanceExtra", () => {
  it("returns null when enhanced is missing or identical", () => {
    assert.equal(enhanceExtra("base", undefined), null);
    assert.equal(enhanceExtra("base", "base"), null);
  });

  it("extracts a prefix extra after the base description", () => {
    assert.deepEqual(enhanceExtra("Deal DMG.", "Deal DMG.\n\nExtra buff."), {
      mode: "extra",
      text: "Extra buff.",
    });
  });

  it("strips Hoyoverse escaped newlines between base and extra", () => {
    assert.deepEqual(enhanceExtra("Deal DMG.", "Deal DMG.\\n\\nExtra buff."), {
      mode: "extra",
      text: "Extra buff.",
    });
  });

  it("returns null when prefix extra is only separators", () => {
    assert.equal(enhanceExtra("Deal DMG.", "Deal DMG.\\n\\n"), null);
  });

  it("extracts a Hexerei tail when prose rewrites the prefix", () => {
    const enhanced =
      "Rewritten opener that no longer matches.\\n\\nHexerei\\nGrants a buff.";
    assert.deepEqual(enhanceExtra("Original base.", enhanced), {
      mode: "extra",
      text: "Hexerei\\nGrants a buff.",
    });
  });

  it("extracts a Hexerei tail separated by escaped carriage returns", () => {
    const enhanced =
      "Rewritten opener.\\r\\rHexerei\\rGrants a buff.";
    assert.deepEqual(enhanceExtra("Original base.", enhanced), {
      mode: "extra",
      text: "Hexerei\\rGrants a buff.",
    });
  });

  it("extracts a Polestar Field tail and discards prose before the heading", () => {
    const enhanced =
      "Some unrelated rewrite.\\n\\nPolestar Field\\nField effect text.";
    assert.deepEqual(enhanceExtra("Original base.", enhanced), {
      mode: "extra",
      text: "Polestar Field\\nField effect text.",
    });
  });

  it("extracts a Radiance Stellar-Conduct tail (Hexerei family)", () => {
    const enhanced =
      "Rewritten.\\n\\nRadiance: Stellar-Conduct\\nMoonlit buff.";
    assert.deepEqual(enhanceExtra("Base.", enhanced), {
      mode: "extra",
      text: "Radiance: Stellar-Conduct\\nMoonlit buff.",
    });
  });

  it("preserves HTML color wrappers on recognized tail headings", () => {
    const enhanced =
      "Prose before.\\n\\n<color=#FFD780>Hexerei</color>\\nBuff text.";
    assert.deepEqual(enhanceExtra("Base.", enhanced), {
      mode: "extra",
      text: "<color=#FFD780>Hexerei</color>\\nBuff text.",
    });
  });

  it("uses real newlines for tail extraction the same as escaped ones", () => {
    const enhanced = "Prose before.\n\nHexerei\nBuff text.";
    assert.deepEqual(enhanceExtra("Base.", enhanced), {
      mode: "extra",
      text: "Hexerei\nBuff text.",
    });
  });

  it("matches CRLF separator runs as CR then LF", () => {
    const enhanced = "Prose before.\r\n\r\nHexerei\r\nBuff text.";
    assert.deepEqual(enhanceExtra("Base.", enhanced), {
      mode: "extra",
      text: "Hexerei\r\nBuff text.",
    });
  });

  it("replaces fully when enhanced neither prefixes nor has a known tail", () => {
    assert.deepEqual(enhanceExtra("Old text.", "Completely different."), {
      mode: "replace",
      text: "Completely different.",
    });
  });
});
