export const secondSubjectOptions = ["化学", "生物学", "思想政治", "地理"] as const;

export type SecondSubject = (typeof secondSubjectOptions)[number];

export type SubjectCombinationValidation = {
  valid: boolean;
  reason: string;
};

export function validateSubjectCombination(profile: {
  firstSubject: string;
  secondSubjects: readonly string[];
}): SubjectCombinationValidation {
  if (profile.firstSubject !== "物理" && profile.firstSubject !== "历史") {
    return { valid: false, reason: "首选科目必须在物理与历史中选择 1 门。" };
  }
  if (profile.secondSubjects.length !== 2) {
    return { valid: false, reason: "再选科目必须从化学、生物学、思想政治、地理中恰好选择 2 门。" };
  }
  if (new Set(profile.secondSubjects).size !== 2) {
    return { valid: false, reason: "两门再选科目不能重复。" };
  }
  if (!profile.secondSubjects.every((subject) => secondSubjectOptions.includes(subject as SecondSubject))) {
    return { valid: false, reason: "再选科目包含不符合内蒙古 3+1+2 规则的科目。" };
  }
  return { valid: true, reason: "当前选科组合符合普通类 3+1+2 结构。" };
}
