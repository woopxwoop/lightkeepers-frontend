import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RotationSampleEvent } from "$lib/types/investment";
import {
  collapseRotationEvents,
  formatCollapsedActionLabel,
  formatRotationPlaintext,
  rotationHasSetupPrefix,
  rotationSegmentLabel,
  jamKqmTokens,
  compressKqmRepeats,
  eventsForCharacter,
  rotationTimeFrac,
  layoutRotationMarkers,
  markersForCharacter,
  layoutFieldOccupancy,
  spansForCharacter,
  fieldHandoffPath,
  markerCenterX,
  swapIncomingChar,
  sliceRotationWindow,
  loopBoundaryLeftPx,
  loopBoundaryLeftPxs,
  rotationAxisBands,
  findBestSwapCycle,
  detectRotationWindow,
  DEFAULT_ROTATION_WINDOW_S,
  type CollapsedRotationEvent,
} from "$lib/rotation-timeline";

function ev(
  partial: Partial<RotationSampleEvent> &
    Pick<RotationSampleEvent, "t" | "char" | "action">,
): RotationSampleEvent {
  return partial;
}

describe("collapseRotationEvents", () => {
  it("merges consecutive same-char attacks into one counted marker", () => {
    const collapsed = collapseRotationEvents([
      ev({ t: 1, char: "Flins", action: "attack" }),
      ev({ t: 1.2, char: "Flins", action: "attack" }),
      ev({ t: 1.4, char: "Flins", action: "attack" }),
      ev({ t: 1.6, char: "Flins", action: "attack" }),
      ev({ t: 2, char: "Flins", action: "skill" }),
    ]);
    assert.equal(collapsed.length, 2);
    assert.deepEqual(collapsed[0], {
      t: 1,
      char: "Flins",
      action: "attack",
      count: 4,
    });
    assert.deepEqual(collapsed[1], {
      t: 2,
      char: "Flins",
      action: "skill",
      count: 1,
    });
  });

  it("does not merge across character changes", () => {
    const collapsed = collapseRotationEvents([
      ev({ t: 1, char: "Flins", action: "attack" }),
      ev({ t: 1.2, char: "Fischl", action: "attack" }),
      ev({ t: 1.4, char: "Flins", action: "attack" }),
    ]);
    assert.equal(collapsed.length, 3);
    assert.equal(collapsed[0]!.count, 1);
    assert.equal(collapsed[1]!.count, 1);
    assert.equal(collapsed[2]!.count, 1);
  });

  it("drops wait/delay/other from the swimlane", () => {
    const collapsed = collapseRotationEvents([
      ev({ t: 1, char: "Xiao", action: "jump" }),
      ev({ t: 1.1, char: "Xiao", action: "wait" }),
      ev({ t: 1.2, char: "Xiao", action: "delay" }),
      ev({ t: 1.3, char: "Xiao", action: "other" }),
      ev({ t: 1.4, char: "Xiao", action: "high_plunge" }),
    ]);
    assert.deepEqual(
      collapsed.map((e) => e.action),
      ["jump", "high_plunge"],
    );
  });

  it("keeps swap runs separate when labels differ", () => {
    const collapsed = collapseRotationEvents([
      ev({ t: 1, char: "Flins", action: "swap", label: "Fischl" }),
      ev({ t: 2, char: "Flins", action: "swap", label: "Sucrose" }),
      ev({ t: 3, char: "Flins", action: "swap", label: "Sucrose" }),
    ]);
    assert.equal(collapsed.length, 2);
    assert.equal(collapsed[0]!.count, 1);
    assert.equal(collapsed[1]!.count, 2);
    assert.equal(collapsed[1]!.label, "Sucrose");
  });
});

describe("formatCollapsedActionLabel", () => {
  it("appends count only when greater than one", () => {
    assert.equal(formatCollapsedActionLabel("attack", 1), "N");
    assert.equal(formatCollapsedActionLabel("attack", 4), "N4");
    assert.equal(formatCollapsedActionLabel("skill", 1), "E");
    assert.equal(formatCollapsedActionLabel("hold_skill", 1), "hE");
    assert.equal(formatCollapsedActionLabel("hold_skill", 2), "hE2");
    assert.equal(formatCollapsedActionLabel("burst", 2), "Q2");
    assert.equal(formatCollapsedActionLabel("low_plunge", 1), "lP");
    assert.equal(formatCollapsedActionLabel("high_plunge", 2), "hP2");
    assert.equal(formatCollapsedActionLabel("walk", 12), "W");
  });
});

