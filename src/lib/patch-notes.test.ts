import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPatchNoteFilename,
  parsePatchNoteMarkdown,
  renderPatchNoteBody,
  slugFromFilename,
} from "./patch-notes.ts";

const SAMPLE = `---
title: Roster sync hotfix & patch notes
date: 2026-08-11
summary: Logged-in roster saves were rejecting valid uploads.
---

## Roster sync hotfix

Saves now send only \`name_id\` and \`isOwned\`.

## Patch notes

- the **Patch notes** page
- *Discord* announcements

See [the site](https://lightkeepers.moe/patch-notes).
`;

describe("patch notes", () => {
  it("slugFromFilename strips path and extension", () => {
    assert.equal(
      slugFromFilename("patch-notes/2026-08-11-roster-hotfix.md"),
      "2026-08-11-roster-hotfix",
    );
  });

  it("isPatchNoteFilename requires dated note files", () => {
    assert.equal(isPatchNoteFilename("2026-08-11-roster-hotfix.md"), true);
    assert.equal(isPatchNoteFilename("README.md"), false);
  });

  it("parsePatchNoteMarkdown reads frontmatter and body", () => {
    const note = parsePatchNoteMarkdown(
      "2026-08-11-roster-hotfix-and-patch-notes.md",
      SAMPLE,
    );
    assert.equal(note.slug, "2026-08-11-roster-hotfix-and-patch-notes");
    assert.equal(note.title, "Roster sync hotfix & patch notes");
    assert.equal(note.date, "2026-08-11");
    assert.match(note.body, /Roster sync hotfix/);
  });

  it("parsePatchNoteMarkdown accepts valid calendar dates", () => {
    const leap = parsePatchNoteMarkdown(
      "2024-02-29-leap.md",
      SAMPLE.replace("date: 2026-08-11", "date: 2024-02-29"),
    );
    assert.equal(leap.date, "2024-02-29");
  });

  it("parsePatchNoteMarkdown rejects calendar-invalid dates", () => {
    for (const bad of [
      "2026-02-31",
      "2026-99-99",
      "2026-00-10",
      "2026-13-01",
    ]) {
      assert.throws(
        () =>
          parsePatchNoteMarkdown(
            "bad.md",
            SAMPLE.replace("date: 2026-08-11", `date: ${bad}`),
          ),
        /valid YYYY-MM-DD/,
      );
    }
  });

  it("renderPatchNoteBody emits trusted HTML", () => {
    const html = renderPatchNoteBody(
      parsePatchNoteMarkdown("x.md", SAMPLE).body,
    );
    assert.match(html, /<h2>Roster sync hotfix<\/h2>/);
    assert.match(html, /<code>name_id<\/code>/);
    assert.match(html, /<strong>Patch notes<\/strong>/);
    assert.match(html, /<em>Discord<\/em>/);
    assert.match(html, /<a href="https:\/\/lightkeepers\.moe\/patch-notes"/);
    assert.match(html, /<ul>/);
  });

  it("renderPatchNoteBody supports ordered lists", () => {
    const html = renderPatchNoteBody(
      "Do this:\n1. First step\n2. Second step\n\nDone.",
    );
    assert.match(html, /<ol>/);
    assert.doesNotMatch(html, /<ol start=/);
    assert.match(html, /<li>First step<\/li>/);
    assert.match(html, /<li>Second step<\/li>/);
    assert.match(html, /<p>Done\.<\/p>/);
  });

  it("renderPatchNoteBody emits ol start when the first marker is not 1", () => {
    const html = renderPatchNoteBody("3. Third\n4. Fourth");
    assert.match(html, /<ol start="3">/);
    assert.match(html, /<li>Third<\/li>/);
    assert.match(html, /<li>Fourth<\/li>/);
  });
});
