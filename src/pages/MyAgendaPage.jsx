import { useMemo } from 'react';
import { useConference, useFetch } from '../lib/store.jsx';
import * as api from '../lib/api.js';
import { viewAgenda } from '../lib/agendaView.js';
import { dayLabel, timeRange } from '../lib/format.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { Button, EmptyState, ErrorState, SectionHeader, Skeleton, Stat } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { Link } from 'react-router-dom';

const hours = (mins) => `${Math.round((mins / 60) * 10) / 10}h`;

export function MyAgendaPage() {
  useDocumentTitle('My Agenda');
  const { currentUserId, reservationFor, toggleSeat } = useConference();
  const { data, loading, error, reload } = useFetch(() => api.getSchedule(currentUserId), [currentUserId]);
  const view = useMemo(() => viewAgenda(data?.days ?? [], reservationFor), [data, reservationFor]);

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Your conference" title="My Agenda" />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Skeleton className="h-48" />
      ) : !view.days.length ? (
        <div data-testid="agenda-empty">
          <EmptyState
            icon="ticket"
            title="Nothing on your agenda yet"
            description="Add a session from the schedule and it will show up here."
            action={<Button to="/schedule" variant="primary" size="sm">Browse the schedule</Button>}
          />
        </div>
      ) : (
        <>
          <div className="max-w-xs">
            <Stat
              value={hours(view.bookedMinutes)}
              label="Booked"
              testId="agenda-booked"
              note={view.waitlistedMinutes ? <span data-testid="agenda-waitlisted-time">{`+${hours(view.waitlistedMinutes)} waitlisted`}</span> : null}
            />
          </div>
          {view.days.map((day) => (
            <section key={day.date} data-testid="agenda-day" className="space-y-3">
              <h2 className="font-display text-xl">{dayLabel(day.date)}</h2>
              <ul className="space-y-2">
                {day.sessions.map((s) => (
                  <li
                    key={s.id}
                    data-testid="agenda-session"
                    className="flex items-center gap-3 rounded-xl border border-hairline bg-raised p-3"
                  >
                    <div className="w-32 shrink-0 font-mono text-xs text-muted">{timeRange(s.startsAt, s.endsAt)}</div>
                    <div className="min-w-0 flex-1">
                      <Link to={`/sessions/${s.id}`} className="line-clamp-2 text-sm font-semibold hover:text-violet-200">{s.title}</Link>
                      {s.status === 'waitlisted' && (
                        <span data-testid="agenda-waitlisted" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                          <Icon name="clock" className="size-3" /> Waitlisted
                        </span>
                      )}
                    </div>
                    <Button size="sm" data-testid="agenda-remove" aria-label={`Remove ${s.title}`} onClick={() => toggleSeat(s.id, s)}>Remove</Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
