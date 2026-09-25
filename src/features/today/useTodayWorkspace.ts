import { useEffect, useState } from "react";
import {
  buildTodayReport,
  localDayRange,
  todayService,
} from "../../services/application/todayService.ts";
import type { TodaySessionRecord } from "../../types/reporting.ts";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Today's work could not be loaded.";
}

export function useTodayWorkspace() {
  const [now, setNow] = useState(() => new Date());
  const [source, setSource] = useState<{
    start: string;
    end: string;
    sessions: TodaySessionRecord[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const day = localDayRange(now);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    todayService.listWorkSessionsOverlapping(day.start, day.end)
      .then((sessions) => {
        if (!mounted) return;
        setSource({ start: day.start, end: day.end, sessions });
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (mounted) setLoadError(message(error));
      });
    return () => { mounted = false; };
  }, [day.key, day.start, day.end]);

  let report = null;
  let reportError = null;
  const currentSource = source?.start === day.start && source.end === day.end;
  if (source && currentSource && !loadError) {
    try {
      report = buildTodayReport(source.sessions, day, now.toISOString());
    } catch (error) {
      reportError = message(error);
    }
  }
  return { day, now, report, loading: !currentSource && !loadError, error: loadError || reportError };
}
