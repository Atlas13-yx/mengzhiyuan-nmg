import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/lines-data.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { controlLineDifference, controlLineSource, officialControlLines } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const confirmed = { hydrated: true, profileConfigured: true, profileTrack: "物理", viewedTrack: "物理", score: "488", lineScore: 488 };

test("control-line comparisons never treat a default or cross-track profile as a saved candidate", () => {
  assert.equal(controlLineDifference({ ...confirmed, profileConfigured: false }), null);
  assert.equal(controlLineDifference({ ...confirmed, hydrated: false }), null);
  assert.equal(controlLineDifference({ ...confirmed, viewedTrack: "历史" }), null);
  assert.equal(controlLineDifference(confirmed), 0);
  assert.equal(controlLineDifference({ ...confirmed, score: "500" }), 12);
  assert.equal(controlLineDifference({ ...confirmed, score: "480" }), -8);
});

test("invalid scores cannot produce misleading numeric differences", () => {
  for (const score of ["", "未填写", "-1", "751", "NaN", "488.5"]) {
    assert.equal(controlLineDifference({ ...confirmed, score }), null, score);
  }
  assert.equal(controlLineDifference({ ...confirmed, lineScore: Number.NaN }), null);
});

test("ordinary-track lines all retain the official year and article provenance", () => {
  assert.equal(controlLineSource.year, 2026);
  assert.equal(new URL(controlLineSource.url).hostname, "www.nm.zsks.cn");
  assert.equal(controlLineSource.publishedAt, "2026-06-24");
  for (const track of ["物理", "历史"]) {
    const lines = officialControlLines[track];
    assert.equal(lines.length, 3);
    assert.deepEqual(lines.map((line) => line.id), ["special", "undergraduate", "vocational"]);
    assert.ok(lines[0].score > lines[1].score && lines[1].score > lines[2].score);
  }
});

