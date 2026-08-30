import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  citationShortLabel,
  entityHref,
  orderCitationsForDisplay,
  renderEntityChip,
  renderResearchAnswer,
  renderResearchInline,
  safeExternalHref,
} from "./research-answer.ts";
import type { ResearchCitation, ResearchEntity } from "./research-types.ts";

const xqC6: ResearchEntity = {
  key: "c:Xingqiu:6",
  type: "constellation",
  label: "Xingqiu C6",
  name_id: "Xingqiu",
  index: 6,
  kit_ref: "T256",
  icon: "UI_Talent_S_Xingqiu_04",
  description: "Energy related.",
};

const homa: ResearchEntity = {
  key: "weapon:StaffOfHoma",
  type: "weapon",
  label: "Staff of Homa",
  weapon_key: "StaffOfHoma",
  icon: "UI_EquipIcon_Pole_Homa",
};

const cite2297: ResearchCitation = {
  id: 2297,
  title: "Hu Tao Guide",
  url: "https://keqingmains.com/hu-tao/",
  source_tier: "guide",
  publisher: "KeqingMains",
  heading_path: "FAQ > C1",
  quote: "C0 with R1 Homa has a similar damage ceiling…",
};

describe("research answer embeddings", () => {
  it("entityHref deep-links kit refs", () => {
    assert.equal(entityHref(xqC6), "/characters/Xingqiu#kit-T256");
    assert.equal(entityHref(homa), null);
  });

  it("renderEntityChip emits a hydrate slot marker", () => {
    const html = renderEntityChip(xqC6);
    assert.match(html, /research-entity-slot/);
    assert.match(html, /data-research-entity-key="c:Xingqiu:6"/);
    assert.doesNotMatch(html, /research-entity-constellation/);
    assert.doesNotMatch(html, /Xingqiu C6/);
    assert.doesNotMatch(html, /title=/);
  });

  it("renderResearchAnswer hydrates entity tokens and strips unknowns", () => {
    const html = renderResearchAnswer(
      "Take [[c:Xingqiu:6]] with [[weapon:NotReal]] and **bold**.",
      [xqC6],
      [],
    );
    assert.match(html, /data-research-entity-key="c:Xingqiu:6"/);
    assert.match(html, /research-entity-slot/);
    assert.match(html, /NotReal/);
    assert.doesNotMatch(html, /\[\[/);
    assert.match(html, /<strong>bold<\/strong>/);
  });

  it("renderResearchAnswer hydrates cite superscripts", () => {
    const html = renderResearchAnswer(
      "Combo DPS gain ~20% [[cite:2297]].",
      [],
      [cite2297],
    );
    assert.match(html, /research-cite/);
    assert.match(html, /#research-cite-2297/);
    assert.match(html, />1</);
    assert.doesNotMatch(html, /\[\[cite:/);
  });

  it("renderResearchInline unwraps paragraph and hydrates cites", () => {
    const html = renderResearchInline(
      "~20% damage [[cite:2297]]",
      [],
      [cite2297],
    );
    assert.doesNotMatch(html, /<p>/);
    assert.match(html, /research-cite/);
    assert.doesNotMatch(html, /\[\[cite:/);
  });

  it("renderResearchInline splits cite clusters", () => {
    const cite2300: ResearchCitation = {
      ...cite2297,
      id: 2300,
      heading_path: "Combos",
    };
    const html = renderResearchInline(
      "Adds i-frames [[cite:2297, 2300]]",
      [],
      [cite2297, cite2300],
    );
    assert.doesNotMatch(html, /\[\[cite:/);
    assert.match(html, /research-cite/);
    assert.match(html, /#research-cite-2297/);
    assert.match(html, /#research-cite-2300/);
  });

  it("renderResearchInline keeps disallowed cluster ids as literal cite text", () => {
    const html = renderResearchInline(
      "Adds i-frames [[cite:2297, 9999]]",
      [],
      [cite2297],
    );
    assert.match(html, /#research-cite-2297/);
    assert.match(html, /\[cite:9999\]/);
  });

  it("orderCitationsForDisplay includes comparison text", () => {
    const ordered = orderCitationsForDisplay(
      [cite2297],
      "Short verdict.",
      ["~20% [[cite:2297]]"],
    );
    assert.equal(ordered.length, 1);
    assert.equal(ordered[0]?.id, 2297);
  });

  it("renderResearchAnswer namespaces cite anchors per answer prefix", () => {
    const a = renderResearchAnswer(
      "A [[cite:2297]].",
      [],
      [cite2297],
      { citeAnchorPrefix: "ra-a-" },
    );
    const b = renderResearchAnswer(
      "B [[cite:2297]].",
      [],
      [cite2297],
      { citeAnchorPrefix: "ra-b-" },
    );
    assert.match(a, /#ra-a-research-cite-2297/);
    assert.match(b, /#ra-b-research-cite-2297/);
    assert.doesNotMatch(a, /#ra-b-research-cite/);
    assert.doesNotMatch(b, /#ra-a-research-cite/);
  });

  it("safeExternalHref allows only http(s)", () => {
    assert.equal(
      safeExternalHref("https://keqingmains.com/hu-tao/"),
      "https://keqingmains.com/hu-tao/",
    );
    assert.equal(safeExternalHref("javascript:alert(1)"), null);
    assert.equal(safeExternalHref("data:text/html,hi"), null);
  });

  it("renderEntityChip escapes entity key HTML", () => {
    const nasty: ResearchEntity = {
      key: `char:X<"y">`,
      type: "character",
      label: `Foo<"bar">`,
      name_id: "Xingqiu",
      description: `desc <script>alert(1)</script> "x"`,
    };
    const html = renderEntityChip(nasty);
    assert.doesNotMatch(html, /<script/);
    assert.match(html, /data-research-entity-key="char:X&lt;&quot;y&quot;&gt;"/);
    assert.doesNotMatch(html, /title=/);
  });

  it("renderResearchAnswer keeps unknown cite tokens as literal text", () => {
    const html = renderResearchAnswer(
      "Before [[cite:999]] after.",
      [],
      [cite2297],
    );
    assert.match(html, /Before/);
    assert.match(html, /after/);
    assert.match(html, /\[cite:999\]/);
    assert.doesNotMatch(html, /\[\[cite:999\]\]/);
  });

  it("renderResearchAnswer reuses a shared citeDisplayNum map", () => {
    const shared = new Map<number, number>();
    renderResearchAnswer("A [[cite:2297]].", [], [cite2297], {
      citeDisplayNum: shared,
    });
    assert.equal(shared.get(2297), 1);
    const html = renderResearchAnswer("B [[cite:2297]].", [], [cite2297], {
      citeDisplayNum: shared,
    });
    assert.match(html, />1</);
    assert.equal(shared.size, 1);
  });

  it("orderCitationsForDisplay follows markdown appearance", () => {
    const c2 = { ...cite2297, id: 2300 };
    const ordered = orderCitationsForDisplay(
      [cite2297, c2],
      "First [[cite:2300]] then [[cite:2297]].",
    );
    assert.deepEqual(
      ordered.map((c) => c.id),
      [2300, 2297],
    );
  });

  it("citationShortLabel prefers heading leaf", () => {
    assert.equal(citationShortLabel(cite2297), "KeqingMains · C1");
  });

  it("renderResearchAnswer hydrates legacy bracket cites", () => {
    const html = renderResearchAnswer(
      "Particles [2316].",
      [],
      [{ ...cite2297, id: 2316 }],
    );
    assert.match(html, /research-cite/);
    assert.match(html, /#research-cite-2316/);
  });
});
