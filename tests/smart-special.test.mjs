import assert from "node:assert/strict";
import test from "node:test";
import { matchesCatalog, parseCatalogFilter, parseNeeds } from "../app/smart/needs-parser.ts";
import { trackGuides } from "../app/special/special-guides.ts";

const school = {
  id: "example", code: "101", name: "测试大学", detailFile: "/example.json",
  batches: ["本科批"], subjects: ["物理类"], planCategories: ["普通类"],
  tuitionMin: 5000, tuitionMax: 20000, planCount: 10, majorCount: 2, groupCount: 1,
  score2025Min: null, score2025Max: null, scoreRecordCount: 0, scoreMatch: null, correctionCount: 0,
};

test("spoken tuition units become editable annual amounts", () => {
  assert.equal(parseNeeds("本科，学费每年 6000 元以内").needs.maxTuition, "6000");
  assert.equal(parseNeeds("预算不超过 1.5 万元").needs.maxTuition, "15000");
  assert.equal(parseNeeds("学费六千以内").needs.maxTuition, "6000");
  assert.equal(parseNeeds("学费不要太高").needs.maxTuition, "");
  assert.ok(parseNeeds("学费不要太高").notes.some((note) => note.includes("明确金额")));
});

test("major dislikes are not converted into preferred majors", () => {
  const parsed = parseNeeds("不想学计算机，想读电子信息");
  assert.deepEqual(parsed.needs.excludedMajors, ["计算机"]);
  assert.deepEqual(parsed.needs.majors, ["电子信息"]);
  assert.deepEqual(parseNeeds("我是历史类，想读本科").needs.majors, []);
});

test("catalog parsing matches known names and exact batch labels", () => {
  const parsed = parseCatalogFilter("看看测试大学本科提前批 B 段，学费 1 万", [school], "物理类");
  assert.equal(parsed.schoolQuery, "测试大学");
  assert.equal(parsed.batch, "本科提前批B段");
  assert.equal(parsed.maxTuition, "10000");
  assert.equal(parsed.subject, "物理类");
});

test("unknown tuition is not falsely counted as affordable", () => {
  const filter = { schoolQuery: "", subject: "物理类", batch: "本科批", maxTuition: "6000" };
  assert.equal(matchesCatalog(school, filter), true);
  assert.equal(matchesCatalog({ ...school, tuitionMin: null }, filter), false);
  assert.equal(matchesCatalog({ ...school, tuitionMin: 6500 }, filter), false);
  assert.equal(matchesCatalog(school, { ...filter, subject: "历史类" }), false);
  assert.equal(matchesCatalog(school, { ...filter, schoolQuery: "不存在" }), false);
});

test("special routes separate judicial and sports and retain official sources", () => {
  assert.deepEqual(trackGuides.map((track) => track.id), ["military", "police", "judicial", "arts", "sports", "joint", "hk"]);
  for (const track of trackGuides) {
    assert.ok(track.checks.length > 0);
    assert.ok(track.steps.length > 0);
    assert.ok(track.sources.length > 0);
    for (const source of track.sources) {
      const host = new URL(source.url).hostname;
      assert.ok(["www.nm.zsks.cn", "www.crs.jsj.edu.cn", "admissions.hku.hk"].includes(host));
    }
  }
});

