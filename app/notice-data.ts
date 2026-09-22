"use client";

import { useCallback, useEffect, useState } from "react";
import cachedFeed from "../public/data/announcements.json";

export type NoticeItem = {
  title: string;
  date: string;
  category: string;
  url: string;
  verification: "official-index" | "unverified";
  dateSource: string;
};

export type NoticeFeed = {
  items: NoticeItem[];
  sourceName: string;
  source: string;
  updatedAt: string | null;
  lastSuccessfulSync: string | null;
  verified: boolean;
  syncWindow: { start: string; end: string; timezone: string };
};

function validOfficialUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      (url.hostname === "nm.zsks.cn" || url.hostname.endsWith(".nm.zsks.cn"));
  } catch { return false; }
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function normalizeAnnouncements(value: unknown): NoticeFeed {
  if (!value || typeof value !== "object") throw new Error("公告数据格式不正确");
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.items)) throw new Error("公告列表暂不可读");
  const items = raw.items.flatMap((entry): NoticeItem[] => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.title !== "string" || !validOfficialUrl(item.url)) return [];
    return [{
      title: item.title,
      date: typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : "",
      category: typeof item.category === "string" ? item.category : "政策资讯",
      url: item.url,
      verification: item.verification === "official-index" ? "official-index" : "unverified",
      dateSource: typeof item.dateSource === "string" ? item.dateSource : "unknown",
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  const lastSuccessfulSync = validTimestamp(raw.lastSuccessfulSync) ? raw.lastSuccessfulSync : null;
  const year = (lastSuccessfulSync || (validTimestamp(raw.updatedAt) ? raw.updatedAt : new Date().toISOString())).slice(0, 4);
  const rawWindow = raw.syncWindow as Record<string, unknown> | undefined;
  return {
    items,
    source: validOfficialUrl(raw.source) ? raw.source : "https://www.nm.zsks.cn/ztzl/pagkpt/",
    sourceName: typeof raw.sourceName === "string" ? raw.sourceName : "内蒙古自治区教育考试院",
    updatedAt: validTimestamp(raw.updatedAt) ? raw.updatedAt : null,
    lastSuccessfulSync,
    verified: lastSuccessfulSync !== null && items.some((item) => item.verification === "official-index"),
    syncWindow: {
      start: typeof rawWindow?.start === "string" ? rawWindow.start : `${year}-06-10`,
      end: typeof rawWindow?.end === "string" ? rawWindow.end : `${year}-08-31`,
      timezone: "Asia/Shanghai",
    },
  };
}

export function formatNoticeTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "尚无成功采集记录";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(value));
}

export function getSyncState(feed: NoticeFeed | null, now = new Date()) {
  if (!feed) return { kind: "pending", label: "正在读取公告", detail: "载入最近一次保存的官方公告索引。" };
  const today = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  if (today < feed.syncWindow.start) return { kind: "paused", label: "采集窗口尚未开始", detail: `计划从 ${feed.syncWindow.start} 开始，每小时检查一次。` };
  if (today > feed.syncWindow.end) return { kind: "paused", label: "非采集期 · 历史归档", detail: `本次采集窗口已于 ${feed.syncWindow.end} 结束，保留已收录公告供复盘。` };
  if (!feed.lastSuccessfulSync || now.getTime() - Date.parse(feed.lastSuccessfulSync) > 2 * 3600000) {
    return { kind: "delayed", label: "更新待核验", detail: "当前在采集窗口内，尚无两小时内的成功记录，请同步查看考试院原文。" };
  }
  return { kind: "active", label: "采集窗口内", detail: "每小时计划检查一次；页面显示最近成功记录，定时任务与发布可能延迟。" };
}

export function useAnnouncements() {
  const [data, setData] = useState<NoticeFeed>(() => normalizeAnnouncements(cachedFeed));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/data/announcements.json`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("公告文件暂时无法读取");
        setData(normalizeAnnouncements(await response.json()));
        setError("");
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "公告加载失败");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const timer = window.setInterval(reload, 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [reload]);
  return { data, loading, error, reload };
}

export type AdmissionEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  audience: string;
  detail: string;
  sourceUrl: string;
  sourceLabel: string;
};

// Manually checked against the linked official notices on 2026-09-22.
// These are a partial 2026 archive, never a forecast for the next admission year.
export const admissionCalendar: AdmissionEvent[] = [
  {
    id: "2026-intention",
    title: "提前批意向类别填报",
    startsAt: "2026-06-24T14:30:00+08:00",
    endsAt: "2026-06-24T20:30:00+08:00",
    audience: "军事、公安、司法警察等意向类别考生",
    detail: "本科与专科提前批意向同时填报；入围、政考、面试、体检等资格需继续按对应公告核验。",
    sourceUrl: "https://www.nm.zsks.cn/kszs/ptgk/ggl/202606/t20260624_46439.html",
    sourceLabel: "第 1 号公告",
  },
  {
    id: "2026-main",
    title: "本科及普通类专科提前批集中填报",
    startsAt: "2026-06-30T09:00:00+08:00",
    endsAt: "2026-07-04T17:00:00+08:00",
    audience: "本科提前批、本科批、普通类专科提前批",
    detail: "通常每日 9:00—22:00，截止日 17:00 结束。军事、公安等资格类院校专业组自 7 月 3 日 9:00 起填报。",
    sourceUrl: "https://www.nm.zsks.cn/kszs/ptgk/ggl/202606/t20260629_46535.html",
    sourceLabel: "第 3 号公告",
  },
  {
    id: "2026-qualified",
    title: "军事、公安等资格类专业组填报",
    startsAt: "2026-07-03T09:00:00+08:00",
    endsAt: "2026-07-04T17:00:00+08:00",
    audience: "公告所列特殊类型资格合格考生",
    detail: "本科提前批 B 段军事、公安、司法警察、消防、北电科及专科提前批军事、司法警察类，具体资格与每日开放时段见原文。",
    sourceUrl: "https://www.nm.zsks.cn/kszs/ptgk/ggl/202606/t20260629_46535.html",
    sourceLabel: "第 3 号公告",
  },
  {
    id: "2026-vocational",
    title: "专科提前批艺术体育类及专科批填报",
    startsAt: "2026-07-29T09:00:00+08:00",
    endsAt: "2026-08-01T17:00:00+08:00",
    audience: "相应科类及批次考生",
    detail: "每日 9:00—22:00，截止日 17:00 结束；是否参加后续征集须结合录取状态与剩余计划判断。",
    sourceUrl: "https://www.nm.zsks.cn/ztzl/pagkpt/tzgg/202607/t20260727_46620.html",
    sourceLabel: "第 14 号公告",
  },
  {
    id: "2026-final",
    title: "专科批最后一次征集志愿",
    startsAt: "2026-08-12T09:00:00+08:00",
    endsAt: "2026-08-12T15:00:00+08:00",
    audience: "符合条件且录取状态为“自由可投”的考生",
    detail: "考试院公告明确为 2026 年高考录取最后一次征集志愿。各科类要求与计划以当次公告为准。",
    sourceUrl: "https://www.nm.zsks.cn/ztzl/pagkpt/tzgg/202608/t20260811_46664.html",
    sourceLabel: "第 18 号公告",
  },
];

