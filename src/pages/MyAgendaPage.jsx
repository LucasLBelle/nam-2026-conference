import { useMemo, useRef } from 'react';
import { useConference, useFetch } from '../lib/store.jsx';
import * as api from '../lib/api.js';
import { viewAgenda, recommend, withSessions } from '../lib/agendaView.js';
import { dayLabel, timeRange } from '../lib/format.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { Button, EmptyState, SeatButton, ErrorState, NotStepFree, SectionHeader, Skeleton, Stat } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { Link } from 'react-router-dom';

const hours = (mins) => `${Math.round((mins / 60) * 10) / 10}h`;

export function MyAgendaPage() {
  useDocumentTitle('My Agenda');
  const { currentUserId, reservationFor, toggleSeat, clock } = useConference();
  const { data, loading, error, reload } = useFetch(() => api.getSchedule(currentUserId), [currentUserId]);
  // The store's currentUser is the bootstrap copy and goes stale after a Profile save.
  const me = useFetch(() => api.getUser(currentUserId), [currentUserId]);
  const all = useFetch(() => api.getSessions(), []);
  const interests = me.data?.interests;
  const arrival = me.data?.arrival;
  const departure = me.data?.departure;
  const flagged = (s) => me.data?.accessNeeds?.includes('step-free') && s.room && !s.room.accessible;
  // Every session ever offered as a recommendation: one added from here is not in the fetched schedule.
  const offered = useRef(new Map());
  const recs = useMemo(() => {
    const out = recommend(all.data ?? [], interests ?? [], reservationFor, clock, 8, { arrival, departure });
    for (const s of out) offered.current.set(s.id, s);
    return out;
  }, [all.data, interests, arrival, departure, reservationFor, clock]);
  // Merge those in so a session added from a recommendation lists in the agenda at once.
  const view = useMemo(
    () => viewAgenda(withSessions(data?.days ?? [], [...offered.current.values()]), reservationFor),
    [data, recs, reservationFor],
  );

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
                      {flagged(s) && <div><NotStepFree /></div>}
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
      {!error && (data || !loading) && me.data && (
        <section data-testid="agenda-recommendations" className="space-y-3">
          <h2 className="font-display text-xl">Recommended for you</h2>
          {!interests.length ? (
            <p className="text-sm text-muted">
              Pick some topics you care about and we will suggest sessions.{' '}
              <Link to="/profile" data-testid="recommendations-set-interests" className="font-semibold text-violet-300 hover:text-violet-200">Set your interests on My Profile</Link>
            </p>
          ) : !recs.length ? (
            <p className="text-sm text-muted">Nothing more upcoming matches your interests.</p>
          ) : (
            <ul className="space-y-2">
              {recs.map((s) => (
                <li key={s.id} data-testid="recommendation" className="flex items-center gap-3 rounded-xl border border-hairline bg-raised p-3">
                  <div className="w-32 shrink-0 font-mono text-xs text-muted">{dayLabel(s.day)}<br />{timeRange(s.startsAt, s.endsAt)}</div>
                  <Link to={`/sessions/${s.id}`} className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold hover:text-violet-200">{s.title}</Link>
                  {flagged(s) && <NotStepFree />}
                  <span data-testid="recommendation-add">
                    <SeatButton size="sm" status={reservationFor(s.id)} onClick={() => toggleSeat(s.id, s)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
