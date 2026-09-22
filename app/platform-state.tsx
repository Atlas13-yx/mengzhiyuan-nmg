"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ExamTrack } from "./score-ranks";
import { schoolGroups, type SchoolGroup } from "./platform-data";
import { admissionsAsset, type AdmissionsCatalog, type AdmissionsSchoolDetail } from "./admissions-data";
import { createOfficialSelection, getOfficialEligibility, restoreOfficialSelections, type OfficialSavedGroup } from "./group-comparison";
import {
  secondSubjectOptions,
  validateSubjectCombination,
  type SecondSubject,
} from "./subject-policy";

export { secondSubjectOptions, validateSubjectCombination } from "./subject-policy";
export type { SecondSubject, SubjectCombinationValidation } from "./subject-policy";

export type VolunteerProfile = {
  firstSubject: ExamTrack;
  secondSubjects: SecondSubject[];
  score: string;
  city: string;
  targetSchool: string;
  preferredRegion: string;
  preferredMajor: string;
  schoolType: string;
  tuition: string;
  career: string;
  graduationPlan: string;
  personality: string;
  notes: string;
};

export const defaultProfile: VolunteerProfile = {
  firstSubject: "物理",
  secondSubjects: ["化学", "生物学"],
  score: "558",
  city: "呼和浩特",
  targetSchool: "",
  preferredRegion: "北方地区",
  preferredMajor: "计算机与电子信息",
  schoolType: "公办优先",
  tuition: "每年 1 万元以内",
  career: "互联网与信息技术",
  graduationPlan: "优先就业",
  personality: "理性务实",
  notes: "",
};

type PlatformContextValue = {
  profile: VolunteerProfile;
  saveProfile: (profile: VolunteerProfile) => boolean;
  savedIds: string[];
  savedGroups: SchoolGroup[];
  officialSavedGroups: OfficialSavedGroup[];
  toggleOfficialSaved: (group: OfficialSavedGroup) => void;
  profileConfigured: boolean;
  storageAvailable: boolean;
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;
  removeSaved: (id: string) => void;
  moveSaved: (id: string, direction: -1 | 1) => void;
  sortSaved: () => void;
  clearSaved: () => void;
  hydrated: boolean;
};

const PlatformContext = createContext<PlatformContextValue | null>(null);
const profileStorageKey = "mengzhiyuan-profile-v1";
const listStorageKey = "mengzhiyuan-volunteer-list-v1";
const officialStorageKey = "mengzhiyuan-official-groups-v1";

function safeStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    // Keep the in-memory experience working when storage is unavailable.
    return false;
  }
}

function restoreProfile(value: string | null): VolunteerProfile {
  if (!value) return defaultProfile;
  try {
    const parsed = JSON.parse(value) as Partial<VolunteerProfile>;
    const firstSubjectIsValid = parsed.firstSubject === "历史" || parsed.firstSubject === "物理";
    const firstSubject = parsed.firstSubject === "历史" ? "历史" : "物理";
    const secondSubjects = Array.isArray(parsed.secondSubjects)
      ? [...new Set(parsed.secondSubjects.filter((item): item is SecondSubject =>
          secondSubjectOptions.includes(item as SecondSubject)
        ))].slice(0, 2)
      : [];
    if (!firstSubjectIsValid) secondSubjects.length = 0;
    return {
      firstSubject,
      secondSubjects,
      score: typeof parsed.score === "string" ? parsed.score : defaultProfile.score,
      city: typeof parsed.city === "string" ? parsed.city : defaultProfile.city,
      targetSchool: typeof parsed.targetSchool === "string" ? parsed.targetSchool : defaultProfile.targetSchool,
      preferredRegion: typeof parsed.preferredRegion === "string" ? parsed.preferredRegion : defaultProfile.preferredRegion,
      preferredMajor: typeof parsed.preferredMajor === "string" ? parsed.preferredMajor : defaultProfile.preferredMajor,
      schoolType: typeof parsed.schoolType === "string" ? parsed.schoolType : defaultProfile.schoolType,
      tuition: typeof parsed.tuition === "string" ? parsed.tuition : defaultProfile.tuition,
      career: typeof parsed.career === "string" ? parsed.career : defaultProfile.career,
      graduationPlan: typeof parsed.graduationPlan === "string" ? parsed.graduationPlan : defaultProfile.graduationPlan,
      personality: typeof parsed.personality === "string" ? parsed.personality : defaultProfile.personality,
      notes: typeof parsed.notes === "string" ? parsed.notes : defaultProfile.notes,
    };
  } catch {
    return defaultProfile;
  }
}

