import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE = "https://www.nm.zsks.cn/ztzl/pagkpt/";
const OUTPUT = resolve("public/data/announcements.json");
const ACTIVE_START = { month: 6, day: 7 };
const ACTIVE_END = { month: 8, day: 20 };

function cleanText(value = "") {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(href) {
  return new URL(href, SOURCE).toString();
}

function classify(title) {
  if (/军队|军校|公安|司法|消防|电子科技学院|军士/.test(title)) {
    return "特殊招生";
  }
  if (/征集|填报志愿|模拟演练/.test(title)) return "志愿公告";
  if (/招生计划|计划变更/.test(title)) return "招生计划";
  return "政策资讯";
}

function isInActiveWindow(date) {
  const value = (date.getMonth() + 1) * 100 + date.getDate();
  return (
    value >= ACTIVE_START.month * 100 + ACTIVE_START.day &&
    value <= ACTIVE_END.month * 100 + ACTIVE_END.day
  );
}

function parseLinks(html) {
  const candidates = [];
  const linkPattern =
    /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>\s*(?:<[^>]+>)*\s*(\d{2}-\d{2})?/gi;
  let match;
  while ((match = linkPattern.exec(html))) {
    const title = cleanText(match[2]);
    if (
      title.length < 12 ||
      !/高考|志愿|招生|院校|录取|投档|军校|公安|司法|艺术|体育/.test(title)
    ) {
      continue;
    }
    candidates.push({
      title,
      date: match[3] ? `2026-${match[3]}` : "",
      category: classify(title),
      url: absoluteUrl(match[1]),
    });
  }
  return [...new Map(candidates.map((item) => [item.url, item])).values()].slice(
    0,
    80
  );
}

async function main() {
  const now = new Date();
  if (process.env.FORCE_SYNC !== "1" && !isInActiveWindow(now)) {
    console.log("Outside the June 7–August 20 sync window; no changes made.");
    return;
  }

  const response = await fetch(SOURCE, {
    headers: {
      "user-agent":
        "MengZhiYuan/0.1 (+public-interest admissions information index)",
    },
  });
  if (!response.ok) {
    throw new Error(`Official source returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const items = parseLinks(html);
  if (!items.length) {
    throw new Error("No announcement links parsed; preserving the previous file.");
  }

  let previous = { items: [] };
  try {
    previous = JSON.parse(await readFile(OUTPUT, "utf8"));
  } catch {
    // The first successful sync creates the file.
  }

  const merged = [
    ...items,
    ...(Array.isArray(previous.items) ? previous.items : []),
  ];
  const unique = [...new Map(merged.map((item) => [item.url, item])).values()];

  const payload = {
    source: SOURCE,
    sourceName: "内蒙古自治区教育考试院·平安高考",
    updatedAt: now.toISOString(),
    items: unique.slice(0, 120),
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Synced ${items.length} official announcements.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
