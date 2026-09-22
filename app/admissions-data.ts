export type AdmissionsCatalogMeta = {
  year: number;
  generatedAt: string;
  sourceName: string;
  sourceUrl: string;
  correctionUrl: string;
  schoolCount: number;
  offeringCount: number;
  majorRowCount: number;
  totalPlanCount: number;
  subjectCount: number;
  correctionCount: number;
  scoreYear: number;
  scoreRecordCount: number;
  matchedScoreRecordCount: number;
  unmatchedScoreRecordCount: number;
  scoreNote: string;
};

export type AdmissionsSchoolSummary = {
  id: string;
  code: string;
  name: string;
  detailFile: string;
  batches: string[];
  subjects: string[];
  planCategories: string[];
  planCount: number;
  majorCount: number;
  groupCount: number;
  tuitionMin: number | null;
  tuitionMax: number | null;
  score2025Min: number | null;
  score2025Max: number | null;
  scoreRecordCount: number;
  scoreMatch: string | null;
  correctionCount: number;
};

export type AdmissionsCatalog = {
  meta: AdmissionsCatalogMeta;
  filters: {
    batches: string[];
    subjects: string[];
    planCategories: string[];
  };
  schools: AdmissionsSchoolSummary[];
};

export type OfficialAdjustment = {
  field: string;
  before: string | number;
  after: string | number;
  note: string;
  title: string;
  publishedAt: string;
  sourceUrl: string;
};

export type AdmissionsMajor = {
  code: string;
  name: string;
  includedMajors: string;
  planNature: string;
  planCount: number;
  durationYears: string;
  tuition: string;
  foreignLanguage: string;
  oralExam: string;
  subjectRequirement: string;
  notes: string;
  campus: string;
  adjustments: OfficialAdjustment[];
};

export type AdmissionsOffering = {
  id: string;
  batchId: string;
  batch: string;
  subject: string;
  planCategory: string;
  professionalGroup: string;
  officialPath: string;
  planCount: number;
  majors: AdmissionsMajor[];
};

export type AdmissionsScore = {
  year: number;
  kind: "投档" | "录取";
  roundTitle: string;
  publishedAt: string;
  sourceUrl: string;
  schoolCode: string;
  schoolName: string;
  batch: string;
  subject: string;
  planCategory: string;
  professionalGroup: string;
  count: number | null;
  maximumScore: number | null;
  minimumScore: number | null;
  details: Record<string, string | number>;
  matchedBy: string;
};

export type AdmissionsCorrection = {
  title: string;
  publishedAt: string;
  url: string;
  schoolCodes: string[];
  content: string;
  embeddedImages: Array<{ file: string; mimeType: string }>;
  matchedSchoolIds: string[];
  appliedChanges?: Array<{
    schoolCode: string;
    schoolName: string;
    majorCode?: string;
    majorName?: string;
    subject?: string;
    field: string;
    before: string | number;
    after: string | number;
    note: string;
  }>;
};

export type AdmissionsSchoolDetail = {
  id: string;
  code: string;
  name: string;
  officialCharterUrl: string;
  offerings: AdmissionsOffering[];
  scoreHistory: AdmissionsScore[];
  corrections: AdmissionsCorrection[];
  sources: {
    planIndex: string;
    correctionIndex: string;
  };
};

export function admissionsAsset(path: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
}

export function formatNumber(value: number | null | undefined) {
  return typeof value === "number" ? value.toLocaleString("zh-CN") : "—";
}

