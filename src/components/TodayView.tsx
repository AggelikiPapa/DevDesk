import { formatDuration } from "../features/tasks/timePresentation.ts";
import { useTodayWorkspace } from "../features/today/useTodayWorkspace.ts";
import { todayDisplayedDurations } from "../features/today/todayPresentation.ts";

const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });

export function TodayView() {
  const { now, report, loading, error } = useTodayWorkspace();
  const displayed = report ? todayDisplayedDurations(report) : null;
  return (
    <section className="today-view" aria-labelledby="today-heading">
      <div className="section-heading">
        <h2 id="today-heading">Today</h2>
        <span className="today-date">{dateLabel.format(now)}</span>
      </div>
      {error ? <p className="app-error" role="alert">{error}</p> : loading || !report ? (
        <p className="loading-state" role="status">Loading today’s work…</p>
      ) : (
        <>
          <div className="today-total">
            <span className="eyebrow">Total tracked</span>
            <strong role="timer" aria-label="Total tracked today">{formatDuration(displayed?.totalMs ?? 0)}</strong>
          </div>
          {report.timeline.length === 0 ? (
            <div className="empty-state">
              <h3>No tracked work today</h3>
              <p>Start a task to build today’s timeline.</p>
            </div>
          ) : (
            <>
              <section className="today-section" aria-labelledby="today-clients-heading">
                <h3 id="today-clients-heading">By client</h3>
                <ul className="today-clients">
                  {report.clients.map((client) => (
                    <li key={client.clientId}>
                      <div className="today-summary-line client-line">
                        <span>{client.name}</span><strong>{formatDuration(displayed?.clients.get(client.clientId) ?? 0)}</strong>
                      </div>
                      <ul>
                        {client.tasks.map((task) => (
                          <li key={task.taskId} className="today-summary-line task-line">
                            <span>{task.externalKey && <span className="issue-key">{task.externalKey} </span>}{task.title}</span>
                            <span>{formatDuration(displayed?.tasks.get(task.taskId) ?? 0)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="today-section" aria-labelledby="today-timeline-heading">
                <h3 id="today-timeline-heading">Timeline</h3>
                <ol className="today-timeline">
                  {report.timeline.map((entry) => (
                    <li key={entry.workSessionId}>
                      <div className="timeline-time">
                        {clock.format(new Date(entry.effectiveStart))} – {entry.running ? "Now" : clock.format(new Date(entry.effectiveEnd))}
                      </div>
                      <div className="timeline-meta">
                        {entry.clientName}{entry.externalKey && <> · {entry.externalKey}</>}
                      </div>
                      <div className="timeline-title">{entry.taskTitle}</div>
                      <div className="timeline-duration">{formatDuration(displayed?.sessions.get(entry.workSessionId) ?? 0)}</div>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
