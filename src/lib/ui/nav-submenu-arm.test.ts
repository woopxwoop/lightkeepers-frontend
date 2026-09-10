/**
 * Run: pnpm exec tsx --test src/lib/ui/nav-submenu-arm.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldArmSubmenuFirstActivation } from "./nav-submenu-arm.ts";

describe("shouldArmSubmenuFirstActivation", () => {
  it("arms on first touch click", () => {
    assert.equal(
      shouldArmSubmenuFirstActivation({
        pointerType: "touch",
        clickDetail: 1,
        alreadyArmed: false,
      }),
      true,
    );
  });

  it("does not arm a second touch once already armed", () => {
    assert.equal(
      shouldArmSubmenuFirstActivation({
        pointerType: "touch",
        clickDetail: 1,
        alreadyArmed: true,
      }),
      false,
    );
  });

  it("bypasses hybrid mouse activation", () => {
    assert.equal(
      shouldArmSubmenuFirstActivation({
        pointerType: "mouse",
        clickDetail: 1,
        alreadyArmed: false,
      }),
      false,
    );
  });

  it("bypasses keyboard activation (detail 0)", () => {
    assert.equal(
      shouldArmSubmenuFirstActivation({
        pointerType: "touch",
        clickDetail: 0,
        alreadyArmed: false,
      }),
      false,
    );
    assert.equal(
      shouldArmSubmenuFirstActivation({
        pointerType: null,
        clickDetail: 0,
        alreadyArmed: false,
      }),
      false,
    );
  });

  it("does not arm pen or missing pointer type", () => {
    assert.equal(
      shouldArmSubmenuFirstActivation({
        pointerType: "pen",
        clickDetail: 1,
        alreadyArmed: false,
      }),
      false,
    );
    assert.equal(
      shouldArmSubmenuFirstActivation({
        pointerType: null,
        clickDetail: 1,
        alreadyArmed: false,
      }),
      false,
    );
  });
});
