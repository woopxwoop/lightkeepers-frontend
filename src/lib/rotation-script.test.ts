/**
 * Align gcsim `for` bodies (even/odd alts, optional `if`, inner counted
 * loops) to a rotation sample.
 *
 * Run: pnpm exec tsx --test src/lib/rotation-script.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RotationAction, RotationSampleEvent } from "$lib/types/investment";
import {
  applyScriptEventActions,
  matchScriptLoops,
  parseRotationScript,
  resolveScriptChar,
  type ScriptPat,
} from "$lib/rotation-script";

const FLINS_PARTY = ["Columbina", "Flins", "Ineffa", "Sucrose"] as const;

/** Real Columbina–Flins–Ineffa–Sucrose loop (aliases + even/odd + `if i`). */
const FLINS_SCRIPT = `
active ineffa;
for let i=0; i<6; i=i+1 {
  if !is_even(i) {
    ineffa skill, burst;
    bina skill, attack;
  } else {
    ineffa skill;
    if i {
      ineffa attack;
      sucrose swap;
      sucrose attack:2, charge;
      bina attack;
    }
    bina skill, burst;
  }
  if !is_even(i) && .sucrose.burst.ready && .sucrose.energy == .sucrose.energymax {
    sucrose attack, burst;
  } else if .sucrose.skill.ready {
    sucrose swap; wait(8);
    sucrose attack, skill, dash;
  } else {
    sucrose attack, charge;
  }
  flins skill, attack,
        skill, attack, burst,
        attack:4, dash, attack:4, dash, attack:2,
        skill, attack, burst,
        attack:4;
  if .sucrose.skill.ready {
    sucrose attack, skill, dash;
  } else {
    sucrose attack, charge;
  }
}
`;

const GAMING_SCRIPT = `
active gaming;
gaming skill, low_plunge, dash;
for let i=0; i<4; i=i+1 {
  xianyun skill;
  bennett skill;
  citlali skill;
  gaming burst;
}
`;

/** Varesa Chev Durin Fischl — fn + param-bounded inner for + commented else-if. */
const VARESA_SCRIPT = `
fn varesa_combo(amt) {
  for let j = 0; j < amt; j = j + 1 {
    if .varesa.skill.ready {
      varesa skill, attack, high_plunge[collision=1]; # ECP
    //} else if .xianyun.status.xianyun-airborne-buff { # Uncomment if using Xianyun
    //  varesa jump;
    //  if .airborne {
    //    varesa high_plunge[collision=1]; # JP
    //  }
    } else {
      varesa charge, high_plunge[collision=1]; # CP
    }
    if .varesa.energy >= 30 && .varesa.status.apex-drive {
      varesa burst;
    }
  }
}

active varesa;

varesa attack;
for let i=0; i<4; i=i+1 {
  // if .chev.burst.ready && .chev.energy == .chev.energymax {
    chev burst, skill[hold=1];
  // } else {
  //   chev skill[hold=1], attack:2;
  // }
  durin skill, burst, skill;
  if .fischl.skill.ready {
    fischl attack, skill, attack;
  } else {
    fischl attack:2, burst;
    varesa attack;
  }
  varesa_combo(6);
}
`;

const VARESA_PARTY = ["Varesa", "Chevreuse", "Durin", "Fischl"] as const;

function findRepeats(pat: ScriptPat): Extract<ScriptPat, { kind: "repeat" }>[] {
  switch (pat.kind) {
    case "repeat":
      return [pat, ...findRepeats(pat.item)];
    case "repeatParam":
    case "star":
      return findRepeats(pat.item);
    case "seq":
    case "alt":
      return pat.items.flatMap(findRepeats);
    default:
      return [];
  }
}

function stamp(
  t0: number,
  rows: Array<readonly [string, RotationAction, number?]>,
): RotationSampleEvent[] {
  const out: RotationSampleEvent[] = [];
  let t = t0;
  for (const [char, action, n = 1] of rows) {
    for (let k = 0; k < n; k++) {
      out.push({ t, char, action });
      t += 0.05;
    }
  }
  return out;
}

