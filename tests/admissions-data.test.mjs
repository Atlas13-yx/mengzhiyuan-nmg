import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../public/data/admissions-2026/", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), "utf8"));
}

test("2026 official admissions catalog is internally complete", async () => {
  const catalog = await readJson("catalog.json");
  const shardFiles = [...new Set(catalog.schools.map((school) => school.detailFile.split("/").pop()))];
  const shards = await Promise.all(shardFiles.map(readJson));
  const details = Object.assign({}, ...shards);

  assert.equal(catalog.meta.schoolCount, 1_663);
  assert.equal(catalog.meta.offeringCount, 9_300);
  assert.equal(catalog.meta.majorRowCount, 27_553);
  assert.equal(catalog.meta.totalPlanCount, 155_138);
  assert.equal(catalog.meta.correctionCount, 11);
  assert.equal(catalog.schools.length, catalog.meta.schoolCount);
  assert.equal(Object.keys(details).length, catalog.meta.schoolCount);

  let offeringCount = 0;
  let majorRowCount = 0;
  let totalPlanCount = 0;
  let matchedScoreCount = 0;
  for (const school of catalog.schools) {
    const detail = details[school.id];
    assert.ok(detail, `missing detail for ${school.code} ${school.name}`);
    offeringCount += detail.offerings.length;
    majorRowCount += detail.offerings.reduce((sum, offering) => sum + offering.majors.length, 0);
    totalPlanCount += detail.offerings.reduce((sum, offering) => sum + offering.planCount, 0);
    matchedScoreCount += detail.scoreHistory.length;
  }

  assert.equal(offeringCount, catalog.meta.offeringCount);
  assert.equal(majorRowCount, catalog.meta.majorRowCount);
  assert.equal(totalPlanCount, catalog.meta.totalPlanCount);
  assert.equal(matchedScoreCount, catalog.meta.matchedScoreRecordCount);
});

test("2025 official score audit accounts for every downloaded row", async () => {
  const [catalog, unmatched] = await Promise.all([
    readJson("catalog.json"),
    readJson("unmatched-scores-2025.json"),
  ]);
  assert.equal(unmatched.count, catalog.meta.unmatchedScoreRecordCount);
  assert.equal(
    catalog.meta.matchedScoreRecordCount + unmatched.count,
    catalog.meta.scoreRecordCount,
  );
  assert.equal(catalog.meta.scoreRecordCount, 17_813);
});

test("all official corrections are matched and effective values are present", async () => {
  const [catalog, correctionData] = await Promise.all([
    readJson("catalog.json"),
    readJson("corrections.json"),
  ]);
  assert.equal(correctionData.items.length, 11);
  assert.ok(correctionData.items.every((item) => item.matchedSchoolIds.length > 0));
  assert.ok(correctionData.items.every((item) => (item.appliedChanges?.length ?? 0) > 0));

  const cache = new Map();
  async function schoolByCode(code) {
    const summary = catalog.schools.find((school) => school.code === code);
    assert.ok(summary, `missing school ${code}`);
    if (!cache.has(summary.detailFile)) {
      cache.set(summary.detailFile, await readJson(summary.detailFile.split("/").pop()));
    }
    return cache.get(summary.detailFile)[summary.id];
  }
  function major(detail, code, group) {
    return detail.offerings
      .filter((offering) => !group || offering.professionalGroup === group)
      .flatMap((offering) => offering.majors)
      .find((item) => item.code === code);
  }

  assert.equal(major(await schoolByCode("719"), "F1", "004")?.planCount, 1);
  assert.equal(major(await schoolByCode("767"), "76", "089")?.durationYears, "4");
  assert.equal(major(await schoolByCode("R01"), "2T", "003")?.tuition, "59000");
  assert.equal(major(await schoolByCode("766"), "A7", "102")?.name, "中国少数民族语言文学");
  assert.equal(major(await schoolByCode("752"), "R2", "087")?.notes, "国际本科互认课程");
  assert.equal(major(await schoolByCode("E75"), "Z1", "301")?.tuition, "22000");
  assert.equal(major(await schoolByCode("716"), "69", "053")?.planCount, 5);
  assert.equal(major(await schoolByCode("B05"), "04", "001")?.planCount, 15);
  assert.equal(major(await schoolByCode("755"), "C4", "904")?.planCount, 25);
});

