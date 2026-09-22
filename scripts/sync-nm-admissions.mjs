import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OFFICIAL_ORIGIN = "https://www.nm.zsks.cn";
const PLAN_INDEX = `${OFFICIAL_ORIGIN}/26gkwb/26zsjh/`;
const CORRECTION_INDEX = `${PLAN_INDEX}jhkw/`;
const OUTPUT_ROOT = resolve("public/data/admissions-2026");
const SHARD_COUNT = 32;

const PLAN_BATCHES = [
  {
    id: "undergraduate-early-a",
    name: "本科提前批A段",
    base: `${PLAN_INDEX}gkjh_26_1/`,
  },
  {
    id: "undergraduate-early-b",
    name: "本科提前批B段",
    base: `${PLAN_INDEX}gkjh_26_2_0623/`,
  },
  {
    id: "undergraduate",
    name: "本科批",
    base: `${PLAN_INDEX}gkjh_26_3_0623/`,
  },
  {
    id: "vocational-early",
    name: "高职（专科）提前批",
    base: `${PLAN_INDEX}gkjh_26_6/`,
  },
  {
    id: "vocational",
    name: "高职（专科）批",
    base: `${PLAN_INDEX}gkjh_26_7_0622/`,
  },
];

const SCORE_INDEXES = [
  {
    kind: "投档",
    base: `${OFFICIAL_ORIGIN}/kszs/ptgk/xxcx/25gktdzgzdf/`,
  },
  {
    kind: "录取",
    base: `${OFFICIAL_ORIGIN}/kszs/ptgk/xxcx/25gklqzgzdf/`,
  },
];