function flinsField(): Array<readonly [string, RotationAction, number?]> {
  return [
    ["Flins", "skill"],
    ["Flins", "attack"],
    ["Flins", "skill"],
    ["Flins", "attack"],
    ["Flins", "burst"],
    ["Flins", "attack", 4],
    ["Flins", "dash"],
    ["Flins", "attack", 4],
    ["Flins", "dash"],
    ["Flins", "attack", 2],
    ["Flins", "skill"],
    ["Flins", "attack"],
    ["Flins", "burst"],
    ["Flins", "attack", 4],
  ];
}

function sucroseNed(): Array<readonly [string, RotationAction, number?]> {
  return [
    ["Sucrose", "attack"],
    ["Sucrose", "skill"],
    ["Sucrose", "dash"],
  ];
}

describe("resolveScriptChar", () => {
  it("maps bina to the unique Columbina key", () => {
    assert.equal(resolveScriptChar("bina", FLINS_PARTY), "Columbina");
    assert.equal(resolveScriptChar("ineffa", FLINS_PARTY), "Ineffa");
    assert.equal(resolveScriptChar("flins", FLINS_PARTY), "Flins");
  });
});

function collectActs(pat: { kind: string; [k: string]: unknown }): string[] {
  switch (pat.kind) {
    case "act":
      return [`${pat.char}:${pat.action}`];
    case "seq":
      return (pat.items as typeof pat[]).flatMap(collectActs);
    case "alt":
      return (pat.items as typeof pat[]).flatMap(collectActs);
    case "star":
    case "repeat":
    case "repeatParam":
      return collectActs(pat.item as typeof pat);
    default:
      return [];
  }
}

describe("parseRotationScript", () => {
  it("treats the Flins outer for as the rotation with no setup", () => {
    const parsed = parseRotationScript(FLINS_SCRIPT);
    assert.ok(parsed);
    assert.deepEqual(parsed.setup, { kind: "seq", items: [] });
    assert.notEqual(parsed.body.kind, "act");
  });

  it("appends empty alternative for if/else-if without plain else", () => {
    const script = `
active hutao;
for let i=0; i<4; i=i+1 {
  if .hutao.skill.ready {
    hutao skill;
  } else if .hutao.burst.ready {
    hutao burst;
  }
  hutao attack;
}
`;
    const parsed = parseRotationScript(script);
    assert.ok(parsed);

    function findAlt(pat: ScriptPat): Extract<ScriptPat, { kind: "alt" }> | null {
      if (pat.kind === "alt") return pat;
      if (pat.kind === "seq") {
        for (const item of pat.items) {
          const found = findAlt(item);
          if (found) return found;
        }
      }
      return null;
    }

    const alt = findAlt(parsed.body);
    assert.ok(alt);
    assert.equal(alt.items.length, 3);
    assert.deepEqual(alt.items[2], { kind: "seq", items: [] });

    const events = [
      ...stamp(0, [["HuTao", "attack"]]),
      ...stamp(1, [["HuTao", "attack"]]),
      ...stamp(2, [["HuTao", "attack"]]),
      ...stamp(3, [["HuTao", "attack"]]),
    ];
    const match = matchScriptLoops(events, script, ["HuTao"]);
    assert.ok(match);
    assert.deepEqual(
      match.starts.map((t) => Math.round(t)),
      [0, 1, 2, 3],
    );
  });

  it("keeps on-field actions before the for as setup", () => {
    const parsed = parseRotationScript(GAMING_SCRIPT);
    assert.ok(parsed);
    assert.equal(parsed.setup.kind, "seq");
    if (parsed.setup.kind !== "seq") throw new Error("expected seq");
    assert.equal(parsed.setup.items.length, 3);
    assert.deepEqual(
      parsed.setup.items.map((p) =>
        p.kind === "act" ? `${p.char}:${p.action}` : p.kind,
      ),
      ["gaming:skill", "gaming:low_plunge", "gaming:dash"],
    );
  });

  it("reads skill[hold=#] as hold_skill for any non-zero hold", () => {
    const parsed = parseRotationScript(`
active nahida;
for let i=0; i<2; i=i+1 {
  nahida skill;
  lauma skill[hold=1];
  kazuha skill[hold=15];
  zhongli skill[hold=0];
  venti skill[orbital=1,hold=1];
}
`);
    assert.ok(parsed);
    assert.deepEqual(collectActs(parsed.body), [
      "nahida:skill",
      "lauma:hold_skill",
      "kazuha:hold_skill",
      "zhongli:skill",
      "venti:hold_skill",
    ]);
  });

  it("inlines varesa_combo(6) and keeps commented else-if as tap/hold E", () => {
    const parsed = parseRotationScript(VARESA_SCRIPT);
    assert.ok(parsed);
    assert.deepEqual(
      parsed.setup.kind === "seq"
        ? parsed.setup.items.map((p) =>
            p.kind === "act" ? `${p.char}:${p.action}` : p.kind,
          )
        : parsed.setup.kind === "act"
          ? [`${parsed.setup.char}:${parsed.setup.action}`]
          : [],
      ["varesa:attack"],
    );
    const repeats = findRepeats(parsed.body);
    assert.ok(repeats.some((r) => r.n === 6));
    assert.ok(collectActs(parsed.body).includes("chev:hold_skill"));
    assert.ok(collectActs(parsed.body).includes("varesa:high_plunge"));
    assert.ok(collectActs(parsed.body).includes("varesa:charge"));
  });
});

