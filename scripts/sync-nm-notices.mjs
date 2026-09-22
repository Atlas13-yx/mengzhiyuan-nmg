import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { get } from "node:https";
import { DEFAULT_CIPHERS } from "node:tls";

export const SOURCE = "https://www.nm.zsks.cn/ztzl/pagkpt/";
export const SOURCES = [SOURCE, new URL("tzgg/", SOURCE).href];
const OUTPUT = resolve("public/data/announcements.json");

export function beijingDate(date) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function getSyncWindow(now = new Date(), env = process.env) {
  const year = beijingDate(now).slice(0, 4);
  const start = env.SYNC_START_DATE || `${year}-06-10`;
  const end = env.SYNC_END_DATE || `${year}-08-31`;
  if (!validDate(start) || !validDate(end) || start > end) {
    throw new Error("SYNC_START_DATE and SYNC_END_DATE must be ordered YYYY-MM-DD dates.");
  }
  return { start, end, timezone: "Asia/Shanghai", intervalMinutes: 60 };
}

export function isInActiveWindow(now, window) {
  const today = beijingDate(now);
  return today >= window.start && today <= window.end;
}

export function cleanText(value = "") {
  return value.replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/\s+/g, " ").trim();
}

export function classify(title) {
  if (/征集|填报|模拟演练/.test(title)) return "志愿公告";
  if (/招生计划|计划变更/.test(title)) return "招生计划";
  if (/分数段|分数线|最高分|最低分|投档分|统计表/.test(title)) return "数据发布";
  if (/军队|军校|公安|司法|消防|电子科技学院|军士|艺术|体育|香港|澳门/.test(title)) return "特殊招生";
  return "政策资讯";
}

export function officialUrl(value, base = SOURCE) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname !== "nm.zsks.cn" && !url.hostname.endsWith(".nm.zsks.cn")) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

function itemKey(item) {
  const article = item.url.match(/\/t(\d{8}_\d+)\.html/);
  return article ? `article:${article[1]}` : `${item.url}|${item.title}`;
}

export function parseLinks(html, source = SOURCE) {
  const candidates = [];
  const content = html.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "");
  const linkPattern = /<a\b([^>]*?)href=["']([^"'#]+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of content.matchAll(linkPattern)) {
    const titleAttribute = `${match[1]} ${match[3]}`.match(/\btitle=["']([^"']*)["']/i);
    const title = cleanText(titleAttribute?.[1] || match[4]);
    const url = officialUrl(cleanText(match[2]), source);
    if (!url || title.length < 12 || !/高考|志愿|招生|院校|录取|投档|军校|公安|司法|艺术|体育/.test(title)) continue;

    // The article path carries its year; never date older notices as this year.
    const pathDate = url.match(/\/t(\d{4})(\d{2})(\d{2})_\d+\.html/);
    const adjacent = content.slice(match.index + match[0].length, match.index + match[0].length + 160);
    const listedDate = adjacent.match(/^\s*<span\b[^>]*>\s*(?:(\d{4})[-年])?(\d{2})[-月](\d{2})(?:日)?\s*<\/span>/i);
    const titleYear = title.match(/\b(20\d{2})年/);
    let date = "";
    let dateSource = "unknown";
    if (listedDate && (listedDate[1] || pathDate?.[1] || titleYear?.[1])) {
      date = `${listedDate[1] || pathDate?.[1] || titleYear?.[1]}-${listedDate[2]}-${listedDate[3]}`;
      dateSource = "official-list";
    } else if (pathDate) {
      date = `${pathDate[1]}-${pathDate[2]}-${pathDate[3]}`;
      dateSource = "article-url";
    }
    if (date && !validDate(date)) { date = ""; dateSource = "unknown"; }
    candidates.push({ title, date, dateSource, category: classify(title), url, source, verification: "official-index" });
  }
  return [...new Map(candidates.map((item) => [itemKey(item), item])).values()];
}

export function mergeItems(current, previous = []) {
  const entries = new Map();
  for (const item of previous) {
    // Legacy example records are never promoted into verified data.
    if (item?.verification === "official-index" && officialUrl(item.url)) entries.set(itemKey(item), item);
  }
  for (const item of current) entries.set(itemKey(item), item);
  return [...entries.values()].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "zh-CN")).slice(0, 240);
}

export function fetchOfficialIndex(url, options = {}, redirects = 0) {
  return new Promise((resolveResponse, reject) => {
    if (!officialUrl(url) || !url.startsWith("https:")) {
      reject(new Error("Only official HTTPS sources may be fetched."));
      return;
    }
    // The official server advertises weak finite-field DH parameters. Exclude
    // DHE negotiation without weakening TLS security levels or certificate checks.
    const request = get(url, { ...options, ciphers: `${DEFAULT_CIPHERS}:!DHE` }, (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        if (redirects >= 3) { reject(new Error("Official source redirected too many times.")); return; }
        let target;
        try { target = new URL(response.headers.location, url).href; }
        catch { reject(new Error("Official source returned an invalid redirect.")); return; }
        fetchOfficialIndex(target, options, redirects + 1).then(resolveResponse, reject);
        return;
      }
      const chunks = [];
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 4 * 1024 * 1024) { response.destroy(new Error("Official index exceeded the size limit.")); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolveResponse({ ok: status >= 200 && status < 300, status, text: async () => Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
  });
}

export async function syncAnnouncements({ now = new Date(), env = process.env, output = OUTPUT, fetchImpl = fetchOfficialIndex } = {}) {
  const syncWindow = getSyncWindow(now, env);
  if (env.FORCE_SYNC !== "1" && !isInActiveWindow(now, syncWindow)) {
    return { skipped: true, reason: `Outside ${syncWindow.start}–${syncWindow.end} (Asia/Shanghai); previous data kept.` };
  }
  const collected = [];
  // An incomplete crawl must not replace a complete feed.
  for (const source of SOURCES) {
    const response = await fetchImpl(source, {
      signal: AbortSignal.timeout(25000),
      headers: { "user-agent": "MengZhiYuan/0.2 (+public-interest admissions information index)" },
    });
    if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}: ${source}; previous data kept.`);
    const items = parseLinks(await response.text(), source);
    if (!items.length) throw new Error(`No announcement links parsed at ${source}; previous data kept.`);
    collected.push(...items);
  }
  let previous = { items: [] };
  try { previous = JSON.parse(await readFile(output, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const payload = {
    schemaVersion: 2,
    source: SOURCE,
    sources: SOURCES,
    sourceName: "内蒙古自治区教育考试院·平安高考",
    updatedAt: now.toISOString(),
    lastSuccessfulSync: now.toISOString(),
    syncWindow,
    items: mergeItems(collected, Array.isArray(previous.items) ? previous.items : []),
  };
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await rename(temporary, output);
  } finally { await rm(temporary, { force: true }); }
  return { skipped: false, count: payload.items.length, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  syncAnnouncements().then((result) => console.log(result.skipped ? result.reason : `Synced ${result.count} official announcements.`))
    .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
