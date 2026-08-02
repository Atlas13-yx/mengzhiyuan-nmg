import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { lookupRank } from "../app/score-ranks.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
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
  const resourcePattern = /(?:src|href)=["'](\/[^"']+)["']/g;

  for (const match of html.matchAll(resourcePattern)) {
    paths.add(new URL(match[1], "http://localhost").pathname);
  }

  paths.add("/favicon.svg");
  paths.add("/data/announcements.json");
  return [...paths].sort();
}

test("server-renders the current volunteer-planning page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>蒙志愿｜内蒙古高考志愿智能决策平台<\/title>/);
  assert.match(html, /我的 2026 志愿档案/);
  assert.match(html, />编辑<\/button>/);
  assert.match(html, /院校专业组跨年对比/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);

  const resources = localResourcePaths(html);
  assert.ok(resources.some((resource) => resource.startsWith("/_next/static/")));
  assert.ok(resources.every((resource) => !resource.includes("\\")));
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