describe("matchScriptLoops", () => {
  it("cuts even/odd/i>0 Flins iterations at Ineffa skill", () => {
    const even0 = stamp(0, [
      ["Ineffa", "skill"],
      ["Columbina", "skill"],
      ["Columbina", "burst"],
      ...sucroseNed(),
      ...flinsField(),
      ...sucroseNed(),
    ]);
    const odd1 = stamp(16, [
      ["Ineffa", "skill"],
      ["Ineffa", "burst"],
      ["Columbina", "skill"],
      ["Columbina", "attack"],
      ["Sucrose", "attack"],
      ["Sucrose", "burst"],
      ...flinsField(),
      ...sucroseNed(),
    ]);
    const even2 = stamp(32, [
      ["Ineffa", "skill"],
      ["Ineffa", "attack"],
      ["Sucrose", "attack", 2],
      ["Sucrose", "charge"],
      ["Columbina", "attack"],
      ["Columbina", "skill"],
      ["Columbina", "burst"],
      ...sucroseNed(),
      ...flinsField(),
      ["Sucrose", "attack"],
      ["Sucrose", "charge"],
    ]);
    const match = matchScriptLoops(
      [...even0, ...odd1, ...even2],
      FLINS_SCRIPT,
      FLINS_PARTY,
    );
    assert.ok(match);
    assert.equal(match.hasSetup, false);
    assert.deepEqual(
      match.starts.map((t) => Math.round(t)),
      [0, 16, 32],
    );
  });

  it("matches Gaming E lP D as setup then the for body", () => {
    const events: RotationSampleEvent[] = [
      { t: 0.02, char: "Gaming", action: "skill" },
      { t: 0.4, char: "Gaming", action: "low_plunge" },
      { t: 0.9, char: "Gaming", action: "dash" },
      { t: 1.5, char: "Xianyun", action: "skill" },
      { t: 4.5, char: "Bennett", action: "skill" },
      { t: 6.7, char: "Citlali", action: "skill" },
      { t: 9.4, char: "Gaming", action: "burst" },
      { t: 22.4, char: "Xianyun", action: "skill" },
      { t: 25.4, char: "Bennett", action: "skill" },
      { t: 27.3, char: "Citlali", action: "skill" },
      { t: 30.0, char: "Gaming", action: "burst" },
    ];
    const match = matchScriptLoops(events, GAMING_SCRIPT, [
      "Gaming",
      "Xianyun",
      "Bennett",
      "Citlali",
    ]);
    assert.ok(match);
    assert.equal(match.hasSetup, true);
    assert.deepEqual(match.starts, [1.5, 22.4]);
  });

  it("unrolls a counted inner for", () => {
    const script = `
active traveler;
for let i=0; i<2; i=i+1 {
  for let j = 0; j < 3; j = j + 1 {
    traveler attack;
  }
}
`;
    const events = stamp(0, [
      ["Traveler", "attack", 3],
      ["Traveler", "attack", 3],
    ]);
    // stamp uses 0.05 steps; second iter starts at 0.15
    const match = matchScriptLoops(events, script, ["Traveler"]);
    assert.ok(match);
    assert.equal(match.hasSetup, false);
    assert.equal(match.starts.length, 2);
    assert.equal(match.starts[0], 0);
    assert.ok((match.starts[1] ?? 0) > 0);
  });

  it("returns null when the sample does not follow the body", () => {
    const events = stamp(0, [
      ["Ineffa", "skill"],
      ["Ineffa", "skill"],
      ["Ineffa", "skill"],
      ["Ineffa", "skill"],
    ]);
    assert.equal(matchScriptLoops(events, FLINS_SCRIPT, FLINS_PARTY), null);
  });

  it("cuts Varesa rotations after inlining the combo fn", () => {
    const combo: Array<readonly [string, RotationAction, number?]> = [
      ["Varesa", "skill"],
      ["Varesa", "attack"],
      ["Varesa", "high_plunge"],
    ];
    const loop = (t0: number) =>
      stamp(t0, [
        ["Chevreuse", "burst"],
        ["Chevreuse", "skill"],
        ["Durin", "skill"],
        ["Durin", "burst"],
        ["Durin", "skill"],
        ["Fischl", "attack"],
        ["Fischl", "skill"],
        ["Fischl", "attack"],
        ...Array.from({ length: 6 }, () => combo).flat(),
      ]);
    const events: RotationSampleEvent[] = [
      ...stamp(0, [["Varesa", "attack"]]),
      ...loop(1),
      ...loop(20),
    ];
    const match = matchScriptLoops(events, VARESA_SCRIPT, VARESA_PARTY);
    assert.ok(match);
    assert.equal(match.hasSetup, true);
    assert.deepEqual(
      match.starts.map((t) => Math.round(t)),
      [1, 20],
    );
    const annotated = applyScriptEventActions(events, VARESA_SCRIPT, VARESA_PARTY);
    assert.equal(annotated[2]?.action, "hold_skill");
  });
});