describe("formatRotationPlaintext", () => {
  it("formats compact KQM notation with jams and repeats", () => {
    const collapsed = collapseRotationEvents([
      { t: 1, char: "Arlecchino", action: "skill" },
      { t: 2, char: "Bennett", action: "swap", label: "Bennett" },
      { t: 2, char: "Bennett", action: "skill" },
      { t: 3, char: "Xilonen", action: "swap", label: "Xilonen" },
      { t: 3, char: "Xilonen", action: "skill" },
      { t: 4, char: "Xilonen", action: "attack" },
      { t: 4.1, char: "Xilonen", action: "attack" },
      { t: 5, char: "Yelan", action: "swap", label: "Yelan" },
      { t: 5, char: "Yelan", action: "skill" },
      { t: 5.5, char: "Yelan", action: "burst" },
      { t: 6, char: "Bennett", action: "swap", label: "Bennett" },
      { t: 6, char: "Bennett", action: "burst" },
      { t: 7, char: "Bennett", action: "attack" },
      { t: 8, char: "Arlecchino", action: "swap", label: "Arlecchino" },
      { t: 8, char: "Arlecchino", action: "attack" },
      { t: 8.1, char: "Arlecchino", action: "attack" },
      { t: 8.2, char: "Arlecchino", action: "attack" },
      { t: 8.5, char: "Arlecchino", action: "charge" },
      // 5× N3D
      ...Array.from({ length: 5 }, (_, k) => [
        {
          t: 9 + k,
          char: "Arlecchino",
          action: "attack" as const,
        },
        {
          t: 9.1 + k,
          char: "Arlecchino",
          action: "attack" as const,
        },
        {
          t: 9.2 + k,
          char: "Arlecchino",
          action: "attack" as const,
        },
        { t: 9.5 + k, char: "Arlecchino", action: "dash" as const },
      ]).flat(),
      { t: 20, char: "Arlecchino", action: "attack" },
    ]);
    assert.deepEqual(
      formatRotationPlaintext(collapsed),
      [
        "Arlecchino E > Bennett E > Xilonen E N2 > Yelan EQ > Bennett Q N1 > Arlecchino N3C 5[N3D] N1",
      ],
    );
  });

  it("emits plunge abbreviations and omits wait/delay/other", () => {
    const collapsed = collapseRotationEvents([
      { t: 1, char: "Xiao", action: "jump" },
      { t: 1.1, char: "Xiao", action: "wait" },
      { t: 1.15, char: "Xiao", action: "delay" },
      { t: 1.18, char: "Xiao", action: "other" },
      { t: 1.2, char: "Xiao", action: "high_plunge" },
      { t: 2, char: "Xiao", action: "low_plunge" },
    ]);
    assert.deepEqual(formatRotationPlaintext(collapsed), ["Xiao J hP lP"]);
  });

  it("collapses walk-frame runs to a single W", () => {
    const collapsed = collapseRotationEvents([
      { t: 1, char: "Neuvillette", action: "charge" },
      ...Array.from({ length: 8 }, (_, i) => ({
        t: 1.2 + i * 0.05,
        char: "Neuvillette",
        action: "walk" as const,
      })),
      { t: 2, char: "Neuvillette", action: "charge" },
    ]);
    assert.equal(formatCollapsedActionLabel("walk", collapsed[1]!.count), "W");
    assert.deepEqual(formatRotationPlaintext(collapsed), [
      "Neuvillette C W C",
    ]);
  });

  it("keeps hold E distinct from tap E", () => {
    const collapsed = collapseRotationEvents([
      { t: 1, char: "Nahida", action: "skill" },
      { t: 2, char: "Lauma", action: "hold_skill" },
      { t: 3, char: "Lauma", action: "burst" },
    ]);
    assert.deepEqual(
      collapsed.map((e) => `${e.action}:${e.count}`),
      ["skill:1", "hold_skill:1", "burst:1"],
    );
    assert.deepEqual(formatRotationPlaintext(collapsed), [
      "Nahida E > Lauma hEQ",
    ]);
  });

  it("splits each subsequent rotation onto its own line", () => {
    const collapsed = collapseRotationEvents([
      { t: 1, char: "Nahida", action: "attack" },
      { t: 2, char: "RaidenShogun", action: "swap", label: "RaidenShogun" },
      { t: 2, char: "RaidenShogun", action: "skill" },
      { t: 3, char: "Xingqiu", action: "swap", label: "Xingqiu" },
      { t: 3, char: "Xingqiu", action: "skill" },
      { t: 12, char: "RaidenShogun", action: "swap", label: "RaidenShogun" },
      { t: 12, char: "RaidenShogun", action: "burst" },
      { t: 14, char: "Xingqiu", action: "swap", label: "Xingqiu" },
      { t: 14, char: "Xingqiu", action: "skill" },
      { t: 15, char: "Nahida", action: "swap", label: "Nahida" },
      { t: 15, char: "Nahida", action: "skill" },
      { t: 28, char: "Xingqiu", action: "swap", label: "Xingqiu" },
      { t: 28, char: "Xingqiu", action: "skill" },
    ]);
    assert.deepEqual(
      formatRotationPlaintext(collapsed, {
        resolveName: (k) => (k === "RaidenShogun" ? "Raiden" : k),
        loopEndsS: [3, 14, 28],
      }),
      [
        "Nahida N1 > Raiden E",
        "Xingqiu E > Raiden Q",
        "Xingqiu E > Nahida E",
        "Xingqiu E",
      ],
    );
  });
});

