import type {
  AdmissionsCatalogMeta,
  AdmissionsMajor,
  AdmissionsOffering,
  AdmissionsSchoolDetail,
  AdmissionsSchoolSummary,
} from "./admissions-data.ts";
import { validateSubjectCombination } from "./subject-policy.ts";

export type OfficialSavedGroup = {
  id: string;
  year: number;
  schoolId: string;
  schoolCode: string;
  schoolName: string;
  detailFile: string;
  sourceUrl: string;
  catalogGeneratedAt: string;
  savedAt: string;
  offering: AdmissionsOffering;
  verification: "checking" | "verified" | "offline" | "unavailable";
};

export type OfficialEligibility = {
  status: "eligible" | "blocked" | "review";
  reason: string;
};

export function createOfficialSelection(
  school: AdmissionsSchoolSummary,
  detail: AdmissionsSchoolDetail,
  offering: AdmissionsOffering,
  meta: AdmissionsCatalogMeta,
): OfficialSavedGroup {
  return {
    id: `official:${meta.year}:${offering.id}`,
    year: meta.year,
    schoolId: school.id,
    schoolCode: school.code,
    schoolName: school.name,
    detailFile: school.detailFile,
    sourceUrl: detail.sources.planIndex,
    catalogGeneratedAt: meta.generatedAt,
    savedAt: new Date().toISOString(),
    offering,
    verification: "verified",
  };
}

function normalize(value: string) {
  return value.replaceAll("（", "(").replaceAll("）", ")").replace(/\s+/g, "");
}

/** A matching number is a search candidate, never evidence of unchanged composition. */
export function getHistoricalCandidates(detail: AdmissionsSchoolDetail, offering: AdmissionsOffering) {
  if (!offering.professionalGroup) return [];
  return detail.scoreHistory.filter((score) =>
    normalize(score.batch) === normalize(offering.batch)
    && normalize(score.subject) === normalize(offering.subject)
    && normalize(score.planCategory) === normalize(offering.planCategory)
    && score.professionalGroup === offering.professionalGroup,
  );
}

export function getOfficialEligibility(
  offering: AdmissionsOffering,
  profile: { firstSubject: string; secondSubjects: readonly string[] },
): OfficialEligibility {
  const validation = validateSubjectCombination(profile);
  if (!validation.valid) return { status: "review", reason: validation.reason };
  const firstSubject = offering.subject.startsWith("物理") ? "物理" : offering.subject.startsWith("历史") ? "历史" : null;
  if (!firstSubject) return { status: "review", reason: `${offering.subject}需核验对应考试成绩与招生资格。` };
  if (firstSubject !== profile.firstSubject) return { status: "blocked", reason: `该组要求首选${firstSubject}，与当前档案不符。` };
  const chosen = new Set([profile.firstSubject, ...profile.secondSubjects]);
  const unknownRequirements: string[] = [];
  const missing = new Set<string>();
  for (const major of offering.majors) {
    const requirement = normalize(major.subjectRequirement);
    if (/^(不限|不提科目要求)$/.test(requirement)) continue;
    const names = requirement.replace(/\([^)]*\)/g, "").split(/[,，、＋+]/).filter(Boolean).map((name) => name === "生物" ? "生物学" : name);
    const explicitAll = !requirement.includes("(") || /均须选考|必须选考/.test(requirement);
    if (!names.length || !explicitAll || names.some((name) => !["物理", "历史", "化学", "生物学", "思想政治", "地理"].includes(name))) {
      unknownRequirements.push(major.subjectRequirement || "选科未公布");
      continue;
    }
    for (const name of names) if (!chosen.has(name)) missing.add(name);
  }
  if (missing.size) return { status: "blocked", reason: `该组专业要求选考${[...missing].join("＋")}，当前档案未包含。` };
  if (unknownRequirements.length) return { status: "review", reason: `选科字段需核验：${[...new Set(unknownRequirements)].join("；")}。` };
  if (offering.planCategory !== "普通类" || /提前/.test(offering.batch) || /专项/.test(offering.subject)) {
    return { status: "review", reason: "选科初筛通过；专项、提前批或特殊类别资格尚待人工核验。" };
  }
  return { status: "eligible", reason: "选科初筛通过；仍需核对体检、外语、单科成绩与招生章程。" };
}