describe("applyScriptEventActions", () => {
  it("rewrites sample skill to hold_skill from skill[hold=#]", () => {
    const script = `
active nahida;
for let i=0; i<3; i=i+1 {
  nahida skill;
  lauma skill[hold=1];
  kazuha skill[hold=15];
}
`;
    const party = ["Nahida", "Lauma", "KaedeharaKazuha"];
    const events: RotationSampleEvent[] = [
      { t: 0, char: "Nahida", action: "skill" },
      { t: 1, char: "Lauma", action: "skill" },
      { t: 2, char: "KaedeharaKazuha", action: "skill" },
      { t: 10, char: "Nahida", action: "skill" },
      { t: 11, char: "Lauma", action: "skill" },
      { t: 12, char: "KaedeharaKazuha", action: "skill" },
      { t: 20, char: "Nahida", action: "skill" },
      { t: 21, char: "Lauma", action: "skill" },
      { t: 22, char: "KaedeharaKazuha", action: "skill" },
    ];
    const out = applyScriptEventActions(events, script, party);
    assert.equal(out[0]?.action, "skill");
    assert.equal(out[1]?.action, "hold_skill");
    assert.equal(out[2]?.action, "hold_skill");
    assert.equal(out[4]?.action, "hold_skill");
    assert.ok(matchScriptLoops(events, script, party));
  });
});