function hasConfiguredProfile(value: string | null) {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    return parsed && Array.isArray(parsed.secondSubjects) && validateSubjectCombination(parsed).valid;
  } catch { return false; }
}

function restoreSaved(value: string | null, official: OfficialSavedGroup[] = []): string[] {
  if (!value) return [];
  try {
    const ids = JSON.parse(value);
    if (!Array.isArray(ids)) return [];
    const validIds = new Set([...schoolGroups.map((item) => item.id), ...official.map((item) => item.id)]);
    return [...new Set(ids.filter((id): id is string => typeof id === "string" && validIds.has(id)))];
  } catch {
    return [];
  }
}

export function isGroupEligible(group: SchoolGroup, profile: VolunteerProfile) {
  if (!validateSubjectCombination(profile).valid) return false;
  return group.requirements.every((requirement) =>
    requirement === profile.firstSubject
      ? true
      : profile.secondSubjects.includes(requirement as SecondSubject)
  );
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<VolunteerProfile>(defaultProfile);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [officialSelections, setOfficialSelections] = useState<OfficialSavedGroup[]>([]);
  const [profileConfigured, setProfileConfigured] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [verificationRevision, setVerificationRevision] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const storedProfile = safeStorageGet(profileStorageKey);
      const official = restoreOfficialSelections(safeStorageGet(officialStorageKey));
      setProfile(restoreProfile(storedProfile));
      setProfileConfigured(hasConfiguredProfile(storedProfile));
      setOfficialSelections(official);
      setSavedIds(restoreSaved(safeStorageGet(listStorageKey), official));
      try { window.localStorage.getItem(profileStorageKey); } catch { setStorageAvailable(false); }
      setHydrated(true);
    }, 0);

    function syncAcrossTabs(event: StorageEvent) {
      if (event.key === profileStorageKey || event.key === null) {
        const value = safeStorageGet(profileStorageKey);
        setProfile(restoreProfile(value));
        setProfileConfigured(hasConfiguredProfile(value));
      }
      if (event.key === listStorageKey || event.key === officialStorageKey || event.key === null) {
        const official = restoreOfficialSelections(safeStorageGet(officialStorageKey));
        setOfficialSelections(official);
        setSavedIds(restoreSaved(safeStorageGet(listStorageKey), official));
        setVerificationRevision((revision) => revision + 1);
      }
    }

    window.addEventListener("storage", syncAcrossTabs);
    return () => {
      window.clearTimeout(restoreTimer);
      window.removeEventListener("storage", syncAcrossTabs);
    };
  }, []);

  const officialIdKey = savedIds.filter((id) => id.startsWith("official:")).sort().join("|");

  useEffect(() => {
    if (!hydrated || !officialIdKey) return;
    const controller = new AbortController();
    async function verify() {
      try {
        const response = await fetch(admissionsAsset("/data/admissions-2026/catalog.json"), { signal: controller.signal });
        if (!response.ok) throw new Error("catalog-unavailable");
        const catalog = await response.json() as AdmissionsCatalog;
        const ids = officialIdKey.split("|");
        const relevantSchools = catalog.schools.filter((school) => ids.some((id) => id.startsWith(`official:${catalog.meta.year}:${school.id}-`)));
        const files = [...new Set(relevantSchools.map((school) => school.detailFile))];
        const shards = new Map<string, Record<string, AdmissionsSchoolDetail> | null>();
        await Promise.all(files.map(async (file) => {
          try {
            const detailResponse = await fetch(admissionsAsset(file), { signal: controller.signal });
            if (!detailResponse.ok) throw new Error("detail-unavailable");
            shards.set(file, await detailResponse.json() as Record<string, AdmissionsSchoolDetail>);
          } catch { shards.set(file, null); }
        }));
        if (controller.signal.aborted) return;
        setOfficialSelections((current) => {
          const next = current.map((selection): OfficialSavedGroup => {
            const school = catalog.schools.find((item) => item.id === selection.schoolId);
            if (!school || selection.year !== catalog.meta.year) return { ...selection, verification: "unavailable" };
            const shard = shards.get(school.detailFile);
            if (!shard) return { ...selection, verification: "offline" };
            const detail = shard[school.id];
            const offering = detail?.offerings.find((item) => item.id === selection.offering.id);
            if (!offering) return { ...selection, verification: "unavailable" };
            return { ...createOfficialSelection(school, detail, offering, catalog.meta), savedAt: selection.savedAt };
          });
          safeStorageSet(officialStorageKey, JSON.stringify(next));
          return next;
        });
      } catch {
        if (!controller.signal.aborted) setOfficialSelections((current) => current.map((item) => ({ ...item, verification: "offline" })));
      }
    }
    void verify();
    return () => controller.abort();
  }, [hydrated, officialIdKey, verificationRevision]);

  function saveProfile(nextProfile: VolunteerProfile) {
    if (!hydrated) return false;
    if (!validateSubjectCombination(nextProfile).valid) return false;
    setProfile(nextProfile);
    setProfileConfigured(true);
    setStorageAvailable(safeStorageSet(profileStorageKey, JSON.stringify(nextProfile)));
    return true;
  }

  function persistSaved(nextIds: string[]) {
    if (!hydrated) return;
    setSavedIds(nextIds);
    const nextOfficial = officialSelections.filter((group) => nextIds.includes(group.id));
    setOfficialSelections(nextOfficial);
    const officialStored = safeStorageSet(officialStorageKey, JSON.stringify(nextOfficial));
    setStorageAvailable(safeStorageSet(listStorageKey, JSON.stringify(nextIds)) && officialStored);
  }

  function toggleSaved(id: string) {
    if (!hydrated) return;
    if (!schoolGroups.some((group) => group.id === id)) return;
    setSavedIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      safeStorageSet(listStorageKey, JSON.stringify(next));
      return next;
    });
  }

  function removeSaved(id: string) {
    persistSaved(savedIds.filter((item) => item !== id));
  }

  function toggleOfficialSaved(group: OfficialSavedGroup) {
    if (!hydrated) return;
    if (savedIds.includes(group.id)) {
      persistSaved(savedIds.filter((id) => id !== group.id));
      return;
    }
    const nextOfficial = [...officialSelections.filter((item) => item.id !== group.id), group];
    const nextIds = [...savedIds, group.id];
    setOfficialSelections(nextOfficial);
    setSavedIds(nextIds);
    const officialStored = safeStorageSet(officialStorageKey, JSON.stringify(nextOfficial));
    setStorageAvailable(safeStorageSet(listStorageKey, JSON.stringify(nextIds)) && officialStored);
  }

  function moveSaved(id: string, direction: -1 | 1) {
    const currentIndex = savedIds.indexOf(id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= savedIds.length) return;
    const next = [...savedIds];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    persistSaved(next);
  }

  function sortSaved() {
    const order = { eligible: 0, review: 1, blocked: 2 } as const;
    function priority(id: string) {
      const official = officialSelections.find((group) => group.id === id);
      if (!official) return 3;
      if (!profileConfigured || official.verification !== "verified") return 1;
      return order[getOfficialEligibility(official.offering, profile).status];
    }
    const next = [...savedIds].sort((left, right) => {
      return priority(left) - priority(right);
    });
    persistSaved(next);
  }

  const savedGroups = useMemo(
    () =>
      savedIds
        .map((id) => schoolGroups.find((group) => group.id === id))
        .filter((item): item is SchoolGroup => Boolean(item)),
    [savedIds]
  );

  const officialSavedGroups = useMemo(() => savedIds.map((id) => officialSelections.find((group) => group.id === id)).filter((group): group is OfficialSavedGroup => Boolean(group)), [savedIds, officialSelections]);

  const value: PlatformContextValue = {
    profile,
    saveProfile,
    savedIds,
    savedGroups,
    officialSavedGroups,
    toggleOfficialSaved,
    profileConfigured,
    storageAvailable,
    isSaved: (id) => savedIds.includes(id),
    toggleSaved,
    removeSaved,
    moveSaved,
    sortSaved,
    clearSaved: () => persistSaved([]),
    hydrated,
  };

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error("usePlatform 必须在 PlatformProvider 中使用");
  return context;
}
