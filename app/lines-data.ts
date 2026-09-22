export type OrdinaryExamTrack = "物理" | "历史";

export const controlLineSource = {
  year: 2026,
  title: "2026年内蒙古自治区普通高考录取控制分数线",
  url: "https://www.nm.zsks.cn/zxyw/202606/t20260624_46442.html",
  publisher: "内蒙古自治区教育考试院·普通高校招生考试处",
  publishedAt: "2026-06-24",
  verifiedAt: "2026-09-22",
  scope: "普通类（不含专项类、艺术类、体育类、对口招生类）",
} as const;

export const officialControlLines: Record<OrdinaryExamTrack, ReadonlyArray<{
  id: string;
  label: string;
  score: number;
  description: string;
}>> = {
  物理: [
    { id: "special", label: "本科特殊类型控制线", score: 488, description: "用于强基计划、高校专项计划、综合评价、军事院校等部分特殊类型招生。" },
    { id: "undergraduate", label: "本科录取控制线", score: 363, description: "普通物理类本科门槛；达到控制线不代表达到院校专业组实际投档线。" },
    { id: "vocational", label: "高职（专科）控制线", score: 160, description: "普通物理类专科门槛；仍需核对专业组招生计划、选科和章程要求。" },
  ],
  历史: [
    { id: "special", label: "本科特殊类型控制线", score: 512, description: "用于强基计划、高校专项计划、综合评价、军事院校等部分特殊类型招生。" },
    { id: "undergraduate", label: "本科录取控制线", score: 403, description: "普通历史类本科门槛；达到控制线不代表达到院校专业组实际投档线。" },
    { id: "vocational", label: "高职（专科）控制线", score: 160, description: "普通历史类专科门槛；仍需核对专业组招生计划、选科和章程要求。" },
  ],
};

export function controlLineDifference({
  hydrated,
  profileConfigured,
  profileTrack,
  viewedTrack,
  score,
  lineScore,
}: {
  hydrated: boolean;
  profileConfigured: boolean;
  profileTrack: OrdinaryExamTrack;
  viewedTrack: OrdinaryExamTrack;
  score: string;
  lineScore: number;
}): number | null {
  if (!hydrated || !profileConfigured || profileTrack !== viewedTrack) return null;
  if (!/^\d{1,3}$/.test(score.trim())) return null;
  const value = Number(score);
  if (!Number.isInteger(value) || value < 0 || value > 750 ||
      !Number.isInteger(lineScore) || lineScore < 0 || lineScore > 750) return null;
  return value - lineScore;
}

