/**
 * Run: pnpm exec tsx --test src/lib/server/team-config.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRotationSample, readBoundedResponseBody } from "./team-config.ts";

const MAX = 512 * 1024;

function streamBody(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[i]!);
      i += 1;
    },
  });
}

describe("readBoundedResponseBody", () => {
  it("buffers a streamed response within the limit", async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const res = new Response(streamBody([payload.slice(0, 2), payload.slice(2)]));
    const buf = await readBoundedResponseBody(res, MAX);
    assert.ok(buf);
    assert.deepEqual([...buf!], [...payload]);
  });

  it("rejects Content-Length over the limit without reading the body", async () => {
    let cancelCalls = 0;
    const body = new ReadableStream<Uint8Array>({
      start() {
        /* unused — rejected via Content-Length before read */
      },
      cancel() {
        cancelCalls += 1;
      },
    });
    const res = new Response(body, {
      headers: { "content-length": String(MAX + 1) },
    });
    const buf = await readBoundedResponseBody(res, MAX);
    assert.equal(buf, null);
    assert.equal(cancelCalls, 1);
  });

  it("stops a streamed response once accumulated bytes exceed the limit", async () => {
    let cancelCalls = 0;
    const chunk = new Uint8Array(256 * 1024);
    let i = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (i >= 3) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
        i += 1;
      },
      cancel() {
        cancelCalls += 1;
      },
    });
    const res = new Response(body);
    const buf = await readBoundedResponseBody(res, MAX);
    assert.equal(buf, null);
    assert.equal(cancelCalls, 1);
  });

  it("raises AbortError when abort resolves a pending read as done", async () => {
    const ac = new AbortController();
    let releaseSecondRead!: () => void;
    const secondReadGate = new Promise<void>((resolve) => {
      releaseSecondRead = resolve;
    });
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          return;
        }
        await secondReadGate;
        controller.close();
      },
    });
    const pending = readBoundedResponseBody(new Response(body), MAX, ac.signal);
    // Wait until the second read is pending inside readBoundedResponseBody.
    await new Promise<void>((resolve) => {
      const tick = () => {
        if (pulls >= 2) resolve();
        else setTimeout(tick, 0);
      };
      tick();
    });
    ac.abort();
    releaseSecondRead();
    await assert.rejects(pending, (err: unknown) => {
      assert.ok(err instanceof DOMException);
      assert.equal(err.name, "AbortError");
      return true;
    });
  });
});

const validRotation = {
  seed: "abc",
  sample_dps: 1000,
  target_dps: 1000,
  rel_err: 0,
  attempts: 1,
  duration_s: 20,
  characters: ["HuTao", "Xingqiu"],
  events: [{ t: 0, char: "HuTao", action: "skill" }],
};

describe("parseRotationSample", () => {
  it("keeps original party order for valid character keys", () => {
    const sample = parseRotationSample(validRotation);
    assert.ok(sample);
    assert.deepEqual(sample!.characters, ["HuTao", "Xingqiu"]);
  });

  it("returns null when characters is empty", () => {
    assert.equal(
      parseRotationSample({ ...validRotation, characters: [] }),
      null,
    );
  });

  it("returns null when any character entry is missing or empty", () => {
    assert.equal(
      parseRotationSample({
        ...validRotation,
        characters: ["HuTao", ""],
      }),
      null,
    );
    assert.equal(
      parseRotationSample({
        ...validRotation,
        characters: ["HuTao", 1],
      }),
      null,
    );
  });

  it("returns null when events exceed the rotation event cap", () => {
    const events = Array.from({ length: 4097 }, (_, i) => ({
      t: i,
      char: "HuTao",
      action: "skill",
    }));
    assert.equal(
      parseRotationSample({ ...validRotation, events }),
      null,
    );
  });

  it("skips malformed events, sorts by t, and normalizes unknown actions", () => {
    const sample = parseRotationSample({
      ...validRotation,
      events: [
        { t: 2, char: "Xingqiu", action: "burst" },
        null,
        { t: 1, char: "HuTao", action: "mystery" },
        { t: "nope", char: "HuTao", action: "skill" },
        { t: 0, char: "", action: "skill" },
        { t: 0.5, char: "HuTao", action: "skill" },
      ],
    });
    assert.ok(sample);
    assert.deepEqual(sample!.events, [
      { t: 0.5, char: "HuTao", action: "skill" },
      { t: 1, char: "HuTao", action: "other" },
      { t: 2, char: "Xingqiu", action: "burst" },
    ]);
  });
});
