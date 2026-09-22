import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { lookupRank } from "../app/score-ranks.ts";
import { validateSubjectCombination } from "../app/subject-policy.ts";
import { calculateFit, calculateRisk } from "../app/decision-engine.ts";
import { schoolGroups } from "../app/platform-data.ts";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function localResourcePaths(html) {
  const paths = new Set();
  const resourcePatterns = [
    /src=["'](\/[^"']+)["']/g,
    /<link\b[^>]*href=["'](\/[^"']+)["']/g,
  ];

  for (const resourcePattern of resourcePatterns) {
    for (const match of html.matchAll(resourcePattern)) {
      paths.add(new URL(match[1], "http://localhost").pathname);
    }
  }

  paths.add("/favicon.svg");
  paths.add("/data/announcements.json");
  return [...paths].sort();
}

test("server-renders the multi-page volunteer-planning home", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>蒙志愿｜内蒙古高考志愿智能决策平台<\/title>/);
  assert.match(html, /我的 2026 志愿档案/);
  assert.match(html, />填写<\/a>/);
  assert.match(html, /尚未填写个人档案/);
  assert.match(html, /智能选志愿/);
  assert.match(html, /专业组预览/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);

  const resources = localResourcePaths(html);
  assert.ok(resources.some((resource) => resource.startsWith("/_next/static/")));
  assert.ok(resources.every((resource) => !resource.includes("\\")));
});

test("server-renders every primary route", async () => {
  const routes = [
    ["/profile", "个人志愿档案"],
    ["/smart", "把想法，变成可核对的选择"],
    ["/schools", "院校专业组库"],
    ["/volunteer-list", "我的志愿表"],
    ["/tools", "高考数据工具箱"],
    ["/tools/rank", "一分一段位次查询"],
    ["/special?type=military", "不同升学路径，各有一张路线图"],
    ["/notices", "公告"],
    ["/tools/compare", "院校专业组 PK"],
    ["/tools/restrictions", "限报风险自查"],
  ];

  for (const [pathname, marker] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), new RegExp(marker), pathname);
  }
});

test("vinext static cache resolves every nested page resource on Windows", async () => {
  const [{ StaticFileCache }, response, packageSource] = await Promise.all([
    import("../node_modules/vinext/dist/server/static-file-cache.js"),
    render(),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);
  assert.equal(packageJson.devDependencies.vinext, "0.0.55");

  const html = await response.text();
  const resources = localResourcePaths(html);
  const clientDir = fileURLToPath(new URL("../dist/client/", import.meta.url));
  const cache = await StaticFileCache.create(clientDir);

  for (const resource of resources) {
    assert.ok(cache.lookup(resource), `static cache should contain ${resource}`);
  }
});

test("matches 2026 Inner Mongolia ranks by first-choice subject", () => {
  assert.deepEqual(lookupRank("历史", 419), {
    rank: 18_323,
    rangeStart: 18_194,
    rangeEnd: 18_323,
    sameScoreCount: 130,
  });
  assert.deepEqual(lookupRank("物理", 419), {
    rank: 53_224,
    rangeStart: 52_927,
    rangeEnd: 53_224,
    sameScoreCount: 298,
  });
  assert.equal(lookupRank("历史", -1), null);
  assert.equal(lookupRank("物理", 751), null);
});

test("accepts only valid Inner Mongolia 3+1+2 subject combinations", () => {
  const validPairs = [
    ["化学", "生物学"],
    ["化学", "思想政治"],
    ["化学", "地理"],
    ["生物学", "思想政治"],
    ["生物学", "地理"],
    ["思想政治", "地理"],
  ];

  for (const firstSubject of ["物理", "历史"]) {
    for (const secondSubjects of validPairs) {
      assert.equal(validateSubjectCombination({ firstSubject, secondSubjects }).valid, true);
    }
  }

  for (const candidate of [
    { firstSubject: "物理", secondSubjects: [] },
    { firstSubject: "历史", secondSubjects: ["化学"] },
    { firstSubject: "物理", secondSubjects: ["化学", "化学"] },
    { firstSubject: "历史", secondSubjects: ["化学", "地理", "生物学"] },
    { firstSubject: "语文", secondSubjects: ["化学", "地理"] },
    { firstSubject: "物理", secondSubjects: ["化学", "英语"] },
  ]) {
    assert.equal(validateSubjectCombination(candidate).valid, false);
  }
});

test("recalculates risk and preference fit from the current profile", () => {
  const group = schoolGroups.find((item) => item.id === "imu-physics-chemistry");
  assert.ok(group);

  const profile = {
    firstSubject: "物理",
    score: "558",
    targetSchool: "",
    preferredRegion: "内蒙古优先",
    preferredMajor: "计算机与电子信息",
    schoolType: "公办优先",
    tuition: "每年 1 万元以内",
  };

  assert.equal(calculateRisk(group, profile), "稳");
  assert.ok(calculateFit(group, profile, ["电子信息类", "公办优先"]) > calculateFit(group, { ...profile, preferredMajor: "不限", preferredRegion: "不限地域", schoolType: "不限", tuition: "不限" }));
  assert.equal(calculateRisk(group, { ...profile, score: "650" }), "保");
  assert.equal(calculateRisk(group, { ...profile, score: "450" }), "冲");
});