function uniqueNames(majors: AdmissionsMajor[]) {
  return [...new Set(majors.map((major) => major.name))];
}

export function compareGroupComposition(current: AdmissionsOffering, previous: AdmissionsOffering | null) {
  if (!previous) return {
    status: "missing" as const,
    added: [] as string[],
    removed: [] as string[],
    changed: [] as string[],
    planDelta: null,
    reason: "缺少往年官方组内专业计划，暂不能判断专业新增、移出或计划增减；相同组号不代表专业构成相同。",
  };
  if (normalize(current.batch) !== normalize(previous.batch) || normalize(current.subject) !== normalize(previous.subject) || normalize(current.planCategory) !== normalize(previous.planCategory)) return {
    status: "incomparable" as const,
    added: [] as string[],
    removed: [] as string[],
    changed: [] as string[],
    planDelta: null,
    reason: "批次、科类或计划类别不同，不能直接计算专业组年度变化。",
  };
  const now = uniqueNames(current.majors);
  const before = uniqueNames(previous.majors);
  const added = now.filter((name) => !before.includes(name));
  const removed = before.filter((name) => !now.includes(name));
  const signature = (items: AdmissionsMajor[]) => items.map((major) => JSON.stringify([
    major.includedMajors, major.subjectRequirement, major.tuition, major.campus,
    major.foreignLanguage, major.oralExam, major.notes, major.durationYears, major.planNature,
  ])).sort().join("|");
  const changed = now.filter((name) => before.includes(name) && signature(current.majors.filter((major) => major.name === name)) !== signature(previous.majors.filter((major) => major.name === name)));
  return {
    status: added.length || removed.length || changed.length ? "changed" as const : "same" as const,
    added,
    removed,
    changed,
    planDelta: current.planCount - previous.planCount,
    reason: current.professionalGroup === previous.professionalGroup ? "已按组内专业和招生条件逐项比较。" : "组号不同；这里只比较已选定的两份专业计划，不自动确认专业组继承关系。",
  };
}

function isOffering(value: unknown): value is AdmissionsOffering {
  if (!value || typeof value !== "object") return false;
  const item = value as AdmissionsOffering;
  return [item.id, item.batch, item.batchId, item.subject, item.planCategory, item.professionalGroup, item.officialPath].every((field) => typeof field === "string")
    && Number.isFinite(item.planCount) && Array.isArray(item.majors) && item.majors.length > 0
    && item.majors.every((major) => major && [major.code, major.name, major.includedMajors, major.subjectRequirement, major.tuition, major.campus, major.foreignLanguage, major.oralExam, major.notes, major.durationYears, major.planNature].every((field) => typeof field === "string") && Number.isFinite(major.planCount) && Array.isArray(major.adjustments));
}

export function restoreOfficialSelections(value: string | null): OfficialSavedGroup[] {
  if (!value) return [];
  try {
    const items = JSON.parse(value);
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    return items.filter((item): item is OfficialSavedGroup => {
      if (!item || !isOffering(item.offering) || !Number.isInteger(item.year)) return false;
      if (![item.id, item.schoolId, item.schoolCode, item.schoolName, item.detailFile, item.sourceUrl, item.catalogGeneratedAt, item.savedAt].every((field) => typeof field === "string")) return false;
      if (item.id !== `official:${item.year}:${item.offering.id}` || seen.has(item.id)) return false;
      if (!/^\/data\/admissions-\d{4}\/schools-\d+\.json$/.test(item.detailFile) || !/^https:\/\/www\.nm\.zsks\.cn\//.test(item.sourceUrl)) return false;
      seen.add(item.id);
      return true;
    }).map((item) => ({ ...item, verification: "checking" }));
  } catch {
    return [];
  }
}

/** Quote every field and neutralize spreadsheet formulas in user-controlled text. */
export function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