function ensureSafeOutputPath(path) {
  const publicDataRoot = resolve("public/data");
  if (path !== publicDataRoot && !path.startsWith(`${publicDataRoot}${sep}`)) {
    throw new Error(`Refusing to modify a path outside public/data: ${path}`);
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function shortHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function normalizeName(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/[（）]/g, (character) => (character === "（" ? "(" : ")"))
    .replace(/\s+/g, "")
    .trim();
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}

function decodeEntities(value = "") {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    ldquo: "“",
    lt: "<",
    middot: "·",
    nbsp: " ",
    quot: '"',
    rdquo: "”",
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function cleanHtml(value = "") {
  return decodeEntities(
    String(value)
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>|<\/p>|<\/div>|<\/li>|<\/tr>/gi, "\n")
      .replace(/<\/td>|<\/th>/gi, " | ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanCell(value) {
  if (value == null) return "";
  return cleanHtml(String(value)).replace(/^\|\s*|\s*\|$/g, "").trim();
}

async function download(url) {
  const executable = process.platform === "win32" ? "curl.exe" : "curl";
  const commonArgs = [
    "-fsSL",
    "--retry",
    "2",
    "--connect-timeout",
    "20",
    "--max-time",
    "180",
    "--user-agent",
    "MengZhiYuan/1.0 (+official admissions data index)",
  ];
  const platformArgs = process.platform === "win32"
    ? []
    : ["--ciphers", "DEFAULT:@SECLEVEL=1"];
  const { stdout } = await execFileAsync(
    executable,
    [...commonArgs, ...platformArgs, url],
    {
      encoding: "buffer",
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
    },
  );
  return stdout.toString("utf8");
}

async function downloadJson(url) {
  return JSON.parse(stripBom(await download(url)));
}

function extractLinks(html, baseUrl) {
  const links = [];
  const pattern = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*?(?:title=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    let url;
    try {
      url = new URL(match[1], baseUrl).toString();
    } catch {
      continue;
    }
    const title = cleanHtml(match[2] || match[3]);
    links.push({ title, url });
  }
  return links;
}

function extractDateNear(html, url) {
  const filename = url.split("/").pop();
  if (!filename) return "";
  const offset = html.indexOf(filename);
  if (offset < 0) return "";
  return html.slice(offset, offset + 1000).match(/20\d{2}-\d{2}-\d{2}/)?.[0] ?? "";
}

function getArticleContent(html) {
  const editorMatch = html.match(
    /<div\b[^>]*class\s*=\s*(?:["'][^"']*TRS_Editor[^"']*["']|TRS_Editor)[^>]*>/i,
  );
  if (editorMatch?.index != null) {
    const start = editorMatch.index + editorMatch[0].length;
    const relatedDocuments = html.indexOf("<!-- 相关文档 -->", start);
    const end = relatedDocuments >= 0 ? relatedDocuments : html.length;
    const content = cleanHtml(html.slice(start, end));
    if (content) return content;
  }
  const candidates = [
    /<div\b[^>]*class=["'][^"']*TRS_Editor[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    /<div\b[^>]*class=["'][^"']*(?:content|article)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
  ];
  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanHtml(match[1]);
  }
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return cleanHtml(body);
}

function extractEmbeddedImages(html, articleUrl) {
  const images = [];
  const documentId = articleUrl.match(/t20\d+_(\d+)\.html$/i)?.[1] ?? shortHash(articleUrl);
  const pattern = /<img\b[^>]*src=["']data:(image\/(?:png|jpeg|webp));base64,([^"']+)["'][^>]*>/gi;
  let match;
  let index = 0;
  while ((match = pattern.exec(html))) {
    index += 1;
    const extension = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
    images.push({
      file: `/data/admissions-2026/correction-images/${documentId}-${index}.${extension}`,
      mimeType: match[1],
      base64: match[2].replace(/\s+/g, ""),
    });
  }
  return images;
}

function buildSchoolId(code, name) {
  return `${String(code || "unknown").toLowerCase()}-${shortHash(normalizeName(name))}`;
}

function shardFor(id) {
  return Number.parseInt(shortHash(id), 16) % SHARD_COUNT;
}

function valueFrom(record, ...keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return "";
}

function scoreNumber(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeScore(record, source) {
  const schoolCode = String(valueFrom(record, "YXDH", "yxdh")).trim();
  const schoolName = cleanCell(valueFrom(record, "YXMC", "yxmc"));
  const minimumScore = scoreNumber(valueFrom(record, "ZDF", "zdf", "LQZDF", "lqzdf"));
  const maximumScore = scoreNumber(valueFrom(record, "ZGF", "zgf", "LQZGF", "lqzgf"));
  const count = scoreNumber(valueFrom(record, "TDRS", "tdrs", "LQRS", "lqrs", "RS", "rs"));
  const knownKeys = new Set([
    "PCMC", "pcmc", "KLMC", "klmc", "YXDH", "yxdh", "YXMC", "yxmc",
    "JHLBMC", "jhlbmc", "ZYZDH", "zyzdh", "JHZYZDM", "jhzyzdm",
    "ZGF", "zgf", "ZDF", "zdf", "LQZGF", "lqzgf", "LQZDF", "lqzdf",
    "TDRS", "tdrs", "LQRS", "lqrs", "RS", "rs", "title",
  ]);
  const details = Object.fromEntries(
    Object.entries(record)
      .filter(([key, value]) => !knownKeys.has(key) && value !== "" && value != null)
      .map(([key, value]) => [key, typeof value === "string" ? cleanCell(value) : value]),
  );
  return {
    year: 2025,
    kind: source.kind,
    roundTitle: source.title,
    publishedAt: source.publishedAt,
    sourceUrl: source.pageUrl,
    schoolCode,
    schoolName,
    batch: cleanCell(valueFrom(record, "PCMC", "pcmc")),
    subject: cleanCell(valueFrom(record, "KLMC", "klmc")),
    planCategory: cleanCell(valueFrom(record, "JHLBMC", "jhlbmc")),
    professionalGroup: cleanCell(valueFrom(record, "ZYZDH", "zyzdh", "JHZYZDM", "jhzyzdm")),
    count,
    maximumScore,
    minimumScore,
    details,
  };
}

async function loadPlanData() {
  const planRows = [];
  const categories = [];
  const institutionRows = [];
  const sources = [];

  for (const batch of PLAN_BATCHES) {
    const urls = {
      categories: `${batch.base}data/jhkl.json`,
      institutions: `${batch.base}data/jhyx.json`,
      majors: `${batch.base}data/jhzy.json`,
      page: `${batch.base}jh/jhkl.html`,
    };
    const [batchCategories, batchInstitutions, batchMajors] = await Promise.all([
      downloadJson(urls.categories),
      downloadJson(urls.institutions),
      downloadJson(urls.majors),
    ]);
    categories.push(...batchCategories.map((row) => ({ ...row, batchId: batch.id, batchName: batch.name })));
    institutionRows.push(...batchInstitutions.map((row) => ({ ...row, batchId: batch.id, batchName: batch.name })));
    planRows.push(...batchMajors.map((row) => ({ ...row, batchId: batch.id, batchName: batch.name })));
    sources.push({
      type: "招生计划",
      year: 2026,
      batchId: batch.id,
      batchName: batch.name,
      url: urls.page,
      categoryRows: batchCategories.length,
      institutionRows: batchInstitutions.length,
      majorRows: batchMajors.length,
    });
    console.log(`${batch.name}: ${batchInstitutions.length} 个院校科类，${batchMajors.length} 条专业计划`);
  }

  return { categories, institutionRows, planRows, sources };
}

async function loadScoreData() {
  const allScores = [];
  const sources = [];

  for (const index of SCORE_INDEXES) {
    const pages = [`${index.base}index.html`, `${index.base}index_1.html`];
    const resultLinks = [];
    for (const pageUrl of pages) {
      let html;
      try {
        html = await download(pageUrl);
      } catch (error) {
        if (pageUrl.endsWith("index_1.html")) continue;
        throw error;
      }
      for (const link of extractLinks(html, pageUrl)) {
        if (!/25gktdlq\/.+\/(?:tj|lq)\/.+\.html$/i.test(link.url)) continue;
        resultLinks.push({
          ...link,
          kind: index.kind,
          publishedAt: extractDateNear(html, link.url),
        });
      }
    }

    const uniqueLinks = [...new Map(resultLinks.map((link) => [link.url, link])).values()];
    for (const link of uniqueLinks) {
      const html = await download(link.url);
      const jsonPath = html.match(/url\s*:\s*["']([^"']+\.json)["']/i)?.[1];
      if (!jsonPath) {
        console.warn(`未在结果页找到 JSON: ${link.url}`);
        continue;
      }
      const jsonUrl = new URL(jsonPath, link.url).toString();
      const records = await downloadJson(jsonUrl);
      const source = {
        kind: link.kind,
        title: link.title || cleanCell(records[0]?.title) || `${link.kind}分数`,
        publishedAt: link.publishedAt,
        pageUrl: link.url,
        jsonUrl,
        rows: records.length,
      };
      sources.push(source);
      allScores.push(...records.map((record) => normalizeScore(record, source)));
      console.log(`${source.title}: ${records.length} 条`);
    }
  }

  const seen = new Set();
  return {
    scores: allScores.filter((score) => {
      const key = JSON.stringify(score);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    sources,
  };
}

async function loadCorrections() {
  const html = await download(CORRECTION_INDEX);
  const links = extractLinks(html, CORRECTION_INDEX)
    .filter((link) => /\/jhkw\/20\d{4}\/t20\d+_\d+\.html$/i.test(link.url));
  const uniqueLinks = [...new Map(links.map((link) => [link.url, link])).values()];
  const corrections = [];

  for (const link of uniqueLinks) {
    const articleHtml = await download(link.url);
    const embeddedImages = extractEmbeddedImages(articleHtml, link.url);
    const codes = unique([
      ...link.title.matchAll(/[（(]([A-Z0-9]{3})[）)]/gi),
    ].map((match) => match[1].toUpperCase()));
    corrections.push({
      title: link.title,
      publishedAt: extractDateNear(html, link.url),
      url: link.url,
      schoolCodes: codes,
      content: getArticleContent(articleHtml),
      embeddedImages: embeddedImages.map(({ file, mimeType }) => ({ file, mimeType })),
      _embeddedImages: embeddedImages,
    });
  }

  return corrections;
}

function applyOfficialCorrections(planData, corrections) {
  const rows = planData.planRows;
  const correctionByDocumentId = new Map(
    corrections.map((correction) => [
      correction.url.match(/t20\d+_(\d+)\.html$/i)?.[1] ?? "",
      correction,
    ]),
  );

  function correction(documentId) {
    const item = correctionByDocumentId.get(documentId);
    if (!item) throw new Error(`Missing official correction ${documentId}`);
    item.appliedChanges ??= [];
    return item;
  }

  function matchRows(criteria) {
    return rows.filter((row) => Object.entries(criteria).every(([key, value]) => {
      if (key === "yxdh") return String(row[key]).toUpperCase() === String(value).toUpperCase();
      return cleanCell(row[key]) === value;
    }));
  }

  function recordAdjustment(row, item, field, before, after, note) {
    row._adjustments ??= [];
    row._adjustments.push({
      field,
      before,
      after,
      note,
      title: item.title,
      publishedAt: item.publishedAt,
      sourceUrl: item.url,
    });
    item.schoolCodes = unique([...item.schoolCodes, String(row.yxdh).toUpperCase()]);
    item.appliedChanges.push({
      schoolCode: String(row.yxdh),
      schoolName: cleanCell(row.yxmc),
      majorCode: cleanCell(row.zydh),
      majorName: cleanCell(row.zymc),
      field,
      before,
      after,
      note,
    });
  }

  function updateExactlyOne(documentId, criteria, field, after, note) {
    const matches = matchRows(criteria);
    if (matches.length !== 1) {
      throw new Error(`Correction ${documentId} expected 1 plan row, found ${matches.length}: ${JSON.stringify(criteria)}`);
    }
    const item = correction(documentId);
    const row = matches[0];
    const before = row[field] ?? "";
    row[field] = after;
    recordAdjustment(row, item, field, before, after, note);
  }

  function incrementPlan(documentId, criteria, amount) {
    const matches = matchRows(criteria);
    if (matches.length !== 1) {
      throw new Error(`Correction ${documentId} expected 1 plan row, found ${matches.length}: ${JSON.stringify(criteria)}`);
    }
    const item = correction(documentId);
    const row = matches[0];
    const before = Number(row.syjh) || 0;
    const after = before + amount;
    row.syjh = after;
    recordAdjustment(row, item, "syjh", before, after, `官方增补 ${amount} 人`);
  }

  const counterpartCorrection = correction("46474");
  const detailedCorrection = correction("46539");
  const addedUndergraduatePlans = [
    ["755", "内蒙古农业大学", "财会类", "904", "C4", "大数据与会计", "5000", "土默特右旗校区", 25],
    ["755", "内蒙古农业大学", "财会类", "904", "C5", "市场营销", "5000", "土默特右旗校区", 25],
    ["755", "内蒙古农业大学", "机电类", "948", "C1", "农业智能装备工程", "5000", "土默特右旗校区", 50],
    ["755", "内蒙古农业大学", "机电类", "948", "C2", "车辆工程", "5000", "土默特右旗校区", 25],
    ["755", "内蒙古农业大学", "机电类", "949", "C3", "新能源汽车工程技术", "5000", "土默特右旗校区", 25],
    ["K92", "鄂尔多斯应用技术学院", "机电类", "019", "Z1", "智能制造工程技术", "4600", "康巴什校区", 60],
    ["757", "内蒙古科技大学包头师范学院", "机电类", "121", "C6", "智能制造工程", "4600", "九原校区", 50],
    ["766", "呼伦贝尔学院", "机电类", "055", "D1", "机械设计制造及其自动化（智能制造方向）", "10000", "校本部", 40],
  ];
  const subjectCode = { 财会类: "Q", 机电类: "V" };
  for (const [code, name, subject, group, majorCode, majorName, tuition, campus, planCount] of addedUndergraduatePlans) {
    const criteria = { yxdh: code, klmc: subject, jhzyzdm: group, zydh: majorCode };
    if (matchRows(criteria).length) {
      throw new Error(`Correction 46539 plan already exists unexpectedly: ${JSON.stringify(criteria)}`);
    }
    const row = {
      pcmc: "本科批",
      klmc: subject,
      yxdh: code,
      yxmc: name,
      jhzyzdm: group,
      zydh: majorCode,
      zymc: majorName,
      jhxzmc: "非定向",
      syjh: planCount,
      xznx: "4",
      xf: tuition,
      wyyzmc: "不限",
      bxdd: campus,
      jhlbmc: "招收中职毕业生",
      kycs: "否",
      kskmyqzw: "",
      path: `3${subjectCode[subject]}${code}`,
      title: `本科批  ${subject}  ${code}  ${name}`,
      batchId: "undergraduate",
      batchName: "本科批",
      _adjustments: [],
    };
    rows.push(row);
    recordAdjustment(row, detailedCorrection, "syjh", 0, planCount, "官方增补计划");
    counterpartCorrection.schoolCodes = unique([...counterpartCorrection.schoolCodes, code]);
    counterpartCorrection.appliedChanges.push({
      schoolCode: code,
      schoolName: name,
      subject,
      field: "syjh",
      before: 0,
      after: planCount,
      note: "总量公告对应的分专业增补",
    });
  }

  updateExactlyOne("46537", { yxdh: "719", klmc: "历史类", zydh: "F1" }, "jhzyzdm", "004", "专业组由001调整为004");
  updateExactlyOne("46536", { yxdh: "767", klmc: "物理类", jhzyzdm: "089", zydh: "76" }, "xznx", "4", "学制由五年调整为四年");
  updateExactlyOne("46477", { yxdh: "R01", klmc: "美术与设计类", jhzyzdm: "003", zydh: "2T" }, "xf", "59000", "明确学费为59000元/学年");
  updateExactlyOne("46476", { yxdh: "766", klmc: "历史类（专项类）", jhzyzdm: "102", zydh: "A7" }, "zymc", "中国少数民族语言文学", "删除原专业名称中的“（师范类）”");
  updateExactlyOne("46475", { yxdh: "752", klmc: "历史类", jhzyzdm: "087", zydh: "R2" }, "bz", "国际本科互认课程", "增加专业备注");
  for (const subject of ["历史类", "物理类"]) {
    updateExactlyOne("46633", { yxdh: "E75", klmc: subject, zydh: "Z1" }, "xf", "22000", "明确中外合作办学专业学费为22000元/学年");
  }

  const dalianIncrements = [
    ["美术与设计类", "053", "69", 3],
    ["美术与设计类", "053", "66", 4],
    ["美术与设计类", "053", "78", 2],
    ["音乐表演（声乐方向）", "052", "62", 2],
  ];
  for (const [subject, group, majorCode, amount] of dalianIncrements) {
    incrementPlan("46634", { yxdh: "716", klmc: subject, jhzyzdm: group, zydh: majorCode }, amount);
  }

  const heilongjiangIncrements = [
    ["舞蹈类", "001", "04", 10],
    ["戏剧影视表演", "002", "09", 5],
    ["播音与主持", "003", "0E", 4],
    ["书法类", "004", "19", 20],
  ];
  for (const [subject, group, majorCode, amount] of heilongjiangIncrements) {
    incrementPlan("46637", { yxdh: "B05", klmc: subject, jhzyzdm: group, zydh: majorCode }, amount);
  }

  const hongKongRows = matchRows({ yxdh: "J27" });
  const hongKongCorrection = correction("46432");
  const movedRows = hongKongRows.filter((row) => ["01", "02", "03", "04", "05", "06"].includes(cleanCell(row.zydh)));
  if (movedRows.length !== 6 || movedRows.some((row) => cleanCell(row.batchName || row.pcmc) !== "本科提前批B段")) {
    throw new Error("Correction 46432 is not reflected correctly in the published base JSON");
  }
  hongKongCorrection.schoolCodes = unique([...hongKongCorrection.schoolCodes, "J27"]);
  hongKongCorrection.appliedChanges.push({
    schoolCode: "J27",
    schoolName: "香港中文大学",
    field: "batch",
    before: "本科批",
    after: "本科提前批B段",
    note: "基础JSON已包含本次调整，校验通过",
  });
}

function buildCatalog({ categories, institutionRows, planRows }, scoreData, corrections, generatedAt) {
  const schools = new Map();

  for (const row of planRows) {
    const code = String(row.yxdh ?? "").trim();
    const name = cleanCell(row.yxmc);
    const id = buildSchoolId(code, name);
    if (!schools.has(id)) {
      schools.set(id, {
        id,
        code,
        name,
        normalizedName: normalizeName(name),
        officialCharterUrl: "",
        offerings: new Map(),
        scoreHistory: [],
        corrections: [],
        scoreMatch: null,
      });
    }
    const school = schools.get(id);
    const offeringKey = [
      row.batchId,
      row.klmc,
      row.jhlbmc,
      row.jhzyzdm,
      row.path,
    ].join("|");
    if (!school.offerings.has(offeringKey)) {
      school.offerings.set(offeringKey, {
        id: `${id}-${shortHash(offeringKey)}`,
        batchId: row.batchId,
        batch: cleanCell(row.batchName || row.pcmc),
        subject: cleanCell(row.klmc),
        planCategory: cleanCell(row.jhlbmc),
        professionalGroup: cleanCell(row.jhzyzdm),
        officialPath: cleanCell(row.path),
        majors: [],
      });
    }
    school.offerings.get(offeringKey).majors.push({
      code: cleanCell(row.zydh),
      name: cleanCell(row.zymc),
      includedMajors: cleanCell(row.bhzygs),
      planNature: cleanCell(row.jhxzmc),
      planCount: Number(row.syjh) || 0,
      durationYears: cleanCell(row.xznx),
      tuition: cleanCell(row.xf),
      foreignLanguage: cleanCell(row.wyyzmc),
      oralExam: cleanCell(row.kycs),
      subjectRequirement: cleanCell(row.kskmyqzw),
      notes: cleanCell(row.bz),
      campus: cleanCell(row.bxdd),
      adjustments: Array.isArray(row._adjustments) ? row._adjustments : [],
    });
  }

  const charterByCodeAndName = new Map();
  for (const row of institutionRows) {
    const key = `${String(row.yxdh ?? "").trim()}|${normalizeName(row.yxmc)}`;
    if (row.zszc) charterByCodeAndName.set(key, String(row.zszc));
  }
  for (const school of schools.values()) {
    school.officialCharterUrl = charterByCodeAndName.get(`${school.code}|${school.normalizedName}`) ?? "";
  }

  const schoolByExact = new Map(
    [...schools.values()].map((school) => [`${school.code}|${school.normalizedName}`, school]),
  );
  const schoolsByName = new Map();
  for (const school of schools.values()) {
    const bucket = schoolsByName.get(school.normalizedName) ?? [];
    bucket.push(school);
    schoolsByName.set(school.normalizedName, bucket);
  }

  const unmatchedScores = [];
  for (const score of scoreData.scores) {
    const normalizedScoreName = normalizeName(score.schoolName);
    let school = schoolByExact.get(`${score.schoolCode}|${normalizedScoreName}`);
    let matchedBy = "院校代码+院校名称";
    if (!school) {
      const nameMatches = schoolsByName.get(normalizedScoreName) ?? [];
      if (nameMatches.length === 1) {
        [school] = nameMatches;
        matchedBy = "唯一院校名称";
      }
    }
    if (!school) {
      unmatchedScores.push(score);
      continue;
    }
    school.scoreHistory.push({ ...score, matchedBy });
    school.scoreMatch = matchedBy;
  }

  for (const correction of corrections) {
    const matched = new Set();
    for (const school of schools.values()) {
      if (
        correction.schoolCodes.includes(school.code.toUpperCase()) ||
        correction.title.includes(school.name)
      ) {
        matched.add(school.id);
        school.corrections.push(correction);
      }
    }
    correction.matchedSchoolIds = [...matched];
  }

  const details = [];
  const summaries = [];
  for (const school of schools.values()) {
    const offerings = [...school.offerings.values()]
      .map((offering) => ({
        ...offering,
        planCount: offering.majors.reduce((sum, major) => sum + major.planCount, 0),
      }))
      .sort((left, right) =>
        left.batch.localeCompare(right.batch, "zh-CN") ||
        left.subject.localeCompare(right.subject, "zh-CN") ||
        left.professionalGroup.localeCompare(right.professionalGroup, "zh-CN"),
      );
    const majors = offerings.flatMap((offering) => offering.majors);
    const numericTuitions = majors
      .map((major) => Number(String(major.tuition).replace(/[^0-9.]/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0);
    const scoreValues = school.scoreHistory
      .flatMap((score) => [score.minimumScore, score.maximumScore])
      .filter((value) => typeof value === "number" && Number.isFinite(value));
    const shard = shardFor(school.id);
    const detail = {
      id: school.id,
      code: school.code,
      name: school.name,
      officialCharterUrl: school.officialCharterUrl,
      offerings,
      scoreHistory: school.scoreHistory.sort((left, right) =>
        right.publishedAt.localeCompare(left.publishedAt) || left.kind.localeCompare(right.kind, "zh-CN"),
      ),
      corrections: school.corrections,
      sources: {
        planIndex: PLAN_INDEX,
        correctionIndex: CORRECTION_INDEX,
      },
    };
    details.push({ shard, detail });
    summaries.push({
      id: school.id,
      code: school.code,
      name: school.name,
      detailFile: `/data/admissions-2026/schools-${String(shard).padStart(2, "0")}.json`,
      batches: unique(offerings.map((offering) => offering.batch)),
      subjects: unique(offerings.map((offering) => offering.subject)),
      planCategories: unique(offerings.map((offering) => offering.planCategory)),
      planCount: offerings.reduce((sum, offering) => sum + offering.planCount, 0),
      majorCount: majors.length,
      groupCount: offerings.length,
      tuitionMin: numericTuitions.length ? Math.min(...numericTuitions) : null,
      tuitionMax: numericTuitions.length ? Math.max(...numericTuitions) : null,
      score2025Min: scoreValues.length ? Math.min(...scoreValues) : null,
      score2025Max: scoreValues.length ? Math.max(...scoreValues) : null,
      scoreRecordCount: school.scoreHistory.length,
      scoreMatch: school.scoreMatch,
      correctionCount: school.corrections.length,
    });
  }

  summaries.sort((left, right) =>
    left.name.localeCompare(right.name, "zh-CN") || left.code.localeCompare(right.code),
  );

  const totalPlanCount = summaries.reduce((sum, school) => sum + school.planCount, 0);
  const catalog = {
    meta: {
      year: 2026,
      generatedAt,
      sourceName: "内蒙古自治区教育考试院",
      sourceUrl: PLAN_INDEX,
      correctionUrl: CORRECTION_INDEX,
      schoolCount: summaries.length,
      offeringCount: summaries.reduce((sum, school) => sum + school.groupCount, 0),
      majorRowCount: planRows.length,
      totalPlanCount,
      subjectCount: unique(categories.map((row) => row.klmc)).length,
      correctionCount: corrections.length,
      scoreYear: 2025,
      scoreRecordCount: scoreData.scores.length,
      matchedScoreRecordCount: scoreData.scores.length - unmatchedScores.length,
      unmatchedScoreRecordCount: unmatchedScores.length,
      scoreNote: "2025年是内蒙古3+1+2新高考首年，与2026专业组口径可比；分数按官方院校代码+院校名称匹配，院校名称唯一时才使用名称兜底。",
    },
    filters: {
      batches: unique(summaries.flatMap((school) => school.batches)),
      subjects: unique(summaries.flatMap((school) => school.subjects)),
      planCategories: unique(summaries.flatMap((school) => school.planCategories)),
    },
    schools: summaries,
  };

  return { catalog, details, unmatchedScores };
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`, "utf8");
}

async function main() {
  ensureSafeOutputPath(OUTPUT_ROOT);
  const generatedAt = new Date().toISOString();
  const [planData, scoreData, corrections] = await Promise.all([
    loadPlanData(),
    loadScoreData(),
    loadCorrections(),
  ]);
  applyOfficialCorrections(planData, corrections);
  const correctionImages = corrections.flatMap((correction) => correction._embeddedImages);
  const publicCorrections = corrections.map((correction) => {
    const publicCorrection = { ...correction };
    delete publicCorrection._embeddedImages;
    return publicCorrection;
  });
  const { catalog, details, unmatchedScores } = buildCatalog(
    planData,
    scoreData,
    publicCorrections,
    generatedAt,
  );

  await rm(OUTPUT_ROOT, { force: true, recursive: true });
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await writeJson(resolve(OUTPUT_ROOT, "catalog.json"), catalog);
  await writeJson(resolve(OUTPUT_ROOT, "corrections.json"), {
    source: CORRECTION_INDEX,
    generatedAt,
    items: publicCorrections,
  });
  await writeJson(resolve(OUTPUT_ROOT, "sources.json"), {
    generatedAt,
    plan: planData.sources,
    scores: scoreData.sources,
  });
  await writeJson(resolve(OUTPUT_ROOT, "unmatched-scores-2025.json"), {
    generatedAt,
    count: unmatchedScores.length,
    items: unmatchedScores,
  });

  const shards = Array.from({ length: SHARD_COUNT }, () => ({}));
  for (const { shard, detail } of details) {
    shards[shard][detail.id] = detail;
  }
  await Promise.all(
    shards.map((shard, index) => writeJson(
      resolve(OUTPUT_ROOT, `schools-${String(index).padStart(2, "0")}.json`),
      shard,
    )),
  );
  await Promise.all(
    correctionImages.map(async (image) => {
      const relativePath = image.file.replace(/^\/data\/admissions-2026\//, "");
      const outputPath = resolve(OUTPUT_ROOT, relativePath);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, Buffer.from(image.base64, "base64"));
    }),
  );

  let previousGeneratedAt = "";
  try {
    const previous = JSON.parse(await readFile(resolve(OUTPUT_ROOT, "catalog.json"), "utf8"));
    previousGeneratedAt = previous.meta?.generatedAt ?? "";
  } catch {
    // The generated catalog was just written; this is only a defensive audit read.
  }

  console.log("\n同步完成");
  console.log(JSON.stringify({
    generatedAt: previousGeneratedAt || generatedAt,
    ...catalog.meta,
    correctionMatchedSchools: publicCorrections.reduce((sum, item) => sum + item.matchedSchoolIds.length, 0),
    correctionImageCount: correctionImages.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
