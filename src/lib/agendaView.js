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
