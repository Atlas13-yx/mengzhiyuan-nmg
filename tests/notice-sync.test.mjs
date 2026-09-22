import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { beijingDate, getSyncWindow, isInActiveWindow, mergeItems, officialUrl, parseLinks, syncAnnouncements } from "../scripts/sync-nm-notices.mjs";

const fixture = '<li><a href="./202608/t20260811_46664.html" title="2026年普通高校招生最后一次征集志愿公告">截断标题</a><span class="date4">08-11</span></li>';
const source = "https://www.nm.zsks.cn/ztzl/pagkpt/tzgg/";
const activeNow = new Date("2026-08-12T01:00:00Z");

test("hourly collection uses Beijing inclusive dates and skips outside the configured season", async () => {
  const window = getSyncWindow(activeNow, { SYNC_START_DATE: "2026-06-10", SYNC_END_DATE: "2026-08-31" });
  assert.equal(beijingDate(new Date("2026-06-09T16:00:00Z")), "2026-06-10");
  assert.equal(isInActiveWindow(new Date("2026-06-09T15:59:59Z"), window), false);
  assert.equal(isInActiveWindow(new Date("2026-06-09T16:00:00Z"), window), true);
  assert.equal(isInActiveWindow(new Date("2026-08-31T15:59:59Z"), window), true);
  assert.equal(isInActiveWindow(new Date("2026-08-31T16:00:00Z"), window), false);
  let requests = 0;
  const result = await syncAnnouncements({ now: new Date("2026-09-22T00:00:00Z"), env: {}, fetchImpl: async () => { requests++; throw new Error("should not fetch"); } });
  assert.equal(result.skipped, true);
  assert.equal(requests, 0);
  assert.throws(() => getSyncWindow(activeNow, { SYNC_START_DATE: "2026-02-30" }), /YYYY-MM-DD/);
  assert.throws(() => getSyncWindow(activeNow, { SYNC_START_DATE: "2026-09-01", SYNC_END_DATE: "2026-08-31" }), /ordered/);
});

test("official indexes preserve article years, visible dates, relative links and complete titles", () => {
  const parsed = parseLinks(fixture + '<li><a href="./202507/t20250709_12345.html">2025年普通高考网上填报志愿公告</a><span>07-09</span></li>', source);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, "2026年普通高校招生最后一次征集志愿公告");
  assert.equal(parsed[0].url, `${source}202608/t20260811_46664.html`);
  assert.equal(parsed[0].date, "2026-08-11");
  assert.equal(parsed[0].dateSource, "official-list");
  assert.equal(parsed[1].date, "2025-07-09");
  assert.equal(parsed[0].verification, "official-index");
  const undated = parseLinks('<a href="https://www.nm.zsks.cn/fzlm/26gktj/">2026年高考各分数段人数统计表</a>');
  assert.equal(undated[0].date, "");
  assert.equal(undated[0].category, "数据发布");
});

test("unsafe or off-domain URLs, hidden comments and script templates cannot become official notices", () => {
  assert.equal(officialUrl("javascript:alert(1)"), null);
  assert.equal(officialUrl("https://nm.zsks.cn.attacker.test/fake"), null);
  const parsed = parseLinks(`<!-- ${fixture} --><script>var template = '${fixture}';</script><a href="https://other.test/notice">2026年普通高考网上填报志愿公告</a>`);
  assert.deepEqual(parsed, []);
});

test("merging corrects existing titles and deduplicates official article aliases without trusting seed data", () => {
  const item = parseLinks(fixture, source)[0];
  const old = { ...item, title: "过期标题", url: "https://www.nm.zsks.cn/kszs/ptgk/ggl/202608/t20260811_46664.html" };
  const sample = { ...item, url: "https://www.nm.zsks.cn/ztzl/pagkpt/", verification: undefined };
  const result = mergeItems([item], [old, sample]);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, item.title);
  assert.equal(result[0].url, item.url);
});

test("HTTP failure, incomplete index and invalid existing JSON preserve the last successful file byte for byte", async () => {
  const directory = await mkdtemp(join(tmpdir(), "meng-notices-"));
  const output = join(directory, "announcements.json");
  const original = '{"lastSuccessfulSync":"2026-08-11T00:00:00Z","items":[]}\n';
  await writeFile(output, original);
  try {
    await assert.rejects(syncAnnouncements({ now: activeNow, env: {}, output, fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
    assert.equal(await readFile(output, "utf8"), original);
    let requests = 0;
    await assert.rejects(syncAnnouncements({ now: activeNow, env: {}, output, fetchImpl: async () => ({ ok: true, text: async () => ++requests === 1 ? fixture : "<html>maintenance</html>" }) }), /No announcement/);
    assert.equal(await readFile(output, "utf8"), original);
    await writeFile(output, "broken-json");
    await assert.rejects(syncAnnouncements({ now: activeNow, env: {}, output, fetchImpl: async () => ({ ok: true, text: async () => fixture }) }), SyntaxError);
    assert.equal(await readFile(output, "utf8"), "broken-json");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("successful manual refresh records provenance without claiming the season has restarted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "meng-notices-"));
  const output = join(directory, "announcements.json");
  const now = new Date("2026-09-22T03:00:00Z");
  try {
    const result = await syncAnnouncements({ now, env: { FORCE_SYNC: "1" }, output, fetchImpl: async () => ({ ok: true, text: async () => fixture }) });
    assert.equal(result.skipped, false);
    const payload = JSON.parse(await readFile(output, "utf8"));
    assert.equal(payload.lastSuccessfulSync, now.toISOString());
    assert.equal(payload.schemaVersion, 2);
    assert.equal(payload.syncWindow.end, "2026-08-31");
    assert.equal(payload.syncWindow.timezone, "Asia/Shanghai");
    assert.equal(payload.sources.length, 2);
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].verification, "official-index");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

