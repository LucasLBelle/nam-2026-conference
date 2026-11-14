import { hasEnded } from './clock.js';

/**
 * The agenda as the store sees it. `days` is `/users/:id/schedule`; the store's
 * `reservationFor` is the source of truth, so a removed session leaves the page
 * without a refetch. Booked time counts confirmed seats only — queued time is
 * totalled apart.
 */
export function viewAgenda(days, reservationFor) {
  const out = [];
  let bookedMinutes = 0;
  let waitlistedMinutes = 0;
  for (const day of days) {
    const sessions = day.sessions
      .map((s) => ({ ...s, status: reservationFor(s.id) }))
      .filter((s) => s.status)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id);
    if (!sessions.length) continue;
    const sum = (status) => sessions.filter((s) => s.status === status).reduce((n, s) => n + s.durationMins, 0);
    const d = { ...day, sessions, bookedMinutes: sum('confirmed'), waitlistedMinutes: sum('waitlisted') };
    bookedMinutes += d.bookedMinutes;
    waitlistedMinutes += d.waitlistedMinutes;
    out.push(d);
  }
  return { days: out, bookedMinutes, waitlistedMinutes };
}

/**
 * Upcoming sessions tagged (topic tags, by name) with any of the attendee's
 * interests, soonest first, leaving out anything already held — seat or
 * waitlist place — and anything over by the simulated clock. A full session
 * stays: its add button waitlists. `window` is the attendee's `arrival` and
 * `departure` ('YYYY-MM-DDTHH:MM', either may be null): a session not wholly
 * inside it is left out, and with neither set nothing is.
 */
export function recommend(sessions, interests, reservationFor, clock, limit = 8, window = {}) {
  if (!interests?.length) return [];
  const wanted = new Set(interests);
  const { arrival, departure } = window ?? {};
  const inWindow = (s) => (!arrival || `${s.day}T${s.startsAt}` >= arrival) && (!departure || `${s.day}T${s.endsAt}` <= departure);
  return sessions
    .filter((s) => s.tags?.some((t) => t.kind === 'topic' && wanted.has(t.name)))
    .filter((s) => !reservationFor(s.id) && !hasEnded(s, clock))
    .filter(inWindow)
    .sort((a, b) => a.day.localeCompare(b.day) || a.startsAt.localeCompare(b.startsAt) || a.id - b.id)
    .slice(0, limit);
}

/** Merge extra sessions into the schedule's days (deduped by id), so one just added from a recommendation can be listed. */
export function withSessions(days, sessions) {
  const byDate = new Map(days.map((d) => [d.date, { ...d, sessions: [...d.sessions] }]));
  for (const s of sessions) {
    const day = byDate.get(s.day) ?? { date: s.day, sessions: [] };
    if (!day.sessions.some((x) => x.id === s.id)) day.sessions.push(s);
    byDate.set(s.day, day);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