describe("rotationSegmentLabel", () => {
  it("labels setup then numbered rotations", () => {
    assert.equal(rotationSegmentLabel(0, true), "setup");
    assert.equal(rotationSegmentLabel(1, true), "rotation 1");
    assert.equal(rotationSegmentLabel(2, true), "rotation 2");
    assert.equal(rotationSegmentLabel(0, false), "rotation 1");
    assert.equal(rotationSegmentLabel(1, false), "rotation 2");
  });

  it("detects a setup cut before the first loop end", () => {
    assert.equal(rotationHasSetupPrefix(14, [2, 14, 26]), true);
    assert.equal(rotationHasSetupPrefix(14, [14, 26]), false);
    assert.equal(rotationHasSetupPrefix(null, []), false);
  });
});

describe("jamKqmTokens / compressKqmRepeats", () => {
  it("jams cancel combos and compresses repeats", () => {
    assert.deepEqual(jamKqmTokens(["N3", "C", "N3", "D", "E", "Q"]), [
      "N3C",
      "N3D",
      "EQ",
    ]);
    assert.deepEqual(jamKqmTokens(["hE", "Q"]), ["hEQ"]);
    assert.deepEqual(compressKqmRepeats(["N3D", "N3D", "N3D", "N1"]), [
      "3[N3D]",
      "N1",
    ]);
    assert.deepEqual(compressKqmRepeats(["W", "W", "W"]), ["W"]);
  });
});

describe("eventsForCharacter", () => {
  it("filters collapsed events to one lane", () => {
    const collapsed = collapseRotationEvents([
      ev({ t: 1, char: "Flins", action: "skill" }),
      ev({ t: 2, char: "Fischl", action: "burst" }),
      ev({ t: 3, char: "Flins", action: "dash" }),
    ]);
    const lane = eventsForCharacter(collapsed, "Flins");
    assert.equal(lane.length, 2);
    assert.equal(lane[0]!.action, "skill");
    assert.equal(lane[1]!.action, "dash");
  });
});

describe("rotationTimeFrac", () => {
  it("clamps to the unit interval", () => {
    assert.equal(rotationTimeFrac(0, 100), 0);
    assert.equal(rotationTimeFrac(50, 100), 0.5);
    assert.equal(rotationTimeFrac(100, 100), 1);
    assert.equal(rotationTimeFrac(-1, 100), 0);
    assert.equal(rotationTimeFrac(120, 100), 1);
    assert.equal(rotationTimeFrac(50, 0), 0);
  });
});

