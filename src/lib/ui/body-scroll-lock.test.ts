/**
 * Run: pnpm exec tsx --test src/lib/ui/body-scroll-lock.test.ts
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  acquireBodyScrollLock,
  clearOrphanBodyScrollLock,
} from "./body-scroll-lock.ts";

const OWNER_ATTR = "data-lk-body-scroll-lock";

type MockBody = {
  style: { overflow: string };
  hasAttribute: (name: string) => boolean;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
};

function installMockBody(initialOverflow = ""): MockBody {
  const attrs = new Map<string, string>();
  const body: MockBody = {
    style: { overflow: initialOverflow },
    hasAttribute: (name) => attrs.has(name),
    getAttribute: (name) => (attrs.has(name) ? attrs.get(name)! : null),
    setAttribute: (name, value) => {
      attrs.set(name, value);
    },
    removeAttribute: (name) => {
      attrs.delete(name);
    },
  };
  (globalThis as { document?: { body: MockBody } }).document = { body };
  return body;
}

function clearDocument(): void {
  delete (globalThis as { document?: unknown }).document;
}

describe("acquireBodyScrollLock / clearOrphanBodyScrollLock", () => {
  let body: MockBody;

  beforeEach(() => {
    body = installMockBody("");
  });

  afterEach(() => {
    // Drain any leftover depth from a failed assertion.
    for (let i = 0; i < 8; i++) {
      clearOrphanBodyScrollLock();
      if (!body.hasAttribute(OWNER_ATTR) && body.style.overflow !== "hidden") {
        break;
      }
      // Force-release via orphan path only works at depth 0; acquire+release pairs
      // above leave depth non-zero — call release from prior tests carefully.
      body.removeAttribute(OWNER_ATTR);
      body.style.overflow = "";
    }
    clearDocument();
  });

  it("restores overflow only after the final nested release", () => {
    body.style.overflow = "auto";
    const releaseOuter = acquireBodyScrollLock();
    const releaseInner = acquireBodyScrollLock();
    assert.equal(body.style.overflow, "hidden");
    assert.equal(body.hasAttribute(OWNER_ATTR), true);

    releaseInner();
    assert.equal(body.style.overflow, "hidden");

    releaseOuter();
    assert.equal(body.style.overflow, "auto");
    assert.equal(body.hasAttribute(OWNER_ATTR), false);
  });

  it("ignores a second call to the same release", () => {
    body.style.overflow = "scroll";
    const release = acquireBodyScrollLock();
    release();
    assert.equal(body.style.overflow, "scroll");
    release();
    assert.equal(body.style.overflow, "scroll");
    assert.equal(body.hasAttribute(OWNER_ATTR), false);
  });

  it("reuses a stale ownership marker instead of treating hidden as original", () => {
    body.setAttribute(OWNER_ATTR, "auto");
    body.style.overflow = "hidden";
    const release = acquireBodyScrollLock();
    assert.equal(body.style.overflow, "hidden");
    release();
    assert.equal(body.style.overflow, "auto");
    assert.equal(body.hasAttribute(OWNER_ATTR), false);
  });

  it("clearOrphanBodyScrollLock does nothing while lockDepth is above zero", () => {
    body.style.overflow = "auto";
    const release = acquireBodyScrollLock();
    clearOrphanBodyScrollLock();
    assert.equal(body.style.overflow, "hidden");
    assert.equal(body.hasAttribute(OWNER_ATTR), true);
    release();
    assert.equal(body.style.overflow, "auto");
  });

  it("clearOrphanBodyScrollLock restores when depth is zero with a leftover marker", () => {
    body.setAttribute(OWNER_ATTR, "scroll");
    body.style.overflow = "hidden";
    clearOrphanBodyScrollLock();
    assert.equal(body.style.overflow, "scroll");
    assert.equal(body.hasAttribute(OWNER_ATTR), false);
  });
});
