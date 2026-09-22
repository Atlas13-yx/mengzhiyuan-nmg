import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { compareGroupComposition, createOfficialSelection, csvCell, getHistoricalCandidates, getOfficialEligibility, restoreOfficialSelections } from "../app/group-comparison.ts";

const dataRoot = new URL("../public/data/admissions-2026/", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("catalog.json", dataRoot), "utf8"));
const school = catalog.schools.find((item) => item.name === "内蒙古大学");
const shard = JSON.parse(await readFile(new URL(school.detailFile.split("/").pop(), dataRoot), "utf8"));
const detail = shard[school.id];
const group = detail.offerings.find((item) => item.subject === "历史类" && item.planCategory === "普通类");
const historyProfile = { firstSubject: "历史", secondSubjects: ["思想政治", "地理"] };

test("official selection preserves exact school and offering identity through storage", () => {
  const selection = createOfficialSelection(school, detail, group, catalog.meta);
  const restored = restoreOfficialSelections(JSON.stringify([selection, selection]));
  assert.equal(restored.length, 1);
  assert.equal(restored[0].id, `official:2026:${group.id}`);
  assert.equal(restored[0].schoolId, school.id);
  assert.deepEqual(restored[0].offering, group);
  assert.equal(restored[0].verification, "checking", "restored snapshots must be reverified before claiming currency");
  assert.deepEqual(restoreOfficialSelections(JSON.stringify([{ ...selection, id: "wrong-id" }])), []);
  assert.deepEqual(restoreOfficialSelections(JSON.stringify([{ ...selection, sourceUrl: "javascript:alert(1)" }])), []);
  assert.deepEqual(restoreOfficialSelections("not-json"), []);
});

test("same group number cannot establish year-over-year composition", () => {
  const result = compareGroupComposition(group, null);
  assert.equal(result.status, "missing");
  assert.equal(result.planDelta, null);
  assert.deepEqual(result.added, []);
  assert.match(result.reason, /相同组号不代表/);
});

test("composition comparison detects moved majors, conditions and plan changes", () => {
  const original = structuredClone(group);
  const current = structuredClone(group);
  current.majors[0].tuition = "9999";
  const removed = current.majors.pop();
  current.majors.push({ ...removed, name: "新增专业" });
  current.planCount += 3;
  const result = compareGroupComposition(current, original);
  assert.equal(result.status, "changed");
  assert.deepEqual(result.added, ["新增专业"]);
  assert.deepEqual(result.removed, [removed.name]);
  assert.deepEqual(result.changed, [current.majors[0].name]);
  assert.equal(result.planDelta, 3);
  assert.equal(compareGroupComposition(current, { ...original, batch: "本科提前批B段" }).status, "incomparable");
});

test("historical candidates require batch, subject, category AND group number", () => {
  const record = { professionalGroup: group.professionalGroup, batch: group.batch, subject: group.subject, planCategory: group.planCategory };
  const sample = { ...detail, scoreHistory: [record, { ...record, batch: "本科提前批B段" }, { ...record, subject: "物理类" }, { ...record, planCategory: "国家专项计划" }, { ...record, professionalGroup: "999" }] };
  assert.equal(getHistoricalCandidates(sample, group).length, 1);
  assert.deepEqual(getHistoricalCandidates(sample, { ...group, professionalGroup: "" }), []);
});

test("eligibility re-evaluates subject changes and does not certify special admissions", () => {
  assert.equal(getOfficialEligibility(group, historyProfile).status, "eligible");
  assert.equal(getOfficialEligibility(group, { firstSubject: "物理", secondSubjects: ["化学", "生物学"] }).status, "blocked");
  assert.equal(getOfficialEligibility(group, { ...historyProfile, secondSubjects: [] }).status, "review");
  assert.equal(getOfficialEligibility({ ...group, planCategory: "国家专项计划" }, historyProfile).status, "review");
  assert.equal(getOfficialEligibility({ ...group, subject: "美术与设计类" }, historyProfile).status, "review");
  const chemistryGroup = { ...group, subject: "物理类", majors: [{ ...group.majors[0], subjectRequirement: "化学,生物学" }] };
  assert.equal(getOfficialEligibility(chemistryGroup, { firstSubject: "物理", secondSubjects: ["化学", "生物学"] }).status, "eligible");
  assert.equal(getOfficialEligibility(chemistryGroup, { firstSubject: "物理", secondSubjects: ["化学", "地理"] }).status, "blocked");
  assert.equal(getOfficialEligibility({ ...chemistryGroup, majors: [{ ...group.majors[0], subjectRequirement: "" }] }, { firstSubject: "物理", secondSubjects: ["化学", "生物学"] }).status, "review");
});

test("CSV exports escape quotes and spreadsheet formulas", () => {
  assert.equal(csvCell('学校,"专业"'), '"学校,""专业"""');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell("  @SUM(A1)"), '"\'  @SUM(A1)"');
});