describe("layoutRotationMarkers", () => {
  it("fits a short first rotation into the viewport and extends for later events", () => {
    const raw = [
      { t: 1.0, char: "Flins", action: "skill" as const },
      { t: 1.05, char: "Fischl", action: "burst" as const },
      { t: 2.0, char: "Flins", action: "attack" as const },
      { t: 30.0, char: "Flins", action: "dash" as const },
      { t: 31.0, char: "Fischl", action: "skill" as const },
    ];
    const { markers, trackWidthPx } = layoutRotationMarkers(
      collapseRotationEvents(raw),
      100,
      { viewportWidthPx: 600, fitThroughT: 2 },
    );
    assert.equal(markers.length, 5);
    const glanceRight = markers[2]!.leftPx + markers[2]!.widthPx;
    assert.ok(Math.abs(glanceRight + 6 - 600) < 1);
    assert.ok(trackWidthPx > 600);
    assert.ok(markers[0]!.leftPx < markers[1]!.leftPx);
    assert.ok(markers[2]!.leftPx < markers[3]!.leftPx);
    assert.ok(markers[4]!.leftPx > 600);
  });

  it("does not overlap chips when the first rotation is denser than the viewport", () => {
    const raw = Array.from({ length: 24 }, (_, i) => ({
      t: i * 0.4,
      char: i % 2 === 0 ? "Varesa" : "Durin",
      action: "skill" as const,
    }));
    const { markers, trackWidthPx } = layoutRotationMarkers(
      collapseRotationEvents(raw),
      20,
      { viewportWidthPx: 240, fitThroughT: 20 },
    );
    assert.ok(trackWidthPx > 240);
    for (let i = 1; i < markers.length; i++) {
      assert.ok(
        markers[i]!.leftPx >= markers[i - 1]!.leftPx + markers[i - 1]!.widthPx,
      );
    }
  });

  it("keeps global order across characters", () => {
    const raw = [
      { t: 1.0, char: "Flins", action: "skill" as const },
      { t: 1.05, char: "Fischl", action: "burst" as const },
      { t: 2.0, char: "Flins", action: "attack" as const },
    ];
    const { markers } = layoutRotationMarkers(collapseRotationEvents(raw), 20, {
      viewportWidthPx: 600,
      fitThroughT: 20,
    });
    const flins = markersForCharacter(markers, "Flins");
    const fischl = markersForCharacter(markers, "Fischl");
    assert.ok(flins[0]!.leftPx < fischl[0]!.leftPx);
    assert.ok(fischl[0]!.leftPx < flins[1]!.leftPx);
  });
});

describe("sliceRotationWindow", () => {
  it("keeps events in [startS, endS] inclusive for object windows", () => {
    const collapsed = collapseRotationEvents([
      { t: 1, char: "A", action: "skill" },
      { t: 10, char: "A", action: "burst" },
      { t: 19, char: "A", action: "dash" },
      { t: 20, char: "A", action: "swap", label: "Xingqiu" },
      { t: 50, char: "B", action: "skill" },
    ]);
    const sliced = sliceRotationWindow(collapsed, { startS: 10, endS: 20 });
    assert.equal(sliced.length, 3);
    assert.ok(sliced.every((e) => e.t >= 10 && e.t <= 20));
    assert.equal(sliced[2]!.action, "swap");
  });

  it("keeps [0, endS) for numeric windows", () => {
    const collapsed = collapseRotationEvents([
      { t: 1, char: "A", action: "skill" },
      { t: 19, char: "A", action: "dash" },
      { t: 20, char: "A", action: "attack" },
    ]);
    const sliced = sliceRotationWindow(collapsed, 20);
    assert.equal(sliced.length, 2);
    assert.ok(sliced.every((e) => e.t < 20));
  });
});

