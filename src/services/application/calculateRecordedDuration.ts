import type { UtcTimestamp, WorkSession } from "../../types/domain.ts";

export function calculateRecordedDuration(
  sessions: readonly WorkSession[],
  now?: UtcTimestamp,
): number {
  const explicitNow = now === undefined ? undefined : timestampValue(now, "now");

  return sessions.reduce((total, session) => {
    const startedAt = timestampValue(session.startedAt, "startedAt");
    const endedAt = session.endedAt === null
      ? explicitNow
      : timestampValue(session.endedAt, "endedAt");

    if (endedAt === undefined) return total;
    if (endedAt < startedAt) {
      throw new RangeError(`WorkSession ends before it starts: ${session.id}`);
    }
    return total + endedAt - startedAt;
  }, 0);
}

function timestampValue(value: UtcTimestamp, field: string): number {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new RangeError(`Invalid ${field} timestamp: ${value}`);
  return timestamp;
}
