/**
 * Run: pnpm exec tsx --test src/lib/data/artifacts.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import artifacts from "./artifacts.json" with { type: "json" };

const EQUIP_TYPES = new Set([
  "Flower of Life",
  "Plume of Death",
  "Sands of Eon",
  "Goblet of Eonothem",
  "Circlet of Logos",
]);

describe("artifacts.json", () => {
  it("has unique ids and typed piece fields", () => {
    assert.ok(Array.isArray(artifacts));
    assert.ok(artifacts.length > 0);

    const seen = new Set<number>();
    for (const row of artifacts) {
      assert.equal(typeof row, "object");
      assert.ok(row && !Array.isArray(row));

      const { id, stars, equipType, setId, setName, icon } = row as {
        id: unknown;
        stars: unknown;
        equipType: unknown;
        setId: unknown;
        setName: unknown;
        icon: unknown;
      };

      assert.equal(typeof id, "number");
      assert.ok(Number.isSafeInteger(id));
      assert.equal(seen.has(id as number), false, `duplicate artifact id ${id}`);
      seen.add(id as number);

      assert.equal(typeof stars, "number");
      assert.ok(Number.isSafeInteger(stars));
      assert.ok((stars as number) >= 1 && (stars as number) <= 5);

      assert.equal(typeof equipType, "string");
      assert.ok(EQUIP_TYPES.has(equipType as string), `bad equipType ${equipType}`);

      assert.equal(typeof setId, "number");
      assert.ok(Number.isSafeInteger(setId));

      assert.equal(typeof setName, "string");
      assert.ok((setName as string).length > 0);

      assert.equal(typeof icon, "string");
      assert.ok((icon as string).length > 0);
    }
  });
});