describe("findBestSwapCycle", () => {
  it("skips a setup prefix and finds the stable loop", () => {
    // nahida -> raiden -> xingqiu -> nahida -> lauma -> raiden -> nahida -> lauma -> raiden
    const targets = [
      "nahida",
      "raiden",
      "xingqiu",
      "nahida",
      "lauma",
      "raiden",
      "nahida",
      "lauma",
      "raiden",
    ];
    const best = findBestSwapCycle(targets);
    assert.ok(best);
    assert.equal(best!.startIndex, 3);
    assert.equal(best!.period, 3);
    assert.ok(best!.periods >= 2);
  });

  it("prefers the longer cycle when setup share the loop-end character", () => {
    // raiden skill (setup) then xq/nahida/lauma/raiden×N — same names as
    // (R,X,N,L)* but the real loop is X,N,L,R (includes Raiden field time).
    const targets = [
      "raiden",
      "xingqiu",
      "nahida",
      "lauma",
      "raiden",
      "xingqiu",
      "nahida",
      "lauma",
      "raiden",
      "xingqiu",
      "nahida",
      "lauma",
    ];
    // Short RXNL: 1→5s (4s). Long XNLR with Raiden NAs: 2→14s (12s).
    const times = [1, 2, 4, 6, 8, 14, 16, 18, 20, 26, 28, 30];
    const best = findBestSwapCycle(targets, times);
    assert.ok(best);
    assert.equal(best!.startIndex, 1);
    assert.equal(best!.period, 4);
  });

  it("does not treat two loops as one long period", () => {
    // Real Lauma/Nahida/Raiden/XQ swap times (setup R then XNLR×…).
    const targets = [
      "raidenshogun",
      "xingqiu",
      "nahida",
      "lauma",
      "raidenshogun",
      "xingqiu",
      "nahida",
      "lauma",
      "raidenshogun",
      "xingqiu",
      "nahida",
      "lauma",
      "raidenshogun",
      "xingqiu",
    ];
    const times = [
      0.567, 1.767, 3.817, 8.117, 12.25, 23.433, 25.483, 29.783, 33.917,
      45.1, 47.15, 51.45, 55.583, 66.767,
    ];
    const best = findBestSwapCycle(targets, times);
    assert.ok(best);
    assert.equal(best!.period, 4);
    assert.equal(best!.startIndex, 1);
  });

  it("still finds a cycle that starts at index 0", () => {
    assert.equal(
      findBestSwapCycle([
        "fischl",
        "sucrose",
        "flins",
        "aino",
        "fischl",
        "sucrose",
        "flins",
        "aino",
      ])?.period ?? null,
      4,
    );
  });
});

describe("detectRotationWindow", () => {
  it("includes setup from t=0 through end of first full loop", () => {
    // Setup N→R→X, then loop N→L→R→N→L→R
    const events = [
      { t: 1, char: "A", action: "swap" as const, label: "Nahida" },
      { t: 4, char: "A", action: "swap" as const, label: "Raiden" },
      { t: 8, char: "A", action: "swap" as const, label: "Xingqiu" },
      { t: 12, char: "A", action: "swap" as const, label: "Nahida" },
      { t: 15, char: "A", action: "swap" as const, label: "Lauma" },
      { t: 18, char: "A", action: "swap" as const, label: "Raiden" },
      { t: 22, char: "A", action: "swap" as const, label: "Nahida" },
      { t: 25, char: "A", action: "swap" as const, label: "Lauma" },
      { t: 28, char: "A", action: "swap" as const, label: "Raiden" },
    ];
    const win = detectRotationWindow(events);
    assert.equal(win.startS, 0);
    assert.equal(win.endS, 22);
    assert.equal(win.loopEndS, 22);
    assert.deepEqual(win.loopEndsS, [12, 22]);
    assert.equal(win.period, 3);
  });

  it("ends after Raiden field time, not at the setup Raiden re-entry", () => {
    // Matches: active…; raiden skill; for { xq; nahida; lauma; raiden…skill }
    const events = [
      { t: 0.5, char: "A", action: "swap" as const, label: "Raiden" },
      { t: 2, char: "A", action: "swap" as const, label: "Xingqiu" },
      { t: 4, char: "A", action: "swap" as const, label: "Nahida" },
      { t: 6, char: "A", action: "swap" as const, label: "Lauma" },
      { t: 8, char: "A", action: "swap" as const, label: "Raiden" },
      { t: 14, char: "A", action: "swap" as const, label: "Xingqiu" },
      { t: 16, char: "A", action: "swap" as const, label: "Nahida" },
      { t: 18, char: "A", action: "swap" as const, label: "Lauma" },
      { t: 20, char: "A", action: "swap" as const, label: "Raiden" },
      { t: 26, char: "A", action: "swap" as const, label: "Xingqiu" },
    ];
    const win = detectRotationWindow(events);
    assert.equal(win.startS, 0);
    assert.equal(win.endS, 14);
    assert.equal(win.loopEndS, 14);
    assert.equal(win.loopEndsS[0], 2);
    assert.ok(win.loopEndsS.includes(14));
    assert.equal(win.period, 4);
    const sliced = sliceRotationWindow(
      collapseRotationEvents([
        ...events,
        { t: 14, char: "Xingqiu", action: "swap" as const, label: "Xingqiu" },
      ]),
      win,
    );
    assert.ok(sliced.some((e) => e.action === "swap" && e.t === 14));
  });

  it("falls back when swaps do not form a repeating cycle", () => {
    const events = [
      { t: 1, char: "A", action: "swap" as const, label: "Fischl" },
      { t: 5, char: "A", action: "swap" as const, label: "Sucrose" },
      { t: 10, char: "A", action: "skill" as const },
    ];
    assert.deepEqual(detectRotationWindow(events), {
      startS: 0,
      endS: DEFAULT_ROTATION_WINDOW_S,
      loopEndS: null,
      loopEndsS: [],
      period: null,
    });
    assert.equal(detectRotationWindow(events).endS, DEFAULT_ROTATION_WINDOW_S);
  });

  it("splits an on-field opener as setup when the loop starts at the first swap", () => {
    // active Gaming E lP D; then Xianyun / Bennett / Citlali / Gaming ×N
    const events: RotationSampleEvent[] = [
      { t: 0.02, char: "Gaming", action: "skill" },
      { t: 0.4, char: "Gaming", action: "low_plunge" },
      { t: 0.9, char: "Gaming", action: "dash" },
      { t: 1.5, char: "Gaming", action: "swap", label: "Xianyun" },
      { t: 1.5, char: "Xianyun", action: "skill" },
      { t: 4.5, char: "Xianyun", action: "swap", label: "Bennett" },
      { t: 4.5, char: "Bennett", action: "skill" },
      { t: 6.7, char: "Bennett", action: "swap", label: "Citlali" },
      { t: 6.7, char: "Citlali", action: "skill" },
      { t: 9.4, char: "Citlali", action: "swap", label: "Gaming" },
      { t: 9.4, char: "Gaming", action: "burst" },
      { t: 22.4, char: "Gaming", action: "swap", label: "Xianyun" },
      { t: 22.4, char: "Xianyun", action: "skill" },
      { t: 25.4, char: "Xianyun", action: "swap", label: "Bennett" },
      { t: 25.4, char: "Bennett", action: "skill" },
      { t: 27.3, char: "Bennett", action: "swap", label: "Citlali" },
      { t: 27.3, char: "Citlali", action: "skill" },
      { t: 30.0, char: "Citlali", action: "swap", label: "Gaming" },
      { t: 30.0, char: "Gaming", action: "burst" },
      { t: 43.0, char: "Gaming", action: "swap", label: "Xianyun" },
    ];
    const win = detectRotationWindow(events);
    assert.equal(win.period, 4);
    assert.equal(win.loopEndS, 22.4);
    assert.equal(win.loopEndsS[0], 1.5);
    assert.equal(rotationHasSetupPrefix(win.loopEndS, win.loopEndsS), true);
    const lines = formatRotationPlaintext(collapseRotationEvents(events), {
      loopEndsS: win.loopEndsS,
    });
    assert.equal(lines[0], "Gaming E lP D");
    assert.ok(lines[1]?.startsWith("Xianyun E"));

    const scripted = detectRotationWindow(events, DEFAULT_ROTATION_WINDOW_S, {
      script: `
active gaming;
gaming skill, low_plunge, dash;
for let i=0; i<4; i=i+1 {
  xianyun skill;
  bennett skill;
  citlali skill;
  gaming burst;
}
`,
      characters: ["Gaming", "Xianyun", "Bennett", "Citlali"],
    });
    assert.equal(scripted.loopEndS, 22.4);
    assert.equal(scripted.loopEndsS[0], 1.5);
    assert.equal(rotationHasSetupPrefix(scripted.loopEndS, scripted.loopEndsS), true);
  });

  it("uses the gcsim for body when even/odd swaps do not repeat", () => {
    const flinsScript = `
active ineffa;
for let i=0; i<6; i=i+1 {
  if !is_even(i) {
    ineffa skill, burst;
    bina skill, attack;
  } else {
    ineffa skill;
    if i {
      ineffa attack;
      sucrose attack:2, charge;
      bina attack;
    }
    bina skill, burst;
  }
  sucrose attack, skill, dash;
  flins skill;
}
`;
    const party = ["Columbina", "Flins", "Ineffa", "Sucrose"];
    const events: RotationSampleEvent[] = [
      { t: 0.0, char: "Ineffa", action: "skill" },
      { t: 1.0, char: "Columbina", action: "skill" },
      { t: 1.2, char: "Columbina", action: "burst" },
      { t: 2.0, char: "Sucrose", action: "attack" },
      { t: 2.1, char: "Sucrose", action: "skill" },
      { t: 2.2, char: "Sucrose", action: "dash" },
      { t: 3.0, char: "Flins", action: "skill" },
      { t: 16.0, char: "Ineffa", action: "skill" },
      { t: 16.1, char: "Ineffa", action: "burst" },
      { t: 17.0, char: "Columbina", action: "skill" },
      { t: 17.1, char: "Columbina", action: "attack" },
      { t: 18.0, char: "Sucrose", action: "attack" },
      { t: 18.1, char: "Sucrose", action: "skill" },
      { t: 18.2, char: "Sucrose", action: "dash" },
      { t: 19.0, char: "Flins", action: "skill" },
      { t: 32.0, char: "Ineffa", action: "skill" },
      { t: 32.1, char: "Ineffa", action: "attack" },
      { t: 32.2, char: "Sucrose", action: "attack" },
      { t: 32.3, char: "Sucrose", action: "attack" },
      { t: 32.4, char: "Sucrose", action: "charge" },
      { t: 32.5, char: "Columbina", action: "attack" },
      { t: 33.0, char: "Columbina", action: "skill" },
      { t: 33.1, char: "Columbina", action: "burst" },
      { t: 34.0, char: "Sucrose", action: "attack" },
      { t: 34.1, char: "Sucrose", action: "skill" },
      { t: 34.2, char: "Sucrose", action: "dash" },
      { t: 35.0, char: "Flins", action: "skill" },
    ];
    const win = detectRotationWindow(events, DEFAULT_ROTATION_WINDOW_S, {
      script: flinsScript,
      characters: party,
    });
    assert.equal(win.startS, 0);
    assert.equal(win.endS, 16);
    assert.equal(win.loopEndS, 16);
    assert.deepEqual(win.loopEndsS, [16, 32]);
    assert.equal(rotationHasSetupPrefix(win.loopEndS, win.loopEndsS), false);
    const lines = formatRotationPlaintext(collapseRotationEvents(events), {
      loopEndsS: win.loopEndsS,
    });
    assert.ok(lines[0]?.startsWith("Ineffa E"));
  });

  it("keeps swap-cycle cuts when the script cannot be aligned", () => {
    const events: RotationSampleEvent[] = [
      { t: 0.02, char: "Gaming", action: "skill" },
      { t: 0.4, char: "Gaming", action: "low_plunge" },
      { t: 0.9, char: "Gaming", action: "dash" },
      { t: 1.5, char: "Gaming", action: "swap", label: "Xianyun" },
      { t: 1.5, char: "Xianyun", action: "skill" },
      { t: 4.5, char: "Xianyun", action: "swap", label: "Bennett" },
      { t: 4.5, char: "Bennett", action: "skill" },
      { t: 6.7, char: "Bennett", action: "swap", label: "Citlali" },
      { t: 6.7, char: "Citlali", action: "skill" },
      { t: 9.4, char: "Citlali", action: "swap", label: "Gaming" },
      { t: 9.4, char: "Gaming", action: "burst" },
      { t: 22.4, char: "Gaming", action: "swap", label: "Xianyun" },
      { t: 22.4, char: "Xianyun", action: "skill" },
      { t: 25.4, char: "Xianyun", action: "swap", label: "Bennett" },
      { t: 25.4, char: "Bennett", action: "skill" },
      { t: 27.3, char: "Bennett", action: "swap", label: "Citlali" },
      { t: 27.3, char: "Citlali", action: "skill" },
      { t: 30.0, char: "Citlali", action: "swap", label: "Gaming" },
      { t: 30.0, char: "Gaming", action: "burst" },
      { t: 43.0, char: "Gaming", action: "swap", label: "Xianyun" },
    ];
    const win = detectRotationWindow(events, DEFAULT_ROTATION_WINDOW_S, {
      script: "active fischl;\nfor let i=0; i<4; i=i+1 { fischl skill; }\n",
      characters: ["Gaming", "Xianyun", "Bennett", "Citlali"],
    });
    assert.equal(win.period, 4);
    assert.equal(win.loopEndS, 22.4);
    assert.equal(win.loopEndsS[0], 1.5);
  });
});

describe("loopBoundaryLeftPx", () => {
  it("places the divider just after the last in-period action chip", () => {
    const markers = [
      {
        leftPx: 10,
        widthPx: 20,
        event: { t: 1, char: "A", action: "attack" as const, count: 1 },
        label: "N",
      },
      {
        leftPx: 100,
        widthPx: 24,
        event: { t: 10, char: "A", action: "skill" as const, count: 1 },
        label: "E",
      },
      {
        leftPx: 200,
        widthPx: 30,
        event: {
          t: 14,
          char: "Xingqiu",
          action: "swap" as const,
          label: "Xingqiu",
          count: 1,
        },
        label: "Swap",
      },
    ];
    assert.equal(loopBoundaryLeftPx(markers, 14), 127);
    assert.deepEqual(loopBoundaryLeftPxs(markers, [14]), [127]);
  });
});

describe("layoutFieldOccupancy", () => {
  function mark(
    leftPx: number,
    event: RotationSampleEvent,
    widthPx = 20,
  ): {
    leftPx: number;
    widthPx: number;
    event: CollapsedRotationEvent;
    label: string;
  } {
    return {
      leftPx,
      widthPx,
      event: { ...event, count: 1 },
      label: event.action === "swap" ? "Swap" : "x",
    };
  }

  it("paints from t=0 through each swap, ignoring off-field actions", () => {
    const markers = [
      mark(0, ev({ t: 1, char: "Nahida", action: "attack" })),
      mark(80, ev({ t: 2, char: "Fischl", action: "skill" })),
      mark(100, ev({ t: 3, char: "Raiden", action: "swap", label: "Raiden" })),
      mark(140, ev({ t: 4, char: "Raiden", action: "skill" })),
      mark(200, ev({ t: 5, char: "Xingqiu", action: "swap", label: "Xingqiu" })),
    ];
    const { spans, handoffs } = layoutFieldOccupancy(markers, 400);
    assert.equal(markerCenterX(markers[2]!), 110);
    assert.deepEqual(
      spans.map((s) => ({ char: s.char, left: s.leftPx, w: s.widthPx })),
      [
        { char: "Nahida", left: 0, w: 110 },
        { char: "Raiden", left: 110, w: 100 },
        { char: "Xingqiu", left: 210, w: 190 },
      ],
    );
    assert.deepEqual(
      handoffs.map((h) => ({ from: h.fromChar, to: h.toChar, x: h.xPx })),
      [
        { from: "Nahida", to: "Raiden", x: 110 },
        { from: "Raiden", to: "Xingqiu", x: 210 },
      ],
    );
    assert.equal(spansForCharacter(spans, "Nahida").length, 1);
    assert.equal(spansForCharacter(spans, "Fischl").length, 0);
  });

  it("starts occupancy at a leading swap when no prior action exists", () => {
    const markers = [
      mark(40, ev({ t: 1, char: "Raiden", action: "swap", label: "Raiden" })),
      mark(80, ev({ t: 2, char: "Raiden", action: "skill" })),
    ];
    const { spans, handoffs } = layoutFieldOccupancy(markers, 200);
    assert.deepEqual(
      spans.map((s) => ({ char: s.char, left: s.leftPx, w: s.widthPx })),
      [{ char: "Raiden", left: 50, w: 150 }],
    );
    assert.equal(handoffs.length, 0);
  });

  it("reads the swap target from label", () => {
    assert.equal(
      swapIncomingChar({ action: "swap", char: "A", label: "Xingqiu" }),
      "Xingqiu",
    );
    assert.equal(swapIncomingChar({ action: "skill", char: "A" }), null);
  });
});

describe("fieldHandoffPath", () => {
  it("draws a vertical line between lane centers", () => {
    assert.equal(fieldHandoffPath(110, 0, 2), "M 110 0.5 L 110 2.5");
  });
});

describe("rotationAxisBands", () => {
  it("labels setup then numbered rotations across the track", () => {
    const bands = rotationAxisBands([80, 200], 400, true);
    assert.deepEqual(
      bands.map((b) => ({ left: b.leftPx, w: b.widthPx, label: b.label })),
      [
        { left: 0, w: 80, label: "setup" },
        { left: 80, w: 120, label: "rotation 1" },
        { left: 200, w: 200, label: "rotation 2" },
      ],
    );
  });
});
